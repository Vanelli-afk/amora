import { and, asc, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { syncTaskReminder } from "./reminders";

const { tasks } = schema;

export type Task = {
  id: string;
  date: string | null;
  dueTime: string | null;
  done: boolean;
  doneAt: string | null;
  highlight: boolean;
  title: string;
};

type Row = typeof tasks.$inferSelect;

const toTask = (userId: string, row: Row): Task => ({
  id: row.id,
  date: row.date,
  dueTime: row.dueTime,
  done: row.done,
  doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  highlight: row.highlight,
  title: decrypt(row.titleEnc, userId, "task.title"),
});

/** Tarefas do dia; hoje também mostra as atrasadas, para nada se perder. */
export async function listTasksForDay(userId: string, date: string, today: string): Promise<Task[]> {
  const dayFilter = date === today
    ? or(eq(tasks.date, date), and(lte(tasks.date, date), eq(tasks.done, false)))
    : eq(tasks.date, date);
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), dayFilter))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));
  return rows.map((row) => toTask(userId, row));
}

export async function listOpenTasks(userId: string): Promise<Task[]> {
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.done, false)))
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
    .limit(1000);
  return rows.map((row) => toTask(userId, row));
}

export async function listRecentDone(userId: string, limit = 30): Promise<Task[]> {
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.done, true), isNotNull(tasks.doneAt)))
    .orderBy(desc(tasks.doneAt))
    .limit(limit);
  return rows.map((row) => toTask(userId, row));
}

export async function countByDay(userId: string, from: string, to: string) {
  const rows = await db.select({
    date: tasks.date,
    total: sql<number>`count(*)::int`,
    done: sql<number>`count(*) filter (where ${tasks.done})::int`,
  }).from(tasks)
    .where(and(eq(tasks.userId, userId), sql`${tasks.date} between ${from} and ${to}`))
    .groupBy(tasks.date);
  return new Map(rows.map((r) => [r.date as string, { total: r.total, done: r.done }]));
}

export async function getTask(userId: string, id: string): Promise<Task | null> {
  const [row] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return row ? toTask(userId, row) : null;
}

export type TaskInput = {
  title: string;
  date: string | null;
  dueTime: string | null;
  highlight: boolean;
  reminderMinutes?: number | null;
};

export async function createTask(userId: string, input: TaskInput): Promise<Task> {
  const [{ next } = { next: 1 }] = await db.select({ next: sql<number>`coalesce(max(${tasks.position}), 0) + 1` })
    .from(tasks).where(eq(tasks.userId, userId));
  const [row] = await db.insert(tasks).values({
    userId,
    date: input.date,
    dueTime: input.dueTime,
    highlight: input.highlight,
    position: next,
    titleEnc: encrypt(input.title, userId, "task.title"),
  }).returning();
  if (!row) throw new Error("Falha ao criar a tarefa.");
  await syncTaskReminder(userId, { ...row, reminderMinutes: input.reminderMinutes });
  return toTask(userId, row);
}

export async function updateTask(userId: string, id: string, input: TaskInput): Promise<boolean> {
  const [row] = await db.update(tasks).set({
    date: input.date,
    dueTime: input.dueTime,
    highlight: input.highlight,
    titleEnc: encrypt(input.title, userId, "task.title"),
  }).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning();
  if (!row) return false;
  await syncTaskReminder(userId, { ...row, reminderMinutes: input.reminderMinutes });
  return true;
}

export async function setTaskDone(userId: string, id: string, done: boolean): Promise<boolean> {
  const rows = await db.update(tasks).set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning({ id: tasks.id });
  return rows.length > 0;
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).returning({ id: tasks.id });
  return rows.length > 0;
}

export async function clearDone(userId: string): Promise<void> {
  await db.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.done, true)));
}

/** Grava a nova ordem de um grupo e, se a tarefa mudou de grupo, a sua nova data. */
export async function reorderTasks(userId: string, orderedIds: string[], moved?: { id: string; date: string | null }) {
  const owned = await db.select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, orderedIds)));
  const ownedIds = new Set(owned.map((t) => t.id));
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      if (!ownedIds.has(id)) continue;
      await tx.update(tasks).set({ position }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    }
    if (moved && ownedIds.has(moved.id)) {
      await tx.update(tasks).set({ date: moved.date }).where(and(eq(tasks.id, moved.id), eq(tasks.userId, userId)));
    }
  });
}
