import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt } from "@/lib/crypto";
import { addDays, todayIn } from "@/lib/dates";
import type { Rule } from "@/lib/recurrence";
import { listOccurrences } from "./events";
import type { Sender } from "./push";
import { syncEventReminder } from "./reminders";
import { nextLocalTime } from "./settings";

const { reminders, userSettings, tasks, events } = schema;

const BATCH = 200;

function leadText(minutes: number): string {
  if (minutes <= 0) return "Agora";
  if (minutes < 60) return `Em ${minutes} min`;
  if (minutes < 1440) return `Em ${Math.round(minutes / 60)} h`;
  return `Em ${Math.round(minutes / 1440)} dia(s)`;
}

/**
 * Reivindica os lembretes vencidos num só UPDATE com SKIP LOCKED: dois workers nunca pegam
 * o mesmo. Se o envio falhar depois disso, o lembrete não reenvia; repetir seria pior.
 */
export async function processDueReminders(now: Date, send: Sender): Promise<number> {
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE reminders SET sent_at = ${now.toISOString()}::timestamptz
    WHERE id IN (
      SELECT id FROM reminders
      WHERE sent_at IS NULL AND fire_at <= ${now.toISOString()}::timestamptz
      ORDER BY fire_at
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const ids = claimed.rows.map((r) => r.id);
  if (!ids.length) return 0;

  const rows = await db.select().from(reminders).where(inArray(reminders.id, ids));
  for (const reminder of rows) {
    const [prefs] = await db.select({ notifyEvents: userSettings.notifyEvents }).from(userSettings)
      .where(eq(userSettings.userId, reminder.userId));
    const url = `/dia/${reminder.date}`;
    const when = `${leadText(reminder.leadMinutes)} · ${reminder.time}`;

    if (reminder.source === "standalone") {
      const title = reminder.titleEnc ? decrypt(reminder.titleEnc, reminder.userId, "reminder.title") : "Lembrete";
      await send(reminder.userId, { title, body: `Lembrete · ${reminder.time}`, url });
      continue;
    }

    if (reminder.source === "task" && reminder.taskId) {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, reminder.taskId));
      if (task && !task.done && prefs?.notifyEvents !== false) {
        await send(reminder.userId, { title: decrypt(task.titleEnc, reminder.userId, "task.title"), body: when, url });
      }
      continue;
    }

    if (reminder.source === "event" && reminder.eventId) {
      const [event] = await db.select().from(events).where(eq(events.id, reminder.eventId));
      if (!event) continue;
      if (prefs?.notifyEvents !== false) {
        await send(reminder.userId, { title: decrypt(event.titleEnc, reminder.userId, "event.title"), body: when, url });
      }
      // Série: agenda a próxima ocorrência.
      if (event.recurrence) {
        await syncEventReminder(reminder.userId, { ...event, recurrence: event.recurrence as Rule }, addDays(reminder.date, 1));
      }
    }
  }
  return rows.length;
}

async function claimDigest(column: "next_morning_at" | "next_evening_at", now: Date) {
  // Avança o horário no mesmo UPDATE que seleciona: outro worker não envia de novo.
  const result = await db.execute<{ user_id: string; timezone: string; morning_time: string; evening_time: string }>(sql`
    WITH due AS (
      SELECT user_id FROM user_settings
      WHERE ${sql.raw(column)} IS NOT NULL AND ${sql.raw(column)} <= ${now.toISOString()}::timestamptz
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE user_settings s SET ${sql.raw(column)} = NULL
    FROM due WHERE s.user_id = due.user_id
    RETURNING s.user_id, s.timezone, s.morning_time, s.evening_time
  `);
  return result.rows;
}

export async function processDigests(now: Date, send: Sender): Promise<void> {
  for (const row of await claimDigest("next_morning_at", now)) {
    const today = todayIn(row.timezone, now);
    const occurrences = await listOccurrences(row.user_id, today, today);
    const [pending] = await db.select({ total: sql<number>`count(*)::int` }).from(tasks)
      .where(and(eq(tasks.userId, row.user_id), eq(tasks.date, today), eq(tasks.done, false)));
    const first = occurrences.find((o) => o.startTime);
    const parts = [
      occurrences.length ? `${occurrences.length} compromisso(s)` : "Agenda livre",
      `${pending?.total ?? 0} tarefa(s)`,
    ];
    await send(row.user_id, {
      title: "Bom dia! O seu dia:",
      body: `${parts.join(" · ")}${first ? `. Primeiro: ${first.startTime} ${first.title}` : ""}`,
      url: "/hoje",
    });
    await db.update(userSettings).set({ nextMorningAt: nextLocalTime(row.morning_time, row.timezone, now) })
      .where(eq(userSettings.userId, row.user_id));
  }

  for (const row of await claimDigest("next_evening_at", now)) {
    await send(row.user_id, { title: "Reflexão da noite", body: "Como foi o seu dia? O que você aprendeu?", url: "/hoje" });
    await db.update(userSettings).set({ nextEveningAt: nextLocalTime(row.evening_time, row.timezone, now) })
      .where(eq(userSettings.userId, row.user_id));
  }
}

export async function cleanup(now: Date): Promise<void> {
  await db.delete(schema.verification).where(lte(schema.verification.expiresAt, now));
  await db.delete(schema.session).where(lte(schema.session.expiresAt, now));
  await db.delete(reminders).where(and(isNotNull(reminders.sentAt), lte(reminders.sentAt, new Date(now.getTime() - 90 * 86_400_000))));
  await db.delete(schema.actionLimits).where(lte(schema.actionLimits.windowStart, new Date(now.getTime() - 86_400_000)));
  await db.delete(schema.rateLimit).where(lte(schema.rateLimit.lastRequest, now.getTime() - 86_400_000));
}
