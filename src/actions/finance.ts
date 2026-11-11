"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAccount, createBill, createCategory, createRecurring, createTransaction, deleteBill, deleteCategory, deleteRecurring,
  deleteTransaction, ensureFinanceDefaults, getTransaction, listAccounts, listCategories, markBillsPaid, removeAccount, reopenBill, setBudget, updateAccount,
  updateBill, updateCategory, updateRecurring, updateTransaction,
} from "@/data/finance";
import { getSettings, updateSettings } from "@/data/settings";
import { defineAction, UserError } from "@/lib/action";
import { addMonths, todayIn } from "@/lib/dates";
import { zColor, zDay, zId } from "@/lib/validation";

const MAX_CENTS = 2_000_000_000; // limite da coluna integer: R$ 20 milhões

const cents = z.number().int("Valor inválido.").min(1, "Informe um valor maior que zero.").max(MAX_CENTS, "Valor alto demais.");
const finType = z.enum(["expense", "income"]);
const payMethod = z.enum(["pix", "debit", "credit", "boleto", "transfer", "cash", "auto_debit"]);
const name = (message: string) => z.string().trim().min(1, message).max(120, "Nome longo demais.");
const note = z.string().max(500, "Observação longa demais.").transform((v) => (v.trim() ? v : null)).nullable();

const txInput = z.object({
  type: finType,
  amountCents: cents,
  date: zDay,
  accountId: zId,
  categoryId: zId.nullable(),
  payMethod,
  description: name("Descreva o lançamento."),
  note,
});
const newTxInput = txInput.extend({ repeatMonthly: z.boolean().default(false) });

const recurringInput = z.object({
  type: finType,
  kind: z.enum(["fixed", "tuition", "subscription"]),
  name: name("Dê um nome."),
  amountCents: cents,
  dayOfMonth: z.number().int().min(1, "Dia inválido.").max(31, "Dia inválido."),
  categoryId: zId.nullable(),
  accountId: zId.nullable(),
  payMethod,
  startsOn: zDay,
  endsOn: zDay.nullable(),
  active: z.boolean(),
});

const accountInput = z.object({
  name: name("Dê um nome à conta."),
  kind: z.enum(["checking", "savings", "wallet", "card"]),
  openingCents: z.number().int().min(-MAX_CENTS).max(MAX_CENTS),
});

const categoryInput = z.object({
  name: name("Dê um nome à categoria."),
  color: zColor,
  icon: z.string().max(16),
  type: finType,
  parentId: zId.nullable(),
});

const billInput = z.object({
  name: name("Dê um nome à conta."),
  amountCents: cents,
  dueDate: zDay,
  categoryId: zId.nullable(),
});

const goalsInput = z.object({
  budgetAlertPct: z.number().int().min(50, "Escolha entre 50% e 100%.").max(100, "Escolha entre 50% e 100%."),
  savingsGoalPct: z.number().int().min(0, "Escolha entre 0% e 90%.").max(90, "Escolha entre 0% e 90%."),
});

const todayFor = async (userId: string) => todayIn((await getSettings(userId)).timezone);
const refresh = () => revalidatePath("/", "layout");
function missing(): never {
  throw new UserError("Não encontrado.");
}

const LIMIT = { limit: { max: 120, windowSeconds: 60 } };

/** Primeira visita: cria a conta e as categorias iniciais. Idempotente. */
export const prepareFinance = defineAction("fin.prepare", z.object({}), async (_, { userId }) => {
  await ensureFinanceDefaults(userId);
});

/** Contas e categorias para os formulários que abrem sobre qualquer tela. */
export const financeOptions = defineAction("fin.options", z.object({}), async (_, { userId }) => {
  await ensureFinanceDefaults(userId);
  const [accounts, categories] = await Promise.all([listAccounts(userId), listCategories(userId)]);
  return {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, openingCents: a.openingCents, balanceCents: a.balanceCents })),
    categories: categories.map((c) => ({ id: c.id, parentId: c.parentId, type: c.type, name: c.name, color: c.color, icon: c.icon })),
  };
});

export const addTransaction = defineAction("fin.tx.add", newTxInput, async ({ repeatMonthly, ...input }, { userId }) => {
  const id = await createTransaction(userId, input);
  if (repeatMonthly) {
    const today = await todayFor(userId);
    // A recorrência começa no mês seguinte: este lançamento já cobre o mês corrente.
    await createRecurring(userId, {
      type: input.type, kind: "fixed", name: input.description, amountCents: input.amountCents,
      dayOfMonth: Number(input.date.slice(8, 10)),
      categoryId: input.categoryId, accountId: input.accountId, payMethod: input.payMethod,
      startsOn: `${addMonths(input.date.slice(0, 7), 1)}-01`, endsOn: null, active: true,
    }, today);
  }
  refresh();
  return id;
}, LIMIT);

export const loadTransaction = defineAction("fin.tx.load", z.object({ id: zId }), async ({ id }, { userId }) => {
  return (await getTransaction(userId, id)) ?? missing();
});

export const saveTransaction = defineAction("fin.tx.save", z.object({ id: zId, input: txInput }), async ({ id, input }, { userId }) => {
  if (!(await updateTransaction(userId, id, input))) missing();
  refresh();
}, LIMIT);

export const removeTransaction = defineAction("fin.tx.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteTransaction(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveAccount = defineAction("fin.account.save", z.object({ id: zId.nullable(), input: accountInput }), async ({ id, input }, { userId }) => {
  if (id) {
    if (!(await updateAccount(userId, id, input))) missing();
  } else {
    await createAccount(userId, input);
  }
  refresh();
}, LIMIT);

export const deleteAccount = defineAction("fin.account.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await removeAccount(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveCategory = defineAction("fin.category.save", z.object({ id: zId.nullable(), input: categoryInput }), async ({ id, input }, { userId }) => {
  if (id) {
    if (!(await updateCategory(userId, id, input))) missing();
  } else {
    await createCategory(userId, input);
  }
  refresh();
}, LIMIT);

export const removeCategory = defineAction("fin.category.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteCategory(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveBudget = defineAction("fin.budget.save", z.object({ categoryId: zId, limitCents: cents.nullable() }), async ({ categoryId, limitCents }, { userId }) => {
  await setBudget(userId, categoryId, limitCents);
  refresh();
}, LIMIT);

export const saveRecurring = defineAction("fin.recurring.save", z.object({ id: zId.nullable(), input: recurringInput }), async ({ id, input }, { userId }) => {
  const today = await todayFor(userId);
  if (id) {
    if (!(await updateRecurring(userId, id, input, today))) missing();
  } else {
    await createRecurring(userId, input, today);
  }
  refresh();
}, LIMIT);

export const removeRecurring = defineAction("fin.recurring.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteRecurring(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveBill = defineAction("fin.bill.save", z.object({ id: zId.nullable(), input: billInput }), async ({ id, input }, { userId }) => {
  if (id) {
    if (!(await updateBill(userId, id, input))) missing();
  } else {
    await createBill(userId, input);
  }
  refresh();
}, LIMIT);

export const removeBill = defineAction("fin.bill.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await deleteBill(userId, id))) missing();
  refresh();
}, LIMIT);

export const payBills = defineAction("fin.bill.pay", z.object({ ids: z.array(zId).min(1, "Escolha uma conta.").max(100) }), async ({ ids }, { userId }) => {
  const paid = await markBillsPaid(userId, ids, await todayFor(userId));
  refresh();
  return paid;
}, LIMIT);

export const unpayBill = defineAction("fin.bill.reopen", z.object({ id: zId }), async ({ id }, { userId }) => {
  if (!(await reopenBill(userId, id))) missing();
  refresh();
}, LIMIT);

export const saveFinanceGoals = defineAction("fin.goals", goalsInput, async (input, { userId }) => {
  await updateSettings(userId, input);
  refresh();
});
