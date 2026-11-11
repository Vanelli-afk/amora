import { addMonths, diffDays, type Day, type Month } from "@/lib/dates";
import { budgetState, dueInMonth, type Tone } from "@/lib/finance-meta";
import type { ColorId } from "@/lib/palette";
import {
  listAccounts, listBills, listBudgets, listCategories, listRecurring, listTransactions, monthlySeries, monthRange, periodTotals,
  rollUp, spendingByLeaf, type Bill, type Category, type Recurring, type Tx,
} from "./finance";

export type CategorySpend = { id: string; name: string; color: ColorId; icon: string; totalCents: number };
export type BudgetLine = CategorySpend & { limitCents: number; pct: number; tone: Tone; label: string };

/** Tudo o que o painel e as análises mostram, numa ida só ao banco por tela. */
export async function loadOverview(userId: string, month: Month, today: Day, alertPct: number) {
  const { from, to } = monthRange(month);
  const prev = monthRange(addMonths(month, -1));
  const [accounts, categories, totals, prevTotals, series, leaves, budgets, openBills, recent, recurring] = await Promise.all([
    listAccounts(userId),
    listCategories(userId),
    periodTotals(userId, from, to),
    periodTotals(userId, prev.from, prev.to),
    monthlySeries(userId, month, 12),
    spendingByLeaf(userId, from, to),
    listBudgets(userId),
    listBills(userId, { paid: false }),
    listTransactions(userId, { from, to }, 1, 7),
    listRecurring(userId),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const topTotals = rollUp(categories, leaves);

  const spending: CategorySpend[] = [...topTotals.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, totalCents]) => {
      const category = byId.get(id);
      return { id: id || "none", name: category?.name ?? "Sem categoria", color: category?.color ?? ("sand" as ColorId), icon: category?.icon ?? "grid", totalCents };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  const budgetLines: BudgetLine[] = categories
    .filter((c) => !c.parentId && c.type === "expense")
    .map((c) => {
      const used = topTotals.get(c.id) ?? 0;
      const limit = budgets.get(c.id) ?? 0;
      return { id: c.id, name: c.name, color: c.color, icon: c.icon, totalCents: used, limitCents: limit, ...budgetState(used, limit, alertPct) };
    })
    .filter((line) => line.limitCents > 0)
    .sort((a, b) => b.pct - a.pct);

  const incomeCents = totals.incomeCents;
  const expenseCents = totals.expenseCents;
  const savedCents = incomeCents - expenseCents;
  const savingsPct = incomeCents > 0 ? (savedCents / incomeCents) * 100 : 0;

  const overdue = openBills.filter((b) => b.dueDate < today);
  const nextCharges = upcomingCharges(recurring, today).slice(0, 5);

  return {
    month, today, accounts, categories, byId, totals, prevTotals, series, spending, budgetLines,
    balanceCents: accounts.reduce((s, a) => s + a.balanceCents, 0),
    incomeCents, expenseCents, savedCents, savingsPct,
    openBills, upcomingBills: openBills.slice(0, 5),
    openBillsTotal: openBills.reduce((s, b) => s + b.amountCents, 0),
    overdueCount: overdue.length,
    recent: recent.rows, recentTotal: recent.total,
    nextCharges,
    biggestMonth: [...series].sort((a, b) => b.expenseCents - a.expenseCents)[0] ?? null,
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;

/** Próxima cobrança de cada recorrente de despesa ativa, da mais próxima para a mais distante. */
export function upcomingCharges(recurring: Recurring[], today: Day): { recurring: Recurring; date: Day; inDays: number }[] {
  const month = today.slice(0, 7);
  return recurring
    .filter((r) => r.active && r.type === "expense" && (!r.endsOn || r.endsOn >= today))
    .map((r) => {
      const thisMonth = dueInMonth(month, r.dayOfMonth);
      const date = thisMonth >= today ? thisMonth : dueInMonth(addMonths(month, 1), r.dayOfMonth);
      return { recurring: r, date, inDays: diffDays(date, today) };
    })
    .filter((c) => !c.recurring.endsOn || c.date <= c.recurring.endsOn)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type { Bill, Category, Tx };
