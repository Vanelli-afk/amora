import { and, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";
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
  /** Preenchido nos compromissos de um pet. */
  petId: string | null;
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
  petId?: string | null;
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
    petId: row.petId,
  };
}

const compare = (a: EventOccurrence, b: EventOccurrence) =>
  a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title);

/** Compromissos que podem cair em [from, to] e os dias que as exceções tiraram das séries. */
async function loadSeries(userId: string, from: string, to: string) {
  const rows = await db.select().from(events).where(and(
    eq(events.userId, userId),
    lte(events.date, to),
    or(gte(events.date, from), isNotNull(events.recurrence)),
  ));
  const skippedBy = new Map<string, Set<string>>();
  const recurringIds = rows.filter((r) => r.recurrence).map((r) => r.id);
  if (!recurringIds.length) return { rows, skippedBy };

  const skips = await db.select().from(eventExceptions).where(and(
    eq(eventExceptions.userId, userId),
    inArray(eventExceptions.eventId, recurringIds),
    gte(eventExceptions.date, from),
    lte(eventExceptions.date, to),
  ));
  for (const skip of skips) {
    if (!skippedBy.has(skip.eventId)) skippedBy.set(skip.eventId, new Set());
    skippedBy.get(skip.eventId)?.add(skip.date);
  }
  return { rows, skippedBy };
}

type Series = Awaited<ReturnType<typeof loadSeries>>;

const expand = (userId: string, { rows, skippedBy }: Series, from: string, to: string) => rows
  .flatMap((row) => occurrences(row.date, row.recurrence, from, to, skippedBy.get(row.id))
    .map((date) => toOccurrence(userId, row, date)))
  .sort(compare);

export async function listOccurrences(userId: string, from: string, to: string): Promise<EventOccurrence[]> {
  return expand(userId, await loadSeries(userId, from, to), from, to);
}

/**
 * Os compromissos de um dia e os dias marcados do mês em volta, numa só ida ao banco.
 * `date` precisa estar dentro de [from, to]. Só os textos do dia são decifrados.
 */
export async function listDayWithMonthMarks(userId: string, date: string, from: string, to: string) {
  const series = await loadSeries(userId, from, to);
  const marked = new Set<string>();
  for (const row of series.rows) {
    for (const day of occurrences(row.date, row.recurrence, from, to, series.skippedBy.get(row.id))) marked.add(day);
  }
  return { occurrences: expand(userId, series, date, date), marked };
}

/** Só os dias com compromisso, para marcar calendários: não decifra nenhum texto. */
export async function listOccurrenceDays(userId: string, from: string, to: string): Promise<Set<string>> {
  const rows = await db.select({ id: events.id, date: events.date, recurrence: events.recurrence }).from(events).where(and(
    eq(events.userId, userId),
    lte(events.date, to),
    or(gte(events.date, from), isNotNull(events.recurrence)),
  ));
  const recurringIds = rows.filter((r) => r.recurrence).map((r) => r.id);
  const skips = recurringIds.length
    ? await db.select().from(eventExceptions).where(and(
        eq(eventExceptions.userId, userId),
        inArray(eventExceptions.eventId, recurringIds),
        gte(eventExceptions.date, from),
        lte(eventExceptions.date, to),
      ))
    : [];
  const days = new Set<string>();
  for (const row of rows) {
    const skipped = new Set(skips.filter((s) => s.eventId === row.id).map((s) => s.date));
    for (const day of occurrences(row.date, row.recurrence, from, to, skipped)) days.add(day);
  }
  return days;
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
    petId: input.petId ?? null,
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
    await createEvent(userId, { ...input, recurrence: null, petId: row.petId });
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
