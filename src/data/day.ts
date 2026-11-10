import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { decryptOpt, encryptOpt } from "@/lib/crypto";

const { dayEntries } = schema;

export type DayEntry = {
  date: string;
  mood: number | null;
  waterMl: number;
  steps: number | null;
  sleepMinutes: number | null;
  sticker: "star" | "rainbow" | "moon" | null;
  gratitude: string;
  reflection: string;
};

export const emptyEntry = (date: string): DayEntry => ({
  date, mood: null, waterMl: 0, steps: null, sleepMinutes: null, sticker: null, gratitude: "", reflection: "",
});

function toEntry(userId: string, row: typeof dayEntries.$inferSelect): DayEntry {
  return {
    date: row.date,
    mood: row.mood,
    waterMl: row.waterMl,
    steps: row.steps,
    sleepMinutes: row.sleepMinutes,
    sticker: row.sticker,
    gratitude: decryptOpt(row.gratitudeEnc, userId, "day.gratitude") ?? "",
    reflection: decryptOpt(row.reflectionEnc, userId, "day.reflection") ?? "",
  };
}

export async function getDayEntry(userId: string, date: string): Promise<DayEntry> {
  const [row] = await db.select().from(dayEntries).where(and(eq(dayEntries.userId, userId), eq(dayEntries.date, date)));
  return row ? toEntry(userId, row) : emptyEntry(date);
}

export type DayPatch = Partial<Pick<DayEntry, "mood" | "waterMl" | "steps" | "sleepMinutes" | "sticker">> & {
  gratitude?: string | null;
  reflection?: string | null;
};

export async function saveDayEntry(userId: string, date: string, patch: DayPatch): Promise<void> {
  const { gratitude, reflection, ...plain } = patch;
  const values = {
    ...plain,
    ...(gratitude !== undefined ? { gratitudeEnc: encryptOpt(gratitude, userId, "day.gratitude") } : {}),
    ...(reflection !== undefined ? { reflectionEnc: encryptOpt(reflection, userId, "day.reflection") } : {}),
  };
  await db.insert(dayEntries).values({ userId, date, ...values })
    .onConflictDoUpdate({ target: [dayEntries.userId, dayEntries.date], set: values });
}

export async function listStickers(userId: string, from: string, to: string) {
  const rows = await db.select({ date: dayEntries.date, sticker: dayEntries.sticker }).from(dayEntries)
    .where(and(eq(dayEntries.userId, userId), gte(dayEntries.date, from), lte(dayEntries.date, to)));
  return new Map(rows.filter((r) => r.sticker).map((r) => [r.date, r.sticker]));
}
