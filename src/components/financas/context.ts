import { ensureFinanceDefaults, type Account, type Category } from "@/data/finance";
import { getSettings } from "@/data/settings";
import { isValidMonth, todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import type { Options } from "./forms";

/** Início comum das telas de Finanças: sessão, padrões da primeira visita, hoje e o mês pedido. */
export async function financeContext(rawMonth?: string | string[]) {
  const user = await requireUser();
  await ensureFinanceDefaults(user.id);
  const settings = await getSettings(user.id);
  const today = todayIn(settings.timezone);
  const asked = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;
  const month = asked && isValidMonth(asked) ? asked : today.slice(0, 7);
  return { userId: user.id, settings, today, month };
}

export const toOptions = (accounts: Account[], categories: Category[]): Options => ({
  accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, openingCents: a.openingCents, balanceCents: a.balanceCents })),
  categories: categories.map((c) => ({ id: c.id, parentId: c.parentId, type: c.type, name: c.name, color: c.color, icon: c.icon })),
});
