import type { IconName } from "@/components/ui/icon";
import { diffDays, type Day } from "./dates";
import type { Tone } from "./finance-meta";
import type { ColorId } from "./palette";

export type Species = "dog" | "cat" | "rabbit" | "other";
export const SPECIES: { id: Species; label: string }[] = [
  { id: "dog", label: "Cachorro" },
  { id: "cat", label: "Gato" },
  { id: "rabbit", label: "Coelho" },
  { id: "other", label: "Outro" },
];
export const speciesLabel = (id: Species) => SPECIES.find((s) => s.id === id)?.label ?? "Pet";

export type PetExpenseCategory = "food" | "vet" | "hygiene" | "medicine" | "accessories" | "other";
export const EXPENSE_CATEGORIES: { id: PetExpenseCategory; label: string; icon: IconName; color: ColorId }[] = [
  { id: "food", label: "Alimentação", icon: "bowl", color: "peach" },
  { id: "vet", label: "Veterinário", icon: "heart", color: "rose" },
  { id: "hygiene", label: "Higiene", icon: "bath", color: "sky" },
  { id: "medicine", label: "Medicamentos", icon: "pill", color: "sand" },
  { id: "accessories", label: "Acessórios", icon: "bag", color: "lav" },
  { id: "other", label: "Outros", icon: "star", color: "sage" },
];
export const expenseCategory = (id: PetExpenseCategory) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[5] as (typeof EXPENSE_CATEGORIES)[number];

export const ROUTINE_ICONS = ["bowl", "paw", "bath", "pill", "heart", "bell", "star"] as const satisfies readonly IconName[];
export const routineIcon = (key: string): IconName => (ROUTINE_ICONS as readonly string[]).includes(key) ? (key as IconName) : "paw";

/** "4 anos e 8 meses", "3 meses", "Recém-nascido": só meses completos, sem passar por Date. */
export function petAge(birth: Day | null, today: Day): string {
  if (!birth || birth > today) return "";
  const [by, bm, bd] = birth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 1) return "Recém-nascido";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years ? `${years} ${years === 1 ? "ano" : "anos"}` : "";
  const m = rest ? `${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return [y, m].filter(Boolean).join(" e ");
}

export const formatWeight = (grams: number | null) => (grams === null ? "" : `${(grams / 1000).toFixed(1).replace(".", ",")} kg`);

/** Aceita "12,4", "12.4" ou "12" (kg) e devolve gramas; null se inválido. */
export function parseWeightKg(input: string): number | null {
  const s = input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(s)) return null;
  const grams = Math.round(Number(s) * 1000);
  return grams > 0 && grams <= 250_000 ? grams : null;
}

/** Selo de um cuidado com data prevista: vencido, perto (até 14 dias) ou em dia. */
export function careBadge(next: Day | null, today: Day): { label: string; tone: Tone } {
  if (!next) return { label: "Sem data", tone: "" };
  const days = diffDays(next, today);
  if (days < 0) return { label: "Atrasado", tone: "bad" };
  if (days === 0) return { label: "Hoje", tone: "warn" };
  if (days === 1) return { label: "Amanhã", tone: "warn" };
  if (days <= 14) return { label: `Em ${days} dias`, tone: "warn" };
  return { label: "Em dia", tone: "ok" };
}

export const ALERT_WINDOW_DAYS = 14;

export function intervalLabel(days: number | null): string {
  if (!days) return "Avulso";
  if (days === 1) return "Todo dia";
  if (days === 7) return "Semanal";
  if (days === 15) return "Quinzenal";
  if (days === 30) return "Mensal";
  if (days === 90) return "A cada 3 meses";
  if (days === 180) return "A cada 6 meses";
  if (days === 365) return "Anual";
  return `A cada ${days} dias`;
}

export const INTERVALS = [
  { value: "", label: "Avulso" },
  { value: "7", label: "Semanal" },
  { value: "15", label: "Quinzenal" },
  { value: "30", label: "Mensal" },
  { value: "90", label: "A cada 3 meses" },
  { value: "180", label: "A cada 6 meses" },
  { value: "365", label: "Anual" },
] as const;
