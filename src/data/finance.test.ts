import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { UserError } from "@/lib/errors";
import { createUser, prepareDb } from "@/test/db";
import {
  createBill, createCategory, createRecurring, createTransaction, deleteTransaction, ensureFinanceDefaults, ensureRecurringBills, getTransaction,
  listAccounts, listBills, listBudgets, listCategories, listTransactions, markBillsPaid, monthlySeries, periodTotals, reopenBill, rollUp,
  scheduleBillReminders, setBudget, spendingByLeaf, removeAccount, createAccount, type TxInput,
} from "./finance";

let alice: string;
let bob: string;
let account: string;

const tx = (over: Partial<TxInput> = {}): TxInput => ({
  type: "expense", amountCents: 10_000, date: "2026-11-05", accountId: account, categoryId: null, payMethod: "pix", description: "Mercado", note: null, ...over,
});

beforeAll(async () => {
  await prepareDb();
  alice = await createUser("Alice");
  bob = await createUser("Bob");
  await ensureFinanceDefaults(alice);
  account = (await listAccounts(alice))[0]?.id as string;
});

describe("primeira visita", () => {
  it("cria conta e categorias uma única vez", async () => {
    await ensureFinanceDefaults(alice);
    await Promise.all([ensureFinanceDefaults(bob), ensureFinanceDefaults(bob)]);
    expect(await listAccounts(alice)).toHaveLength(1);
    expect(await listAccounts(bob)).toHaveLength(1);
    const cats = await listCategories(alice);
    expect(cats.filter((c) => !c.parentId).map((c) => c.name)).toContain("Moradia");
    expect(cats.some((c) => c.name === "Supermercado" && c.parentId)).toBe(true);
  });
});

describe("lançamentos e saldo", () => {
  it("o saldo soma o inicial, as entradas e as saídas", async () => {
    const acc = await createAccount(alice, { name: "Poupança", kind: "savings", openingCents: 50_000 });
    await createTransaction(alice, tx({ accountId: acc, type: "income", amountCents: 20_000 }));
    await createTransaction(alice, tx({ accountId: acc, amountCents: 7_550 }));
    expect((await listAccounts(alice)).find((a) => a.id === acc)?.balanceCents).toBe(62_450);
  });

  it("filtra, pagina e busca no texto cifrado", async () => {
    const cats = await listCategories(alice);
    const food = cats.find((c) => c.name === "Supermercado")?.id as string;
    await createTransaction(alice, tx({ description: "Feira orgânica", categoryId: food, date: "2026-10-02", amountCents: 3_000 }));
    const october = await listTransactions(alice, { from: "2026-10-01", to: "2026-10-31" });
    expect(october.rows.map((r) => r.description)).toContain("Feira orgânica");
    const found = await listTransactions(alice, { q: "feira" });
    expect(found.rows).toHaveLength(1);
    const parent = cats.find((c) => c.name === "Alimentação")?.id as string;
    expect((await listTransactions(alice, { categoryId: parent })).rows.map((r) => r.id)).toContain(found.rows[0]?.id);
    expect((await listTransactions(alice, {}, 1, 1)).rows).toHaveLength(1);
  });

  it("totais do período e série mensal", async () => {
    const totals = await periodTotals(alice, "2026-10-01", "2026-10-31");
    expect(totals.expenseCents).toBe(3_000);
    const series = await monthlySeries(alice, "2026-11", 3);
    expect(series.map((s) => s.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(series[1]?.expenseCents).toBe(3_000);
  });

  it("não aceita conta nem categoria de outra pessoa", async () => {
    const bobAccount = (await listAccounts(bob))[0]?.id as string;
    await expect(createTransaction(alice, tx({ accountId: bobAccount }))).rejects.toBeInstanceOf(UserError);
    const bobCat = (await listCategories(bob))[0]?.id as string;
    await expect(createTransaction(alice, tx({ categoryId: bobCat }))).rejects.toBeInstanceOf(UserError);
  });
});

describe("orçamento", () => {
  it("soma subcategorias na categoria e guarda o limite", async () => {
    const cats = await listCategories(alice);
    const top = cats.find((c) => c.name === "Transporte" && !c.parentId)?.id as string;
    const fuel = cats.find((c) => c.name === "Combustível")?.id as string;
    await createTransaction(alice, tx({ categoryId: fuel, amountCents: 18_000, date: "2026-11-08" }));
    const totals = rollUp(cats, await spendingByLeaf(alice, "2026-11-01", "2026-11-30"));
    expect(totals.get(top)).toBe(18_000);
    await setBudget(alice, top, 50_000);
    await setBudget(alice, top, 60_000);
    expect((await listBudgets(alice)).get(top)).toBe(60_000);
    await setBudget(alice, top, null);
    expect((await listBudgets(alice)).has(top)).toBe(false);
  });

  it("recusa limite em subcategoria e em receita", async () => {
    const cats = await listCategories(alice);
    await expect(setBudget(alice, cats.find((c) => c.name === "Combustível")?.id as string, 100)).rejects.toBeInstanceOf(UserError);
    await expect(setBudget(alice, cats.find((c) => c.name === "Salário")?.id as string, 100)).rejects.toBeInstanceOf(UserError);
  });

  it("subcategoria herda cor e tipo da categoria", async () => {
    const cats = await listCategories(alice);
    const lazer = cats.find((c) => c.name === "Lazer" && !c.parentId);
    const id = await createCategory(alice, { name: "Games", color: "sand", icon: "star", type: "income", parentId: lazer?.id ?? null });
    const sub = (await listCategories(alice)).find((c) => c.id === id);
    expect(sub).toMatchObject({ color: lazer?.color, type: "expense", parentId: lazer?.id });
  });
});

describe("contas recorrentes e a pagar", () => {
  const TODAY = "2026-11-10";

  it("gera as contas do mês e do próximo sem duplicar, respeitando o fim do mês", async () => {
    await createRecurring(alice, {
      type: "expense", kind: "subscription", name: "Streaming", amountCents: 3_990, dayOfMonth: 31, categoryId: null, accountId: account,
      payMethod: "credit", startsOn: "2026-01-01", endsOn: null, active: true,
    }, TODAY);
    await ensureRecurringBills(TODAY, alice);
    await ensureRecurringBills(TODAY);
    const bills = (await listBills(alice, { paid: false })).filter((b) => b.name === "Streaming");
    expect(bills.map((b) => b.dueDate)).toEqual(["2026-11-30", "2026-12-31"]);
  });

  it("recorrente de receita não gera conta e a pausada some", async () => {
    await createRecurring(alice, {
      type: "income", kind: "fixed", name: "Salário fixo", amountCents: 650_000, dayOfMonth: 5, categoryId: null, accountId: account,
      payMethod: "transfer", startsOn: "2026-01-01", endsOn: null, active: true,
    }, TODAY);
    await createRecurring(alice, {
      type: "expense", kind: "fixed", name: "Pausada", amountCents: 1_000, dayOfMonth: 12, categoryId: null, accountId: account,
      payMethod: "pix", startsOn: "2026-01-01", endsOn: null, active: false,
    }, TODAY);
    const names = (await listBills(alice, { paid: false })).map((b) => b.name);
    expect(names).not.toContain("Salário fixo");
    expect(names).not.toContain("Pausada");
  });

  it("pagar cria o lançamento e reabrir o apaga", async () => {
    const id = await createBill(alice, { name: "Energia", amountCents: 18_745, dueDate: "2026-11-12", categoryId: null });
    const before = (await listAccounts(alice)).find((a) => a.id === account)?.balanceCents as number;
    expect(await markBillsPaid(alice, [id], TODAY)).toBe(1);
    expect(await markBillsPaid(alice, [id], TODAY)).toBe(0);
    const [paid] = await listBills(alice, { paid: true, from: "2026-11-01", to: "2026-11-30" });
    expect(paid).toMatchObject({ name: "Energia", paidOn: TODAY });
    expect((await listAccounts(alice)).find((a) => a.id === account)?.balanceCents).toBe(before - 18_745);
    expect(await reopenBill(alice, id)).toBe(true);
    expect((await listAccounts(alice)).find((a) => a.id === account)?.balanceCents).toBe(before);
    expect((await listBills(alice, { paid: false })).map((b) => b.id)).toContain(id);
  });

  it("apagar o lançamento de uma conta paga reabre a conta", async () => {
    const id = await createBill(alice, { name: "Água", amountCents: 9_630, dueDate: "2026-11-17", categoryId: null });
    await markBillsPaid(alice, [id], TODAY);
    const [paid] = await listBills(alice, { paid: true, from: "2026-11-10", to: "2026-11-10" });
    expect(await deleteTransaction(alice, paid?.transactionId as string)).toBe(true);
    expect((await listBills(alice, { paid: false })).map((b) => b.id)).toContain(id);
    expect(await getTransaction(alice, paid?.transactionId as string)).toBeNull();
  });

  it("agenda um aviso por conta aberta que vence perto, uma vez só", async () => {
    const id = await createBill(alice, { name: "Condomínio", amountCents: 42_000, dueDate: TODAY, categoryId: null });
    await scheduleBillReminders(TODAY);
    await scheduleBillReminders(TODAY);
    const rows = await db.select().from(schema.reminders).where(and(eq(schema.reminders.userId, alice), eq(schema.reminders.billId, id)));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "bill", date: TODAY, time: "09:00" });
    // 09:00 em America/Sao_Paulo (UTC-3) = 12:00 UTC
    expect(rows[0]?.fireAt.toISOString()).toBe("2026-11-10T12:00:00.000Z");
    await markBillsPaid(alice, [id], TODAY);
    expect(await db.select().from(schema.reminders).where(eq(schema.reminders.billId, id))).toHaveLength(0);
  });
});

describe("contas bancárias", () => {
  it("mantém ao menos uma conta e arquiva a que tem histórico", async () => {
    const onlyOne = (await listAccounts(bob))[0]?.id as string;
    await expect(removeAccount(bob, onlyOne)).rejects.toBeInstanceOf(UserError);
    const extra = await createAccount(bob, { name: "Carteira", kind: "wallet", openingCents: 0 });
    await createTransaction(bob, tx({ accountId: extra }));
    expect(await removeAccount(bob, extra)).toBe(true);
    expect(await listAccounts(bob)).toHaveLength(1);
    expect((await listAccounts(bob, true))).toHaveLength(2);
  });
});
