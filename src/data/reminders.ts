import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { localToUtc, todayIn } from "@/lib/dates";
import { nextOccurrence, type Rule } from "@/lib/recurrence";
import { getSettings } from "./settings";

const { reminders, eventExceptions } = schema;

export type StandaloneReminder = { id: string; date: string; time: string; title: string; sent: boolean };

export async function createStandaloneReminder(userId: string, input: { title: string; date: string; time: string }) {
  const { timezone } = await getSettings(userId);
  const [row] = await db.insert(reminders).values({
    userId,
    source: "standalone",
    date: input.date,
    time: input.time,
    fireAt: localToUtc(input.date, input.time, timezone),
    titleEnc: encrypt(input.title, userId, "reminder.title"),
  }).returning({ id: reminders.id });
  return row?.id;
}

export async function listStandaloneReminders(userId: string, date: string): Promise<StandaloneReminder[]> {
  const rows = await db.select().from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.source, "standalone"), eq(reminders.date, date)))
    .orderBy(asc(reminders.time));
  return rows.map((r) => ({
    id: r.id, date: r.date, time: r.time, sent: r.sentAt !== null,
    title: r.titleEnc ? decrypt(r.titleEnc, userId, "reminder.title") : "",
  }));
}

export async function deleteStandaloneReminder(userId: string, id: string) {
  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId), eq(reminders.source, "standalone")));
}

/** Mantém um único lembrete pendente: o da próxima ocorrência do compromisso. */
export async function syncEventReminder(userId: string, event: {
  id: string; date: string; startTime: string | null; reminderMinutes: number | null; recurrence: Rule | null;
}, after?: string) {
  await db.delete(reminders).where(and(eq(reminders.userId, userId), eq(reminders.eventId, event.id), isNull(reminders.sentAt)));
  if (event.reminderMinutes === null || !event.startTime) return;

  const { timezone } = await getSettings(userId);
  const exceptions = await db.select({ date: eventExceptions.date }).from(eventExceptions)
    .where(and(eq(eventExceptions.userId, userId), eq(eventExceptions.eventId, event.id)));
  const next = nextOccurrence(event.date, event.recurrence, after ?? todayIn(timezone), new Set(exceptions.map((e) => e.date)));
  if (!next) return;

  const fireAt = new Date(localToUtc(next, event.startTime, timezone).getTime() - event.reminderMinutes * 60_000);
  await db.insert(reminders).values({
    userId, source: "event", eventId: event.id, date: next, time: event.startTime, leadMinutes: event.reminderMinutes, fireAt,
  });
}

export async function syncTaskReminder(userId: string, task: {
  id: string; date: string | null; dueTime: string | null; reminderMinutes: number | null | undefined;
}) {
  // undefined = o formulário não mexeu no lembrete.
  if (task.reminderMinutes === undefined) return;
  await db.delete(reminders).where(and(eq(reminders.userId, userId), eq(reminders.taskId, task.id), isNull(reminders.sentAt)));
  if (task.reminderMinutes === null || !task.date || !task.dueTime) return;
  const { timezone } = await getSettings(userId);
  const fireAt = new Date(localToUtc(task.date, task.dueTime, timezone).getTime() - task.reminderMinutes * 60_000);
  await db.insert(reminders).values({
    userId, source: "task", taskId: task.id, date: task.date, time: task.dueTime, leadMinutes: task.reminderMinutes, fireAt,
  });
}

export async function getTaskReminderMinutes(userId: string, taskId: string): Promise<number | null> {
  const [row] = await db.select({ lead: reminders.leadMinutes }).from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.taskId, taskId), isNull(reminders.sentAt)));
  return row?.lead ?? null;
}

/** Recalcula os lembretes pendentes depois de uma troca de fuso. */
export async function reschedulePending(userId: string, timezone: string) {
  const pending = await db.select().from(reminders).where(and(eq(reminders.userId, userId), isNull(reminders.sentAt)));
  if (!pending.length) return;
  const times = pending.map((r) => new Date(localToUtc(r.date, r.time, timezone).getTime() - r.leadMinutes * 60_000).toISOString());
  await db.execute(sql`
    UPDATE reminders r SET fire_at = v.fire_at
    FROM unnest(string_to_array(${pending.map((p) => p.id).join(",")}, ',')::uuid[], string_to_array(${times.join(",")}, ',')::timestamptz[]) AS v(id, fire_at)
    WHERE r.id = v.id AND r.user_id = ${userId}
  `);
}

export async function removeEventReminders(userId: string, eventIds: string[]) {
  if (!eventIds.length) return;
  await db.delete(reminders).where(and(eq(reminders.userId, userId), inArray(reminders.eventId, eventIds), isNull(reminders.sentAt)));
}
