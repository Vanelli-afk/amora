import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt } from "@/lib/crypto";
import { formatDayMonth } from "@/lib/dates";
import { formatSigned } from "@/lib/money";
import { bodyToText, matchesQuery, preview } from "@/lib/notes";
import { speciesLabel } from "@/lib/pet-meta";
import { listTransactions } from "./finance";
import { listPets } from "./pets";

export type SearchHit = {
  kind: "evento" | "tarefa" | "nota" | "livro" | "dia" | "lançamento" | "pet";
  title: string;
  subtitle: string;
  href: string;
};

const MAX_RESULTS = 30;
const SCAN_LIMIT = 5000;

/**
 * Os textos estão cifrados, então o banco não pode buscá-los: decifra os itens do próprio
 * usuário em memória. Uma fonte por vez e parando ao encher os resultados, para não carregar
 * e decifrar tudo de uma vez. O limite por usuário fica na action.
 */
export async function searchEverything(userId: string, query: string): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const full = () => hits.length >= MAX_RESULTS;

  const { events, tasks, notes, books, bookQuotes, dayEntries } = schema;

  const eventRows = await db.select({
    id: events.id, date: events.date, startTime: events.startTime,
    titleEnc: events.titleEnc, locationEnc: events.locationEnc, notesEnc: events.notesEnc,
  }).from(events).where(eq(events.userId, userId)).orderBy(desc(events.date)).limit(SCAN_LIMIT);
  for (const row of eventRows) {
    if (full()) return hits;
    const title = decrypt(row.titleEnc, userId, "event.title");
    const location = decryptOpt(row.locationEnc, userId, "event.location") ?? "";
    const notesText = decryptOpt(row.notesEnc, userId, "event.notes") ?? "";
    if (matchesQuery(`${title} ${location} ${notesText}`, query)) {
      hits.push({
        kind: "evento",
        title,
        subtitle: `${formatDayMonth(row.date)}${row.startTime ? ` · ${row.startTime}` : ""}`,
        href: `/dia/${row.date}?evento=${row.id}&data=${row.date}`,
      });
    }
  }

  const taskRows = await db.select({ date: tasks.date, titleEnc: tasks.titleEnc }).from(tasks)
    .where(eq(tasks.userId, userId)).orderBy(desc(tasks.updatedAt)).limit(SCAN_LIMIT);
  for (const row of taskRows) {
    if (full()) return hits;
    const title = decrypt(row.titleEnc, userId, "task.title");
    if (matchesQuery(title, query)) {
      hits.push({
        kind: "tarefa",
        title,
        subtitle: row.date ? formatDayMonth(row.date) : "sem data",
        href: row.date ? `/dia/${row.date}` : "/tarefas",
      });
    }
  }

  const noteRows = await db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.updatedAt)).limit(SCAN_LIMIT);
  for (const row of noteRows) {
    if (full()) return hits;
    const title = decryptOpt(row.titleEnc, userId, "note.title");
    const text = bodyToText(row.kind, decrypt(row.bodyEnc, userId, "note.body"));
    const tags = decryptOpt(row.tagsEnc, userId, "note.tags") ?? "";
    if (matchesQuery(`${title ?? ""} ${text} ${tags}`, query)) {
      hits.push({ kind: "nota", title: title ?? preview(text, 60), subtitle: title ? preview(text, 70) : "post-it", href: `/notas/${row.id}` });
    }
  }

  const bookRows = await db.select({ id: books.id, title: books.title, author: books.author, reviewEnc: books.reviewEnc }).from(books)
    .where(eq(books.userId, userId)).limit(SCAN_LIMIT);
  for (const row of bookRows) {
    if (full()) return hits;
    const review = decryptOpt(row.reviewEnc, userId, "book.review") ?? "";
    if (matchesQuery(`${row.title} ${row.author ?? ""} ${review}`, query)) {
      hits.push({ kind: "livro", title: row.title, subtitle: row.author ?? "", href: `/livros/${row.id}` });
    }
  }

  const quoteRows = await db.select({ bookId: bookQuotes.bookId, textEnc: bookQuotes.textEnc, title: books.title }).from(bookQuotes)
    .innerJoin(books, and(eq(bookQuotes.bookId, books.id), eq(books.userId, userId)))
    .where(eq(bookQuotes.userId, userId)).limit(SCAN_LIMIT);
  for (const row of quoteRows) {
    if (full()) return hits;
    const text = decrypt(row.textEnc, userId, "book.quote");
    if (matchesQuery(text, query)) {
      hits.push({ kind: "livro", title: preview(text, 70), subtitle: `citação de ${row.title}`, href: `/livros/${row.bookId}` });
    }
  }

  const dayRows = await db.select({ date: dayEntries.date, gratitudeEnc: dayEntries.gratitudeEnc, reflectionEnc: dayEntries.reflectionEnc }).from(dayEntries)
    .where(eq(dayEntries.userId, userId)).orderBy(desc(dayEntries.date)).limit(SCAN_LIMIT);
  for (const row of dayRows) {
    if (full()) return hits;
    const gratitude = decryptOpt(row.gratitudeEnc, userId, "day.gratitude") ?? "";
    const reflection = decryptOpt(row.reflectionEnc, userId, "day.reflection") ?? "";
    const text = `${gratitude} ${reflection}`.trim();
    if (text && matchesQuery(text, query)) {
      hits.push({ kind: "dia", title: formatDayMonth(row.date), subtitle: preview(text, 70), href: `/dia/${row.date}` });
    }
  }

  if (!full()) {
    const found = await listTransactions(userId, { q: query }, 1, 5);
    for (const t of found.rows) {
      if (full()) return hits;
      hits.push({ kind: "lançamento", title: t.description, subtitle: `${formatDayMonth(t.date)} · ${formatSigned(t.amountCents, t.type)}`, href: `/financas?lancamento=${t.id}` });
    }
  }

  if (!full()) {
    for (const pet of await listPets(userId)) {
      if (full()) return hits;
      if (matchesQuery(`${pet.name} ${pet.breed ?? ""} ${pet.notes ?? ""}`, query)) {
        hits.push({ kind: "pet", title: pet.name, subtitle: [speciesLabel(pet.species), pet.breed].filter(Boolean).join(" · "), href: `/pets/${pet.id}` });
      }
    }
  }

  return hits;
}
