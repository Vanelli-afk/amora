import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";
import { addDays, localToUtc, todayIn } from "@/lib/dates";

export type Settings = typeof schema.userSettings.$inferSelect;
export type SettingsPatch = Partial<Pick<Settings,
  "theme" | "timezone" | "stepGoal" | "waterGoal" | "waterStepMl" | "sleepGoalMinutes" | "pagesGoal" | "booksGoal" | "budgetAlertPct" | "savingsGoalPct" |
  "notifyEvents" | "notifyMorning" | "morningTime" | "notifyEvening" | "eveningTime"
>>;

export async function getSettings(userId: string): Promise<Settings> {
  const [row] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  if (row) return row;
  const [created] = await db.insert(schema.userSettings).values({ userId })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: { userId } })
    .returning();
  if (!created) throw new Error("Falha ao criar as preferências.");
  return created;
}

/**
 * Para desenhar páginas: o layout e a página pedem as mesmas configurações e aqui viram uma
 * leitura só por requisição. Ações usam `getSettings`: depois de gravar, a página refeita na
 * mesma requisição precisa ler o valor novo, não o que ficou guardado.
 */
export const getPageSettings = cache(getSettings);

/** Próximo instante em que o relógio local do usuário marca `time`. */
export function nextLocalTime(time: string, timezone: string, now: Date = new Date()): Date {
  const today = todayIn(timezone, now);
  const candidate = localToUtc(today, time, timezone);
  return candidate > now ? candidate : localToUtc(addDays(today, 1), time, timezone);
}

export async function updateSettings(userId: string, patch: SettingsPatch): Promise<Settings> {
  const current = await getSettings(userId);
  const merged = { ...current, ...patch };
  const [updated] = await db.update(schema.userSettings).set({
    ...patch,
    nextMorningAt: merged.notifyMorning ? nextLocalTime(merged.morningTime, merged.timezone) : null,
    nextEveningAt: merged.notifyEvening ? nextLocalTime(merged.eveningTime, merged.timezone) : null,
  }).where(eq(schema.userSettings.userId, userId)).returning();
  if (!updated) throw new Error("Preferências não encontradas.");
  return updated;
}
