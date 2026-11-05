import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt } from "@/lib/crypto";
import { formatDayMonth } from "@/lib/dates";
import { bodyToText, matchesQuery, preview } from "@/lib/notes";
import { listAllEventsForSearch } from "./events";

export type SearchHit = {
  kind: "evento" | "tarefa" | "nota" | "livro" | "dia";
  title: string;
  subtitle: string;
  href: string;
};

const MAX_RESULTS = 30;
const SCAN_LIMIT = 5000;

/**
 * Os textos estão cifrados, então o banco não pode buscá-los: decifra os itens do próprio
 * usuário em memória. Barato para um diário pessoal, e o limite por usuário fica na action.
 */
export async function searchEverything(userId: string, query: string): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const add = (hit: SearchHit) => {
    if (hits.length < MAX_RESULTS) hits.push(hit);
  };

  const [events, tasks, notes, books, days, quotes] = await Promise.all([
    listAllEventsForSearch(userId),
    db.select().from(schema.tasks).where(eq(schema.tasks.userId, userId)).orderBy(desc(schema.tasks.updatedAt)).limit(SCAN_LIMIT),
    db.select().from(schema.notes).where(eq(schema.notes.userId, userId)).orderBy(desc(schema.notes.updatedAt)).limit(SCAN_LIMIT),
    db.select().from(schema.books).where(eq(schema.books.userId, userId)).limit(SCAN_LIMIT),
    db.select().from(schema.dayEntries).where(eq(schema.dayEntries.userId, userId)).orderBy(desc(schema.dayEntries.date)).limit(SCAN_LIMIT),
    db.select({ quote: schema.bookQuotes, title: schema.books.title }).from(schema.bookQuotes)
      .innerJoin(schema.books, and(eq(schema.bookQuotes.bookId, schema.books.id), eq(schema.books.userId, userId)))
      .where(eq(schema.bookQuotes.userId, userId)).limit(SCAN_LIMIT),
  ]);

  for (const event of [...events].reverse()) {
    if (matchesQuery(`${event.title} ${event.location ?? ""} ${event.notes ?? ""}`, query)) {
      add({
        kind: "evento",
        title: event.title,
        subtitle: `${formatDayMonth(event.date)}${event.startTime ? ` · ${event.startTime}` : ""}`,
        href: `/dia/${event.date}?evento=${event.id}&data=${event.date}`,
      });
    }
  }

  for (const row of tasks) {
    const title = decrypt(row.titleEnc, userId, "task.title");
    if (matchesQuery(title, query)) {
      add({
        kind: "tarefa",
        title,
        subtitle: row.date ? formatDayMonth(row.date) : "sem data",
        href: row.date ? `/dia/${row.date}` : "/tarefas",
      });
    }
  }

  for (const row of notes) {
    const title = decryptOpt(row.titleEnc, userId, "note.title");
    const text = bodyToText(row.kind, decrypt(row.bodyEnc, userId, "note.body"));
    const tags = decryptOpt(row.tagsEnc, userId, "note.tags") ?? "";
    if (matchesQuery(`${title ?? ""} ${text} ${tags}`, query)) {
      add({ kind: "nota", title: title ?? preview(text, 60), subtitle: title ? preview(text, 70) : "post-it", href: `/notas/${row.id}` });
    }
  }

  for (const row of books) {
    const review = decryptOpt(row.reviewEnc, userId, "book.review") ?? "";
    if (matchesQuery(`${row.title} ${row.author ?? ""} ${review}`, query)) {
      add({ kind: "livro", title: row.title, subtitle: row.author ?? "", href: `/livros/${row.id}` });
    }
  }

  for (const { quote, title } of quotes) {
    const text = decrypt(quote.textEnc, userId, "book.quote");
    if (matchesQuery(text, query)) {
      add({ kind: "livro", title: preview(text, 70), subtitle: `citação de ${title}`, href: `/livros/${quote.bookId}` });
    }
  }

  for (const row of days) {
    const gratitude = decryptOpt(row.gratitudeEnc, userId, "day.gratitude") ?? "";
    const reflection = decryptOpt(row.reflectionEnc, userId, "day.reflection") ?? "";
    const text = `${gratitude} ${reflection}`;
    if (text.trim() && matchesQuery(text, query)) {
      add({ kind: "dia", title: formatDayMonth(row.date), subtitle: preview(text.trim(), 70), href: `/dia/${row.date}` });
    }
  }

  return hits;
}
