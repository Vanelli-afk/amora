import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookDetail } from "@/components/livros/book-detail";
import { getBook, listQuotes, readingStreak } from "@/data/books";
import { getSettings } from "@/data/settings";
import { todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Livro" };

export default async function LivroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const settings = await getSettings(user.id);
  const [book, quotes, streak] = await Promise.all([
    getBook(user.id, id),
    listQuotes(user.id, id),
    readingStreak(user.id, todayIn(settings.timezone), settings.pagesGoal),
  ]);
  if (!book) notFound();

  return <BookDetail key={book.id} book={book} quotes={quotes} pagesGoal={settings.pagesGoal} streak={streak} />;
}
