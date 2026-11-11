import { and, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt } from "@/lib/crypto";
import { addDays, todayIn } from "@/lib/dates";
import type { Rule } from "@/lib/recurrence";
import { formatBRL } from "@/lib/money";
import { listOccurrences } from "./events";
import { ensureRecurringBills, getBillForReminder, scheduleBillReminders } from "./finance";
import type { Sender } from "./push";
import { syncEventReminder } from "./reminders";
import { nextLocalTime } from "./settings";

const { reminders, userSettings, tasks, events } = schema;

// Pior caso de um ciclo: 100 / 10 × 10 s de timeout = 100 s, abaixo do maxDuration da rota do cron.
const BATCH = 100;
const CONCURRENCY = 10;

/** Cada item falha sozinho. Registra só o tipo do erro: a mensagem pode trazer dados do usuário. */
async function forEachIsolated<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  const queue = items.values();
  const runner = async () => {
    for (const item of queue) {
      try {
        await work(item);
      } catch (error) {
        console.error(`[notificacoes] falha em um item: ${error instanceof Error ? error.name : "erro"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, runner));
}

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
  const present = <T,>(values: (T | null)[]) => [...new Set(values.filter((v): v is T => v !== null))];
  const userIds = present(rows.map((r) => r.userId));
  const taskIds = present(rows.map((r) => r.taskId));
  const eventIds = present(rows.map((r) => r.eventId));
  const [prefRows, taskRows, eventRows] = await Promise.all([
    db.select({ userId: userSettings.userId, notifyEvents: userSettings.notifyEvents }).from(userSettings).where(inArray(userSettings.userId, userIds)),
    taskIds.length ? db.select().from(tasks).where(inArray(tasks.id, taskIds)) : [],
    eventIds.length ? db.select().from(events).where(inArray(events.id, eventIds)) : [],
  ]);
  const prefsByUser = new Map(prefRows.map((p) => [p.userId, p]));
  const taskById = new Map(taskRows.map((t) => [t.id, t]));
  const eventById = new Map(eventRows.map((e) => [e.id, e]));

  await forEachIsolated(rows, async (reminder) => {
    const prefs = prefsByUser.get(reminder.userId);
    const url = `/dia/${reminder.date}`;
    const when = `${leadText(reminder.leadMinutes)} · ${reminder.time}`;

    if (reminder.source === "standalone") {
      const title = reminder.titleEnc ? decrypt(reminder.titleEnc, reminder.userId, "reminder.title") : "Lembrete";
      await send(reminder.userId, { title, body: `Lembrete · ${reminder.time}`, url });
      return;
    }

    if (reminder.source === "bill" && reminder.billId) {
      const bill = await getBillForReminder(reminder.billId);
      if (bill && prefs?.notifyEvents !== false) {
        await send(reminder.userId, { title: "Conta a pagar", body: `${bill.name} · ${formatBRL(bill.amountCents)} vence hoje`, url: "/financas/contas" });
      }
      return;
    }

    if (reminder.source === "task" && reminder.taskId) {
      const task = taskById.get(reminder.taskId);
      if (task && !task.done && prefs?.notifyEvents !== false) {
        await send(reminder.userId, { title: decrypt(task.titleEnc, reminder.userId, "task.title"), body: when, url });
      }
      return;
    }

    if (reminder.source === "event" && reminder.eventId) {
      const event = eventById.get(reminder.eventId);
      if (!event) return;
      try {
        if (prefs?.notifyEvents !== false) {
          await send(reminder.userId, { title: decrypt(event.titleEnc, reminder.userId, "event.title"), body: when, url });
        }
      } finally {
        // Série: agenda a próxima ocorrência mesmo se este aviso falhar, ou a série ficaria muda.
        if (event.recurrence) {
          await syncEventReminder(reminder.userId, { ...event, recurrence: event.recurrence as Rule }, addDays(reminder.date, 1));
        }
      }
    }
  });
  return rows.length;
}

/**
 * Reivindica os resumos vencidos e já grava o próximo horário, antes de enviar: outro worker
 * não repete o envio, e uma falha no meio custa um resumo, nunca os dos dias seguintes.
 */
async function claimDigest(column: "next_morning_at" | "next_evening_at", timeColumn: "morning_time" | "evening_time", now: Date) {
  return db.transaction(async (tx) => {
    const due = await tx.execute<{ user_id: string; timezone: string; time: string }>(sql`
      SELECT user_id, timezone, ${sql.raw(timeColumn)} AS time FROM user_settings
      WHERE ${sql.raw(column)} IS NOT NULL AND ${sql.raw(column)} <= ${now.toISOString()}::timestamptz
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    `);
    if (!due.rows.length) return [];
    const ids = due.rows.map((row) => row.user_id).join(",");
    const times = due.rows.map((row) => nextLocalTime(row.time, row.timezone, now).toISOString()).join(",");
    await tx.execute(sql`
      UPDATE user_settings s SET ${sql.raw(column)} = v.next_at
      FROM unnest(string_to_array(${ids}, ','), string_to_array(${times}, ',')::timestamptz[]) AS v(user_id, next_at)
      WHERE s.user_id = v.user_id
    `);
    return due.rows;
  });
}

export async function processDigests(now: Date, send: Sender): Promise<void> {
  await forEachIsolated(await claimDigest("next_morning_at", "morning_time", now), async (row) => {
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
  });

  await forEachIsolated(await claimDigest("next_evening_at", "evening_time", now), async (row) => {
    await send(row.user_id, { title: "Reflexão da noite", body: "Como foi o seu dia? O que você aprendeu?", url: "/hoje" });
  });
}

/** Um ciclo de envio: o mesmo para o worker local e para a rota do cron. */
export async function runNotificationCycle(now: Date, send: Sender): Promise<number> {
  // Contas recorrentes e seus avisos nascem aqui, para não depender de alguém abrir o app.
  // O dia em UTC basta: as duas rotinas olham o mês atual, o próximo e uma folga de um dia.
  const utcDay = now.toISOString().slice(0, 10);
  for (const step of [ensureRecurringBills, scheduleBillReminders]) {
    try {
      await step(utcDay);
    } catch (error) {
      console.error(`[notificacoes] falha nas contas a pagar: ${error instanceof Error ? error.name : "erro"}`);
    }
  }
  const sent = await processDueReminders(now, send);
  await processDigests(now, send);
  return sent;
}

export async function cleanup(now: Date): Promise<void> {
  await db.delete(schema.verification).where(lte(schema.verification.expiresAt, now));
  await db.delete(schema.session).where(lte(schema.session.expiresAt, now));
  await db.delete(reminders).where(and(isNotNull(reminders.sentAt), lte(reminders.sentAt, new Date(now.getTime() - 90 * 86_400_000))));
  await db.delete(schema.actionLimits).where(lte(schema.actionLimits.windowStart, new Date(now.getTime() - 86_400_000)));
  await db.delete(schema.rateLimit).where(lte(schema.rateLimit.lastRequest, now.getTime() - 86_400_000));
}
