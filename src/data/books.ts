import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { addDays } from "@/lib/dates";
import { currentStreak } from "@/lib/streak";
import { removeFile } from "./files";

const { books, bookQuotes, readingLogs } = schema;

export type Shelf = "reading" | "next" | "finished";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  pages: number | null;
  currentPage: number;
  shelf: Shelf;
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  coverFileId: string | null;
  coverStyle: number;
  review: string | null;
};

export type Quote = { id: string; text: string; page: number | null };

type Row = typeof books.$inferSelect;

const toBook = (userId: string, row: Row): Book => ({
  id: row.id,
  title: row.title,
  author: row.author,
  pages: row.pages,
  currentPage: row.currentPage,
  shelf: row.shelf,
  startedOn: row.startedOn,
  finishedOn: row.finishedOn,
  rating: row.rating,
  coverFileId: row.coverFileId,
  coverStyle: row.coverStyle,
  review: decryptOpt(row.reviewEnc, userId, "book.review"),
});

/** Mesmo livro, mesma capa gerada: o estilo vem do título. */
export function coverStyleFor(title: string): number {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return (hash % 10) + 1;
}

export async function listBooks(userId: string): Promise<Book[]> {
  const rows = await db.select().from(books).where(eq(books.userId, userId))
    .orderBy(desc(books.updatedAt)).limit(2000);
  return rows.map((row) => toBook(userId, row));
}

export async function getBook(userId: string, id: string): Promise<Book | null> {
  const [row] = await db.select().from(books).where(and(eq(books.id, id), eq(books.userId, userId)));
  return row ? toBook(userId, row) : null;
}

export type BookInput = {
  title: string;
  author: string | null;
  pages: number | null;
  shelf: Shelf;
  coverFileId?: string | null;
};

export async function createBook(userId: string, input: BookInput, today: string): Promise<string> {
  const [row] = await db.insert(books).values({
    userId,
    title: input.title,
    author: input.author,
    pages: input.pages,
    shelf: input.shelf,
    coverFileId: input.coverFileId ?? null,
    coverStyle: coverStyleFor(input.title),
    startedOn: input.shelf === "reading" || input.shelf === "finished" ? today : null,
    finishedOn: input.shelf === "finished" ? today : null,
    currentPage: input.shelf === "finished" ? input.pages ?? 0 : 0,
  }).returning({ id: books.id });
  if (!row) throw new Error("Falha ao adicionar o livro.");
  return row.id;
}

export type BookPatch = Partial<{
  title: string;
  author: string | null;
  pages: number | null;
  shelf: Shelf;
  startedOn: string | null;
  finishedOn: string | null;
  rating: number | null;
  review: string | null;
  coverFileId: string | null;
}>;

export async function updateBook(userId: string, id: string, patch: BookPatch, today: string): Promise<boolean> {
  const current = await getBook(userId, id);
  if (!current) return false;
  const { review, ...plain } = patch;
  const values: Partial<typeof books.$inferInsert> = { ...plain };
  if (review !== undefined) values.reviewEnc = encryptOpt(review, userId, "book.review");

  // Mudar de prateleira preenche as datas óbvias, sem apagar o que já foi informado.
  if (patch.shelf && patch.shelf !== current.shelf) {
    if (patch.shelf === "reading") {
      values.startedOn = patch.startedOn ?? current.startedOn ?? today;
      values.finishedOn = null;
    }
    if (patch.shelf === "finished") {
      values.startedOn = patch.startedOn ?? current.startedOn ?? today;
      values.finishedOn = patch.finishedOn ?? today;
      if (current.pages) values.currentPage = current.pages;
    }
  }

  await db.update(books).set(values).where(and(eq(books.id, id), eq(books.userId, userId)));
  if (patch.coverFileId !== undefined && current.coverFileId && current.coverFileId !== patch.coverFileId) {
    await removeFile(userId, current.coverFileId);
  }
  return true;
}

export async function deleteBook(userId: string, id: string): Promise<boolean> {
  const current = await getBook(userId, id);
  if (!current) return false;
  await db.delete(books).where(and(eq(books.id, id), eq(books.userId, userId)));
  if (current.coverFileId) await removeFile(userId, current.coverFileId);
  return true;
}

/** Atualiza a página e registra quantas foram lidas hoje. Voltar páginas não conta como leitura. */
export async function setProgress(userId: string, id: string, page: number, today: string): Promise<boolean> {
  const current = await getBook(userId, id);
  if (!current) return false;
  const safePage = current.pages ? Math.min(page, current.pages) : page;
  const delta = safePage - current.currentPage;

  await db.transaction(async (tx) => {
    await tx.update(books).set({ currentPage: safePage }).where(and(eq(books.id, id), eq(books.userId, userId)));
    if (delta > 0) {
      await tx.insert(readingLogs).values({ bookId: id, userId, date: today, pages: delta })
        .onConflictDoUpdate({
          target: [readingLogs.bookId, readingLogs.date],
          set: { pages: sql`${readingLogs.pages} + ${delta}` },
        });
    }
  });
  return true;
}

export async function listQuotes(userId: string, bookId: string): Promise<Quote[]> {
  const rows = await db.select().from(bookQuotes)
    .where(and(eq(bookQuotes.userId, userId), eq(bookQuotes.bookId, bookId)))
    .orderBy(asc(bookQuotes.page), asc(bookQuotes.createdAt));
  return rows.map((q) => ({ id: q.id, text: decrypt(q.textEnc, userId, "book.quote"), page: q.page }));
}

export async function latestQuote(userId: string): Promise<(Quote & { bookTitle: string }) | null> {
  const [row] = await db.select({ quote: bookQuotes, bookTitle: books.title }).from(bookQuotes)
    .innerJoin(books, eq(bookQuotes.bookId, books.id))
    .where(eq(bookQuotes.userId, userId))
    .orderBy(desc(bookQuotes.createdAt)).limit(1);
  if (!row) return null;
  return { id: row.quote.id, text: decrypt(row.quote.textEnc, userId, "book.quote"), page: row.quote.page, bookTitle: row.bookTitle };
}

export async function addQuote(userId: string, bookId: string, text: string, page: number | null): Promise<boolean> {
  const [book] = await db.select({ id: books.id }).from(books).where(and(eq(books.id, bookId), eq(books.userId, userId)));
  if (!book) return false;
  await db.insert(bookQuotes).values({ bookId, userId, page, textEnc: encrypt(text, userId, "book.quote") });
  return true;
}

export async function deleteQuote(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(bookQuotes).where(and(eq(bookQuotes.id, id), eq(bookQuotes.userId, userId))).returning({ id: bookQuotes.id });
  return rows.length > 0;
}

export async function pagesReadOn(userId: string, date: string): Promise<number> {
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${readingLogs.pages}), 0)::int` }).from(readingLogs)
    .where(and(eq(readingLogs.userId, userId), eq(readingLogs.date, date)));
  return row?.total ?? 0;
}

/** Dias seguidos atingindo a meta de páginas. */
export async function readingStreak(userId: string, today: string, goal: number): Promise<number> {
  const rows = await db.select({ date: readingLogs.date, total: sql<number>`sum(${readingLogs.pages})::int` }).from(readingLogs)
    .where(and(eq(readingLogs.userId, userId), gte(readingLogs.date, addDays(today, -400)), lte(readingLogs.date, today)))
    .groupBy(readingLogs.date);
  return currentStreak(new Set(rows.filter((r) => r.total >= goal).map((r) => r.date)), today);
}
