import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { addMonths, daysInMonth, type Day, type Month } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { DEFAULT_CATEGORIES, type AccountKind, type PayMethod, type RecurringKind } from "@/lib/finance-meta";
import { matchesQuery } from "@/lib/notes";
import type { ColorId } from "@/lib/palette";

const { finAccounts, finCategories, finTransactions, finBudgets, finRecurring, finBills, reminders } = schema;

export type FinType = "expense" | "income";

export const monthRange = (month: Month): { from: Day; to: Day } => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: `${month}-01`, to: `${month}-${String(daysInMonth(y, m)).padStart(2, "0")}` };
};

/* ---------- Padrões da primeira visita ---------- */

/** Cria a conta e as categorias iniciais uma única vez; o lock evita duplicar em duas abas abertas juntas. */
export async function ensureFinanceDefaults(userId: string): Promise<void> {
  const [existing] = await db.select({ id: finAccounts.id }).from(finAccounts).where(eq(finAccounts.userId, userId)).limit(1);
  if (existing) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const [again] = await tx.select({ id: finAccounts.id }).from(finAccounts).where(eq(finAccounts.userId, userId)).limit(1);
    if (again) return;
    await tx.insert(finAccounts).values({ userId, nameEnc: encrypt("Conta corrente", userId, "fin.account.name"), kind: "checking" });
    let position = 0;
    for (const category of DEFAULT_CATEGORIES) {
      const [parent] = await tx.insert(finCategories).values({
        userId, type: category.type, color: category.color, icon: category.icon, position: position++,
        nameEnc: encrypt(category.name, userId, "fin.category.name"),
      }).returning({ id: finCategories.id });
      if (!parent) continue;
      for (const sub of category.subs) {
        await tx.insert(finCategories).values({
          userId, parentId: parent.id, type: category.type, color: category.color, icon: category.icon, position: position++,
          nameEnc: encrypt(sub, userId, "fin.category.name"),
        });
      }
    }
  });
}

/* ---------- Contas ---------- */

export type Account = { id: string; name: string; kind: AccountKind; openingCents: number; balanceCents: number; archived: boolean };

export async function listAccounts(userId: string, includeArchived = false): Promise<Account[]> {
  const delta = sql<number>`coalesce(sum(case when ${finTransactions.type} = 'income' then ${finTransactions.amountCents} else -${finTransactions.amountCents} end), 0)::float8`;
  const rows = await db.select({ account: finAccounts, delta }).from(finAccounts)
    .leftJoin(finTransactions, and(eq(finTransactions.accountId, finAccounts.id), eq(finTransactions.userId, userId)))
    .where(and(eq(finAccounts.userId, userId), includeArchived ? undefined : isNull(finAccounts.archivedAt)))
    .groupBy(finAccounts.id)
    .orderBy(asc(finAccounts.createdAt));
  return rows.map(({ account, delta: d }) => ({
    id: account.id,
    name: decrypt(account.nameEnc, userId, "fin.account.name"),
    kind: account.kind,
    openingCents: account.openingCents,
    balanceCents: account.openingCents + Number(d),
    archived: account.archivedAt !== null,
  }));
}

export async function createAccount(userId: string, input: { name: string; kind: AccountKind; openingCents: number }): Promise<string> {
  const [row] = await db.insert(finAccounts).values({
    userId, kind: input.kind, openingCents: input.openingCents, nameEnc: encrypt(input.name, userId, "fin.account.name"),
  }).returning({ id: finAccounts.id });
  if (!row) throw new Error("Falha ao criar a conta.");
  return row.id;
}

export async function updateAccount(userId: string, id: string, input: { name: string; kind: AccountKind; openingCents: number }): Promise<boolean> {
  const rows = await db.update(finAccounts).set({
    kind: input.kind, openingCents: input.openingCents, nameEnc: encrypt(input.name, userId, "fin.account.name"),
  }).where(and(eq(finAccounts.id, id), eq(finAccounts.userId, userId))).returning({ id: finAccounts.id });
  return rows.length > 0;
}

/** Conta com lançamentos é arquivada (o histórico continua somando); sem lançamentos, apagada. */
export async function removeAccount(userId: string, id: string): Promise<boolean> {
  const active = await listAccounts(userId);
  if (active.length <= 1 && active.some((a) => a.id === id)) throw new UserError("Mantenha pelo menos uma conta.");
  const [used] = await db.select({ id: finTransactions.id }).from(finTransactions)
    .where(and(eq(finTransactions.userId, userId), eq(finTransactions.accountId, id))).limit(1);
  if (used) {
    const rows = await db.update(finAccounts).set({ archivedAt: new Date() })
      .where(and(eq(finAccounts.id, id), eq(finAccounts.userId, userId))).returning({ id: finAccounts.id });
    return rows.length > 0;
  }
  const rows = await db.delete(finAccounts).where(and(eq(finAccounts.id, id), eq(finAccounts.userId, userId))).returning({ id: finAccounts.id });
  return rows.length > 0;
}

/* ---------- Categorias ---------- */

export type Category = { id: string; parentId: string | null; type: FinType; name: string; color: ColorId; icon: string; position: number };

export async function listCategories(userId: string): Promise<Category[]> {
  const rows = await db.select().from(finCategories).where(eq(finCategories.userId, userId))
    .orderBy(asc(finCategories.position), asc(finCategories.createdAt));
  return rows.map((row) => ({
    id: row.id, parentId: row.parentId, type: row.type, color: row.color, icon: row.icon, position: row.position,
    name: decrypt(row.nameEnc, userId, "fin.category.name"),
  }));
}

export type CategoryInput = { name: string; color: ColorId; icon: string; type: FinType; parentId: string | null };

async function assertCategory(userId: string, id: string | null) {
  if (!id) return null;
  const [row] = await db.select().from(finCategories).where(and(eq(finCategories.id, id), eq(finCategories.userId, userId)));
  if (!row) throw new UserError("Categoria não encontrada.");
  return row;
}

export async function createCategory(userId: string, input: CategoryInput): Promise<string> {
  const parent = await assertCategory(userId, input.parentId);
  if (parent?.parentId) throw new UserError("Subcategorias não têm subcategorias.");
  const [last] = await db.select({ position: sql<number>`coalesce(max(${finCategories.position}), 0)::int` }).from(finCategories).where(eq(finCategories.userId, userId));
  const [row] = await db.insert(finCategories).values({
    userId, parentId: input.parentId,
    // A subcategoria herda tipo e cor da categoria: o resto do app agrupa por elas.
    type: parent?.type ?? input.type, color: parent?.color ?? input.color, icon: parent?.icon ?? input.icon,
    position: (last?.position ?? 0) + 1, nameEnc: encrypt(input.name, userId, "fin.category.name"),
  }).returning({ id: finCategories.id });
  if (!row) throw new Error("Falha ao criar a categoria.");
  return row.id;
}

export async function updateCategory(userId: string, id: string, input: { name: string; color: ColorId; icon: string }): Promise<boolean> {
  const rows = await db.update(finCategories).set({
    color: input.color, icon: input.icon, nameEnc: encrypt(input.name, userId, "fin.category.name"),
  }).where(and(eq(finCategories.id, id), eq(finCategories.userId, userId))).returning({ id: finCategories.id, parentId: finCategories.parentId });
  const [row] = rows;
  // Mantém as subcategorias com a cor e o ícone da categoria.
  if (row && !row.parentId) {
    await db.update(finCategories).set({ color: input.color, icon: input.icon })
      .where(and(eq(finCategories.parentId, id), eq(finCategories.userId, userId)));
  }
  return rows.length > 0;
}

/** Apaga a categoria e as subcategorias; os lançamentos ficam, só sem categoria. */
export async function deleteCategory(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(finCategories).where(and(eq(finCategories.id, id), eq(finCategories.userId, userId))).returning({ id: finCategories.id });
  return rows.length > 0;
}

/* ---------- Lançamentos ---------- */

export type Tx = {
  id: string; type: FinType; amountCents: number; date: Day; accountId: string; categoryId: string | null;
  payMethod: PayMethod; description: string; note: string | null; recurringId: string | null;
};

type TxRow = typeof finTransactions.$inferSelect;

const toTx = (userId: string, row: TxRow): Tx => ({
  id: row.id, type: row.type, amountCents: row.amountCents, date: row.date, accountId: row.accountId, categoryId: row.categoryId,
  payMethod: row.payMethod, recurringId: row.recurringId,
  description: decrypt(row.descriptionEnc, userId, "fin.tx.description"),
  note: decryptOpt(row.noteEnc, userId, "fin.tx.note"),
});

export type TxInput = {
  type: FinType; amountCents: number; date: Day; accountId: string; categoryId: string | null;
  payMethod: PayMethod; description: string; note: string | null;
};

async function assertOwnedRefs(userId: string, accountId: string | null, categoryId: string | null) {
  if (accountId) {
    const [account] = await db.select({ id: finAccounts.id }).from(finAccounts).where(and(eq(finAccounts.id, accountId), eq(finAccounts.userId, userId)));
    if (!account) throw new UserError("Conta não encontrada.");
  }
  await assertCategory(userId, categoryId);
}

export async function createTransaction(userId: string, input: TxInput, recurringId: string | null = null): Promise<string> {
  await assertOwnedRefs(userId, input.accountId, input.categoryId);
  const [row] = await db.insert(finTransactions).values({
    userId, type: input.type, amountCents: input.amountCents, date: input.date, accountId: input.accountId,
    categoryId: input.categoryId, payMethod: input.payMethod, recurringId,
    descriptionEnc: encrypt(input.description, userId, "fin.tx.description"),
    noteEnc: encryptOpt(input.note, userId, "fin.tx.note"),
  }).returning({ id: finTransactions.id });
  if (!row) throw new Error("Falha ao criar o lançamento.");
  return row.id;
}

export async function getTransaction(userId: string, id: string): Promise<Tx | null> {
  const [row] = await db.select().from(finTransactions).where(and(eq(finTransactions.id, id), eq(finTransactions.userId, userId)));
  return row ? toTx(userId, row) : null;
}

export async function updateTransaction(userId: string, id: string, input: TxInput): Promise<boolean> {
  await assertOwnedRefs(userId, input.accountId, input.categoryId);
  const rows = await db.update(finTransactions).set({
    type: input.type, amountCents: input.amountCents, date: input.date, accountId: input.accountId,
    categoryId: input.categoryId, payMethod: input.payMethod,
    descriptionEnc: encrypt(input.description, userId, "fin.tx.description"),
    noteEnc: encryptOpt(input.note, userId, "fin.tx.note"),
  }).where(and(eq(finTransactions.id, id), eq(finTransactions.userId, userId))).returning({ id: finTransactions.id });
  return rows.length > 0;
}

/** Apagar o lançamento de uma conta paga reabre a conta, para ela não ficar "paga" sem pagamento. */
export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.update(finBills).set({ paidAt: null, paidOn: null, transactionId: null })
      .where(and(eq(finBills.userId, userId), eq(finBills.transactionId, id)));
    const rows = await tx.delete(finTransactions).where(and(eq(finTransactions.id, id), eq(finTransactions.userId, userId))).returning({ id: finTransactions.id });
    return rows.length > 0;
  });
}

export type TxFilter = {
  from?: Day; to?: Day; type?: FinType; categoryId?: string; accountId?: string; payMethod?: PayMethod; q?: string;
};

const SEARCH_SCAN = 5000;

async function categoryWithChildren(userId: string, id: string): Promise<string[]> {
  const rows = await db.select({ id: finCategories.id }).from(finCategories)
    .where(and(eq(finCategories.userId, userId), or(eq(finCategories.id, id), eq(finCategories.parentId, id))));
  return rows.map((r) => r.id);
}

export async function listTransactions(userId: string, filter: TxFilter, page = 1, pageSize = 12) {
  const categoryIds = filter.categoryId ? await categoryWithChildren(userId, filter.categoryId) : null;
  const where = and(
    eq(finTransactions.userId, userId),
    filter.from ? gte(finTransactions.date, filter.from) : undefined,
    filter.to ? lte(finTransactions.date, filter.to) : undefined,
    filter.type ? eq(finTransactions.type, filter.type) : undefined,
    categoryIds ? (categoryIds.length ? inArray(finTransactions.categoryId, categoryIds) : sql`false`) : undefined,
    filter.accountId ? eq(finTransactions.accountId, filter.accountId) : undefined,
    filter.payMethod ? eq(finTransactions.payMethod, filter.payMethod) : undefined,
  );
  const order = [desc(finTransactions.date), desc(finTransactions.createdAt)];
  const offset = (Math.max(1, page) - 1) * pageSize;

  if (filter.q?.trim()) {
    // Os textos estão cifrados: filtra em memória, com teto, como a busca geral.
    const rows = await db.select().from(finTransactions).where(where).orderBy(...order).limit(SEARCH_SCAN);
    const all = rows.map((r) => toTx(userId, r)).filter((t) => matchesQuery(`${t.description} ${t.note ?? ""}`, filter.q ?? ""));
    return {
      rows: all.slice(offset, offset + pageSize),
      total: all.length,
      incomeCents: all.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0),
      expenseCents: all.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0),
    };
  }

  const [totals] = await db.select({
    total: sql<number>`count(*)::int`,
    income: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'income'), 0)::float8`,
    expense: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'expense'), 0)::float8`,
  }).from(finTransactions).where(where);
  const rows = await db.select().from(finTransactions).where(where).orderBy(...order).limit(pageSize).offset(offset);
  return {
    rows: rows.map((r) => toTx(userId, r)),
    total: totals?.total ?? 0,
    incomeCents: Number(totals?.income ?? 0),
    expenseCents: Number(totals?.expense ?? 0),
  };
}

/* ---------- Totais e séries ---------- */

export async function periodTotals(userId: string, from: Day, to: Day) {
  const [row] = await db.select({
    income: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'income'), 0)::float8`,
    expense: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'expense'), 0)::float8`,
  }).from(finTransactions).where(and(eq(finTransactions.userId, userId), gte(finTransactions.date, from), lte(finTransactions.date, to)));
  return { incomeCents: Number(row?.income ?? 0), expenseCents: Number(row?.expense ?? 0) };
}

/** Total por categoria-folha (a que o lançamento usa). A chave "" reúne os sem categoria. */
export async function spendingByLeaf(userId: string, from: Day, to: Day, type: FinType = "expense"): Promise<Map<string, number>> {
  const rows = await db.select({
    id: finTransactions.categoryId,
    total: sql<number>`sum(${finTransactions.amountCents})::float8`,
  }).from(finTransactions)
    .where(and(eq(finTransactions.userId, userId), eq(finTransactions.type, type), gte(finTransactions.date, from), lte(finTransactions.date, to)))
    .groupBy(finTransactions.categoryId);
  return new Map(rows.map((r) => [r.id ?? "", Number(r.total)]));
}

/** Soma das folhas na categoria de nível superior. */
export function rollUp(categories: Category[], leaves: Map<string, number>): Map<string, number> {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId ?? c.id]));
  const top = new Map<string, number>();
  for (const [id, total] of leaves) {
    const key = id === "" ? "" : (parentOf.get(id) ?? id);
    top.set(key, (top.get(key) ?? 0) + total);
  }
  return top;
}

export async function monthlySeries(userId: string, endMonth: Month, months: number) {
  const first = addMonths(endMonth, -(months - 1));
  const rows = await db.select({
    month: sql<string>`to_char(${finTransactions.date}, 'YYYY-MM')`,
    income: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'income'), 0)::float8`,
    expense: sql<number>`coalesce(sum(${finTransactions.amountCents}) filter (where ${finTransactions.type} = 'expense'), 0)::float8`,
  }).from(finTransactions)
    .where(and(eq(finTransactions.userId, userId), gte(finTransactions.date, `${first}-01`), lte(finTransactions.date, monthRange(endMonth).to)))
    .groupBy(sql`to_char(${finTransactions.date}, 'YYYY-MM')`);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(first, i);
    const row = byMonth.get(month);
    return { month, incomeCents: Number(row?.income ?? 0), expenseCents: Number(row?.expense ?? 0) };
  });
}

/* ---------- Orçamentos ---------- */

export async function listBudgets(userId: string): Promise<Map<string, number>> {
  const rows = await db.select().from(finBudgets).where(eq(finBudgets.userId, userId));
  return new Map(rows.map((r) => [r.categoryId, r.limitCents]));
}

export async function setBudget(userId: string, categoryId: string, limitCents: number | null): Promise<void> {
  const category = await assertCategory(userId, categoryId);
  if (category?.parentId || category?.type !== "expense") throw new UserError("O limite vale para categorias de despesa.");
  if (limitCents === null) {
    await db.delete(finBudgets).where(and(eq(finBudgets.userId, userId), eq(finBudgets.categoryId, categoryId)));
    return;
  }
  await db.insert(finBudgets).values({ userId, categoryId, limitCents })
    .onConflictDoUpdate({ target: [finBudgets.userId, finBudgets.categoryId], set: { limitCents, updatedAt: new Date() } });
}

/* ---------- Recorrentes ---------- */

export type Recurring = {
  id: string; type: FinType; kind: RecurringKind; name: string; amountCents: number; dayOfMonth: number;
  categoryId: string | null; accountId: string | null; payMethod: PayMethod; startsOn: Day; endsOn: Day | null; active: boolean;
};

export type RecurringInput = Omit<Recurring, "id">;

const toRecurring = (userId: string, row: typeof finRecurring.$inferSelect): Recurring => ({
  id: row.id, type: row.type, kind: row.kind, amountCents: row.amountCents, dayOfMonth: row.dayOfMonth, categoryId: row.categoryId,
  accountId: row.accountId, payMethod: row.payMethod, startsOn: row.startsOn, endsOn: row.endsOn, active: row.active,
  name: decrypt(row.nameEnc, userId, "fin.recurring.name"),
});

export async function listRecurring(userId: string): Promise<Recurring[]> {
  const rows = await db.select().from(finRecurring).where(eq(finRecurring.userId, userId)).orderBy(asc(finRecurring.dayOfMonth), asc(finRecurring.createdAt));
  return rows.map((r) => toRecurring(userId, r));
}

export async function createRecurring(userId: string, input: RecurringInput, today: Day): Promise<string> {
  await assertOwnedRefs(userId, input.accountId, input.categoryId);
  const [row] = await db.insert(finRecurring).values({
    userId, type: input.type, kind: input.kind, amountCents: input.amountCents, dayOfMonth: input.dayOfMonth,
    categoryId: input.categoryId, accountId: input.accountId, payMethod: input.payMethod,
    startsOn: input.startsOn, endsOn: input.endsOn, active: input.active,
    nameEnc: encrypt(input.name, userId, "fin.recurring.name"),
  }).returning({ id: finRecurring.id });
  if (!row) throw new Error("Falha ao criar a recorrente.");
  await ensureRecurringBills(today, userId);
  return row.id;
}

export async function updateRecurring(userId: string, id: string, input: RecurringInput, today: Day): Promise<boolean> {
  await assertOwnedRefs(userId, input.accountId, input.categoryId);
  const rows = await db.update(finRecurring).set({
    type: input.type, kind: input.kind, amountCents: input.amountCents, dayOfMonth: input.dayOfMonth,
    categoryId: input.categoryId, accountId: input.accountId, payMethod: input.payMethod,
    startsOn: input.startsOn, endsOn: input.endsOn, active: input.active,
    nameEnc: encrypt(input.name, userId, "fin.recurring.name"),
  }).where(and(eq(finRecurring.id, id), eq(finRecurring.userId, userId))).returning({ id: finRecurring.id });
  if (!rows.length) return false;
  // As contas abertas ainda não pagas refletem valor e dia novos; as pagas ficam como foram.
  await db.delete(finBills).where(and(eq(finBills.userId, userId), eq(finBills.recurringId, id), isNull(finBills.paidAt), gte(finBills.dueDate, `${today.slice(0, 7)}-01`)));
  await ensureRecurringBills(today, userId);
  return true;
}

export async function deleteRecurring(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(finRecurring).where(and(eq(finRecurring.id, id), eq(finRecurring.userId, userId))).returning({ id: finRecurring.id });
  return rows.length > 0;
}

/**
 * Cria as contas do mês corrente e do próximo a partir das recorrentes de despesa. Idempotente
 * (índice único recurring+vencimento): o worker repete à vontade e a tela também chama.
 * Sem `userId`, vale para todos os usuários (ciclo do worker).
 */
export async function ensureRecurringBills(today: Day, userId?: string): Promise<void> {
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  const next = `${addMonths(month, 1)}-01`;
  await db.execute(sql`
    INSERT INTO fin_bills (user_id, due_date, amount_cents, category_id, recurring_id)
    SELECT r.user_id, d.due, r.amount_cents, r.category_id, r.id
    FROM fin_recurring r
    CROSS JOIN LATERAL (
      SELECT (m.first + (LEAST(r.day_of_month, EXTRACT(DAY FROM (m.first + interval '1 month - 1 day'))::int) - 1))::date AS due
      FROM (VALUES (${first}::date), (${next}::date)) AS m(first)
    ) d
    WHERE r.active AND r.type = 'expense' AND d.due >= r.starts_on AND (r.ends_on IS NULL OR d.due <= r.ends_on)
    ${userId ? sql`AND r.user_id = ${userId}` : sql``}
    ON CONFLICT (recurring_id, due_date) DO NOTHING
  `);
}

/** Lembrete das 9h (fuso do usuário) no dia do vencimento, para as contas abertas que vencem por perto. */
export async function scheduleBillReminders(today: Day): Promise<void> {
  await db.execute(sql`
    INSERT INTO reminders (user_id, source, bill_id, date, time, lead_minutes, fire_at)
    SELECT b.user_id, 'bill', b.id, b.due_date, '09:00', 0,
           ((b.due_date + time '09:00') AT TIME ZONE COALESCE(s.timezone, 'America/Sao_Paulo'))
    FROM fin_bills b
    LEFT JOIN user_settings s ON s.user_id = b.user_id
    WHERE b.paid_at IS NULL
      AND b.due_date BETWEEN (${today}::date - 1) AND (${today}::date + 1)
      AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.bill_id = b.id)
  `);
}

/* ---------- Contas a pagar ---------- */

export type Bill = {
  id: string; dueDate: Day; amountCents: number; name: string; categoryId: string | null;
  recurringId: string | null; paidOn: Day | null; transactionId: string | null;
};

export async function listBills(userId: string, opts: { paid: boolean; from?: Day; to?: Day }): Promise<Bill[]> {
  const rows = await db.select({ bill: finBills, recurringName: finRecurring.nameEnc }).from(finBills)
    .leftJoin(finRecurring, eq(finRecurring.id, finBills.recurringId))
    .where(and(
      eq(finBills.userId, userId),
      opts.paid ? sql`${finBills.paidAt} is not null` : isNull(finBills.paidAt),
      opts.from ? gte(opts.paid ? finBills.paidOn : finBills.dueDate, opts.from) : undefined,
      opts.to ? lte(opts.paid ? finBills.paidOn : finBills.dueDate, opts.to) : undefined,
    ))
    .orderBy(opts.paid ? desc(finBills.paidOn) : asc(finBills.dueDate), asc(finBills.createdAt))
    .limit(500);
  return rows.map(({ bill, recurringName }) => ({
    id: bill.id, dueDate: bill.dueDate, amountCents: bill.amountCents, categoryId: bill.categoryId,
    recurringId: bill.recurringId, paidOn: bill.paidOn, transactionId: bill.transactionId,
    name: bill.nameEnc
      ? decrypt(bill.nameEnc, userId, "fin.bill.name")
      : recurringName ? decrypt(recurringName, userId, "fin.recurring.name") : "Conta",
  }));
}

export type BillInput = { name: string; amountCents: number; dueDate: Day; categoryId: string | null };

export async function createBill(userId: string, input: BillInput): Promise<string> {
  await assertCategory(userId, input.categoryId);
  const [row] = await db.insert(finBills).values({
    userId, dueDate: input.dueDate, amountCents: input.amountCents, categoryId: input.categoryId,
    nameEnc: encrypt(input.name, userId, "fin.bill.name"),
  }).returning({ id: finBills.id });
  if (!row) throw new Error("Falha ao criar a conta.");
  return row.id;
}

export async function updateBill(userId: string, id: string, input: BillInput): Promise<boolean> {
  await assertCategory(userId, input.categoryId);
  const rows = await db.update(finBills).set({
    dueDate: input.dueDate, amountCents: input.amountCents, categoryId: input.categoryId,
    nameEnc: encrypt(input.name, userId, "fin.bill.name"),
  }).where(and(eq(finBills.id, id), eq(finBills.userId, userId), isNull(finBills.paidAt))).returning({ id: finBills.id });
  // O lembrete antigo aponta para a data anterior; o ciclo cria outro.
  if (rows.length) await db.delete(reminders).where(and(eq(reminders.userId, userId), eq(reminders.billId, id), isNull(reminders.sentAt)));
  return rows.length > 0;
}

export async function deleteBill(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(finBills).where(and(eq(finBills.id, id), eq(finBills.userId, userId), isNull(finBills.paidAt))).returning({ id: finBills.id });
  return rows.length > 0;
}

/** Marca como pagas e lança a saída: na conta da recorrente ou, sem ela, na primeira conta ativa. */
export async function markBillsPaid(userId: string, ids: string[], today: Day, accountId?: string): Promise<number> {
  if (!ids.length) return 0;
  const fallback = accountId ?? (await listAccounts(userId))[0]?.id;
  if (!fallback) throw new UserError("Cadastre uma conta antes de pagar.");
  await assertOwnedRefs(userId, fallback, null);
  return db.transaction(async (tx) => {
    const rows = await tx.select({ bill: finBills, recurring: finRecurring }).from(finBills)
      .leftJoin(finRecurring, eq(finRecurring.id, finBills.recurringId))
      .where(and(eq(finBills.userId, userId), inArray(finBills.id, ids), isNull(finBills.paidAt)));
    for (const { bill, recurring } of rows) {
      const name = bill.nameEnc
        ? decrypt(bill.nameEnc, userId, "fin.bill.name")
        : recurring ? decrypt(recurring.nameEnc, userId, "fin.recurring.name") : "Conta";
      const [created] = await tx.insert(finTransactions).values({
        userId, type: "expense", amountCents: bill.amountCents, date: today,
        accountId: recurring?.accountId ?? fallback, categoryId: bill.categoryId ?? recurring?.categoryId ?? null,
        payMethod: recurring?.payMethod ?? "boleto", recurringId: bill.recurringId,
        descriptionEnc: encrypt(name, userId, "fin.tx.description"),
      }).returning({ id: finTransactions.id });
      await tx.update(finBills).set({ paidAt: new Date(), paidOn: today, transactionId: created?.id ?? null })
        .where(and(eq(finBills.id, bill.id), eq(finBills.userId, userId)));
      await tx.delete(reminders).where(and(eq(reminders.userId, userId), eq(reminders.billId, bill.id), isNull(reminders.sentAt)));
    }
    return rows.length;
  });
}

/** Desfaz o pagamento: apaga o lançamento criado e reabre a conta. */
export async function reopenBill(userId: string, id: string): Promise<boolean> {
  const [bill] = await db.select().from(finBills).where(and(eq(finBills.id, id), eq(finBills.userId, userId)));
  if (!bill?.paidAt) return false;
  if (bill.transactionId) return deleteTransaction(userId, bill.transactionId);
  await db.update(finBills).set({ paidAt: null, paidOn: null }).where(and(eq(finBills.id, id), eq(finBills.userId, userId)));
  return true;
}

export async function billsDueOn(userId: string, day: Day): Promise<{ id: string; name: string; amountCents: number }[]> {
  const bills = await listBills(userId, { paid: false, from: day, to: day });
  return bills.map((b) => ({ id: b.id, name: b.name, amountCents: b.amountCents }));
}

/** Para o aviso push: sem filtro de usuário porque o lembrete já pertence a ele; devolve nada se a conta foi paga. */
export async function getBillForReminder(id: string) {
  const [row] = await db.select({ bill: finBills, recurringName: finRecurring.nameEnc }).from(finBills)
    .leftJoin(finRecurring, eq(finRecurring.id, finBills.recurringId)).where(eq(finBills.id, id));
  if (!row || row.bill.paidAt) return null;
  const userId = row.bill.userId;
  const name = row.bill.nameEnc
    ? decrypt(row.bill.nameEnc, userId, "fin.bill.name")
    : row.recurringName ? decrypt(row.recurringName, userId, "fin.recurring.name") : "Conta";
  return { name, amountCents: row.bill.amountCents };
}

/** Tudo de Finanças, decifrado, para a exportação de dados da conta. */
export async function exportFinance(userId: string) {
  const [accounts, categories, transactions, budgets, recurring, bills] = await Promise.all([
    listAccounts(userId, true),
    listCategories(userId),
    db.select().from(finTransactions).where(eq(finTransactions.userId, userId)).orderBy(asc(finTransactions.date)),
    listBudgets(userId),
    listRecurring(userId),
    Promise.all([listBills(userId, { paid: false }), listBills(userId, { paid: true })]).then(([open, paid]) => [...open, ...paid]),
  ]);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  return {
    contas: accounts.map((a) => ({ nome: a.name, tipo: a.kind, saldoInicialCentavos: a.openingCents, arquivada: a.archived })),
    categorias: categories.map((c) => ({ nome: c.name, tipo: c.type, subcategoriaDe: c.parentId ? categoryName.get(c.parentId) ?? null : null, limiteMensalCentavos: budgets.get(c.id) ?? null })),
    lancamentos: transactions.map((t) => {
      const tx = toTx(userId, t);
      return {
        data: tx.date, tipo: tx.type, valorCentavos: tx.amountCents, descricao: tx.description, observacao: tx.note, pagamento: tx.payMethod,
        conta: accountName.get(tx.accountId) ?? null, categoria: tx.categoryId ? categoryName.get(tx.categoryId) ?? null : null,
      };
    }),
    recorrentes: recurring.map((r) => ({
      nome: r.name, tipo: r.type, grupo: r.kind, valorCentavos: r.amountCents, diaDoMes: r.dayOfMonth, inicio: r.startsOn, fim: r.endsOn, ativa: r.active,
      categoria: r.categoryId ? categoryName.get(r.categoryId) ?? null : null,
    })),
    contasAPagar: bills.map((b) => ({ nome: b.name, vencimento: b.dueDate, valorCentavos: b.amountCents, pagaEm: b.paidOn })),
  };
}
