import type { IconName } from "@/components/ui/icon";
import { diffDays, type Day } from "./dates";
import type { ColorId } from "./palette";

// Fora de módulos "use client": Server Components também leem estas constantes.

export type PayMethod = "pix" | "debit" | "credit" | "boleto" | "transfer" | "cash" | "auto_debit";
export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "debit", label: "Débito" },
  { id: "credit", label: "Cartão de crédito" },
  { id: "boleto", label: "Boleto" },
  { id: "transfer", label: "Transferência" },
  { id: "cash", label: "Dinheiro" },
  { id: "auto_debit", label: "Débito automático" },
];
export const payLabel = (id: PayMethod) => PAY_METHODS.find((p) => p.id === id)?.label ?? id;

export type AccountKind = "checking" | "savings" | "wallet" | "card";
export const ACCOUNT_KINDS: { id: AccountKind; label: string }[] = [
  { id: "checking", label: "Conta corrente" },
  { id: "savings", label: "Poupança" },
  { id: "wallet", label: "Carteira" },
  { id: "card", label: "Cartão" },
];

export type RecurringKind = "fixed" | "tuition" | "subscription";
export const RECURRING_KINDS: { id: RecurringKind; label: string; plural: string }[] = [
  { id: "fixed", label: "Conta fixa", plural: "Contas fixas" },
  { id: "tuition", label: "Mensalidade", plural: "Mensalidades" },
  { id: "subscription", label: "Assinatura", plural: "Assinaturas" },
];

export const CATEGORY_ICONS = ["home", "fork", "heart", "car", "film", "book", "cart", "bolt", "drop", "briefcase", "wallet", "star", "paw", "pill", "shield", "coffee"] as const satisfies readonly IconName[];
export const categoryIcon = (key: string): IconName => (CATEGORY_ICONS as readonly string[]).includes(key) ? (key as IconName) : "grid";

export type DefaultCategory = { name: string; color: ColorId; icon: string; type: "expense" | "income"; subs: string[] };
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Moradia", color: "sky", icon: "home", type: "expense", subs: ["Aluguel", "Contas da casa", "Manutenção"] },
  { name: "Alimentação", color: "peach", icon: "fork", type: "expense", subs: ["Supermercado", "Restaurantes e delivery"] },
  { name: "Saúde", color: "sage", icon: "heart", type: "expense", subs: ["Plano de saúde", "Farmácia", "Coparticipação"] },
  { name: "Transporte", color: "lav", icon: "car", type: "expense", subs: ["Combustível", "App de transporte"] },
  { name: "Lazer", color: "rose", icon: "film", type: "expense", subs: ["Assinaturas", "Cinema", "Livraria"] },
  { name: "Educação", color: "sand", icon: "book", type: "expense", subs: ["Curso"] },
  { name: "Salário", color: "sage", icon: "briefcase", type: "income", subs: [] },
  { name: "Trabalho extra", color: "sky", icon: "briefcase", type: "income", subs: [] },
];

export type Tone = "ok" | "warn" | "bad" | "info" | "";

/** Estado do gasto de uma categoria frente ao limite: estoura em 100%, avisa a partir do limiar. */
export function budgetState(usedCents: number, limitCents: number, alertPct: number): { pct: number; tone: Tone; label: string } {
  const pct = limitCents > 0 ? Math.round((usedCents / limitCents) * 100) : 0;
  if (limitCents > 0 && usedCents > limitCents) return { pct, tone: "bad", label: "Limite estourado" };
  if (pct >= alertPct) return { pct, tone: "warn", label: "Perto do limite" };
  return { pct, tone: "ok", label: "Dentro do limite" };
}

/** Selo de uma conta a pagar: atrasada, hoje ou quantos dias faltam. */
export function billBadge(due: Day, today: Day, paid: boolean): { label: string; tone: Tone } {
  if (paid) return { label: "Paga", tone: "ok" };
  const days = diffDays(due, today);
  if (days < 0) return { label: "Atrasada", tone: "bad" };
  if (days === 0) return { label: "Vence hoje", tone: "warn" };
  if (days === 1) return { label: "Amanhã", tone: "warn" };
  if (days <= 3) return { label: `Em ${days} dias`, tone: "warn" };
  if (days <= 5) return { label: `Em ${days} dias`, tone: "info" };
  return { label: `Em ${days} dias`, tone: "" };
}

/** Dia do vencimento num mês, sem passar do último dia (dia 31 em fevereiro cai no 28/29). */
export function dueInMonth(month: string, dayOfMonth: number): Day {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}
