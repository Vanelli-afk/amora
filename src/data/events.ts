import { and, asc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { addDays, diffDays } from "@/lib/dates";
import { occurrences, type Rule } from "@/lib/recurrence";
import { syncEventReminder } from "./reminders";

const { events, eventExceptions } = schema;

export type Color = "sky" | "lav" | "peach" | "sage" | "rose" | "sand";

export type EventOccurrence = {
  id: string;
  /** Dia desta ocorrência; para séries, difere de seriesDate. */
  date: string;
  seriesDate: string;
  startTime: string | null;
  endTime: string | null;
  color: Color;
  title: string;
  location: string | null;
  notes: string | null;
  recurrence: Rule | null;
  reminderMinutes: number | null;
};

export type EventInput = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  color: Color;
  location: string | null;
  notes: string | null;
  recurrence: Rule | null;
  reminderMinutes: number | null;
};

type Row = typeof events.$inferSelect;

function toOccurrence(userId: string, row: Row, date: string): EventOccurrence {
  return {
    id: row.id,
    date,
    seriesDate: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    color: row.color,
    title: decrypt(row.titleEnc, userId, "event.title"),
    location: decryptOpt(row.locationEnc, userId, "event.location"),
    notes: decryptOpt(row.notesEnc, userId, "event.notes"),
    recurrence: row.recurrence ?? null,
    reminderMinutes: row.reminderMinutes,
  };
}

const compare = (a: EventOccurrence, b: EventOccurrence) =>
  a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title);

export async function listOccurrences(userId: string, from: string, to: string): Promise<EventOccurrence[]> {
  const rows = await db.select().from(events).where(and(
    eq(events.userId, userId),
    lte(events.date, to),
    or(gte(events.date, from), isNotNull(events.recurrence)),
  ));
  if (!rows.length) return [];

  const recurringIds = rows.filter((r) => r.recurrence).map((r) => r.id);
  const skips = recurringIds.length
    ? await db.select().from(eventExceptions).where(and(
        eq(eventExceptions.userId, userId),
        inArray(eventExceptions.eventId, recurringIds),
        gte(eventExceptions.date, from),
        lte(eventExceptions.date, to),
      ))
    : [];
  const skippedBy = new Map<string, Set<string>>();
  for (const skip of skips) {
    if (!skippedBy.has(skip.eventId)) skippedBy.set(skip.eventId, new Set());
    skippedBy.get(skip.eventId)?.add(skip.date);
  }

  return rows
    .flatMap((row) => occurrences(row.date, row.recurrence, from, to, skippedBy.get(row.id))
      .map((date) => toOccurrence(userId, row, date)))
    .sort(compare);
}

export async function getEvent(userId: string, id: string, occurrence?: string): Promise<EventOccurrence | null> {
  const [row] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  return row ? toOccurrence(userId, row, occurrence ?? row.date) : null;
}

const encryptFields = (userId: string, input: EventInput) => ({
  titleEnc: encrypt(input.title, userId, "event.title"),
  locationEnc: encryptOpt(input.location, userId, "event.location"),
  notesEnc: encryptOpt(input.notes, userId, "event.notes"),
});

export async function createEvent(userId: string, input: EventInput): Promise<string> {
  const [row] = await db.insert(events).values({
    userId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    color: input.color,
    recurrence: input.recurrence,
    reminderMinutes: input.reminderMinutes,
    ...encryptFields(userId, input),
  }).returning();
  if (!row) throw new Error("Falha ao criar o compromisso.");
  await syncEventReminder(userId, row);
  return row.id;
}

export type Scope = "this" | "all";

/**
 * "Só este" remove o dia da série e cria um compromisso avulso com a edição.
 * "Todos" muda a série inteira; trocar a data desloca o início na mesma medida.
 */
export async function updateEvent(userId: string, id: string, occurrence: string, scope: Scope, input: EventInput): Promise<boolean> {
  const [row] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  if (!row) return false;

  if (scope === "this" && row.recurrence) {
    await db.insert(eventExceptions).values({ eventId: id, userId, date: occurrence }).onConflictDoNothing();
    await syncEventReminder(userId, row);
    await createEvent(userId, { ...input, recurrence: null });
    return true;
  }

  const shifted = row.recurrence ? addDays(row.date, diffDays(input.date, occurrence)) : input.date;
  const [updated] = await db.update(events).set({
    date: shifted,
    startTime: input.startTime,
    endTime: input.endTime,
    color: input.color,
    recurrence: input.recurrence,
    reminderMinutes: input.reminderMinutes,
    ...encryptFields(userId, input),
  }).where(and(eq(events.id, id), eq(events.userId, userId))).returning();
  if (updated) await syncEventReminder(userId, updated);
  return Boolean(updated);
}

export async function deleteEvent(userId: string, id: string, occurrence: string, scope: Scope): Promise<boolean> {
  const [row] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  if (!row) return false;
  if (scope === "this" && row.recurrence) {
    await db.insert(eventExceptions).values({ eventId: id, userId, date: occurrence }).onConflictDoNothing();
    await syncEventReminder(userId, row);
    return true;
  }
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  return true;
}

export async function listAllEventsForSearch(userId: string) {
  const rows = await db.select().from(events).where(eq(events.userId, userId)).orderBy(asc(events.date)).limit(5000);
  return rows.map((row) => toOccurrence(userId, row, row.date));
}
