import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { addDays } from "@/lib/dates";
import { ALL_WEEKDAYS, bestStreak, currentStreak, isScheduled, lastDays } from "@/lib/streak";

const { habits, habitLogs } = schema;

export type HabitView = {
  id: string;
  title: string;
  streak: number;
  /** Maior sequência dentro da janela de registros lida. */
  best: number;
  /** Dias da semana em que vale (bit 0 = domingo). */
  weekdays: number;
  doneToday: boolean;
  week: { day: string; done: boolean; isToday: boolean; scheduled: boolean }[];
};

// Sequências mais longas que isto não mudam a tela, só deixariam a consulta cara.
const STREAK_WINDOW_DAYS = 400;

export async function listHabits(userId: string, today: string): Promise<HabitView[]> {
  const rows = await db.select().from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
    .orderBy(asc(habits.createdAt));
  if (!rows.length) return [];

  const logs = await db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, addDays(today, -STREAK_WINDOW_DAYS))));
  const byHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!byHabit.has(log.habitId)) byHabit.set(log.habitId, new Set());
    byHabit.get(log.habitId)?.add(log.date);
  }

  return rows.map((row) => {
    const done = byHabit.get(row.id) ?? new Set<string>();
    return {
      id: row.id,
      title: decrypt(row.titleEnc, userId, "habit.title"),
      streak: currentStreak(done, today, row.weekdays),
      best: bestStreak(done, today, row.weekdays),
      weekdays: row.weekdays,
      doneToday: done.has(today),
      week: lastDays(done, today).map((d) => ({ ...d, scheduled: isScheduled(row.weekdays, d.day) })),
    };
  });
}

export async function createHabit(userId: string, title: string, weekdays: number = ALL_WEEKDAYS): Promise<string> {
  const [row] = await db.insert(habits).values({ userId, titleEnc: encrypt(title, userId, "habit.title"), weekdays })
    .returning({ id: habits.id });
  if (!row) throw new Error("Falha ao criar o hábito.");
  return row.id;
}

/** Renomeia e/ou troca os dias do hábito. O histórico de dias feitos não muda. */
export async function updateHabit(userId: string, id: string, patch: { title?: string; weekdays?: number }): Promise<boolean> {
  const values = {
    ...(patch.title !== undefined ? { titleEnc: encrypt(patch.title, userId, "habit.title") } : {}),
    ...(patch.weekdays !== undefined ? { weekdays: patch.weekdays } : {}),
  };
  if (!Object.keys(values).length) return true;
  const rows = await db.update(habits).set(values)
    .where(and(eq(habits.id, id), eq(habits.userId, userId))).returning({ id: habits.id });
  return rows.length > 0;
}

export async function archiveHabit(userId: string, id: string): Promise<boolean> {
  const rows = await db.update(habits).set({ archivedAt: new Date() })
    .where(and(eq(habits.id, id), eq(habits.userId, userId))).returning({ id: habits.id });
  return rows.length > 0;
}

export async function setHabitDone(userId: string, id: string, date: string, done: boolean): Promise<boolean> {
  const [habit] = await db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  if (!habit) return false;
  if (done) {
    await db.insert(habitLogs).values({ habitId: id, userId, date }).onConflictDoNothing();
  } else {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, id), eq(habitLogs.userId, userId), eq(habitLogs.date, date)));
  }
  return true;
}
