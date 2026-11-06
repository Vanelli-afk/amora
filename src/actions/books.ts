"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addQuote, createBook, deleteBook, deleteQuote, setProgress, updateBook } from "@/data/books";
import { saveImage } from "@/data/files";
import { getSettings } from "@/data/settings";
import { defineAction, UserError } from "@/lib/action";
import { fetchCover, searchBooks } from "@/lib/book-search";
import { todayIn } from "@/lib/dates";
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE } from "@/lib/upload-limit";
import { zDay, zId, zText } from "@/lib/validation";

const shelf = z.enum(["reading", "next", "finished"]);
const title = z.string().trim().min(1, "Dê um título ao livro.").max(300);
const author = z.string().trim().max(200).transform((v) => v || null).nullable();
const pages = z.number().int().min(1).max(50_000).nullable();

const todayFor = async (userId: string) => todayIn((await getSettings(userId)).timezone);

export const findBooks = defineAction("book.search", z.object({ query: z.string().trim().min(2).max(120) }), async ({ query }) => {
  return searchBooks(query);
}, { limit: { max: 30, windowSeconds: 60 } });

export const addBookFromSearch = defineAction("book.addResult", z.object({
  title, author, pages,
  shelf,
  source: z.enum(["openlibrary", "google"]),
  coverRef: z.string().max(40).nullable(),
}), async (input, { userId }) => {
  let coverFileId: string | null = null;
  if (input.coverRef) {
    const image = await fetchCover(input.source, input.coverRef);
    if (image) {
      // Capa inválida não impede o cadastro: o livro fica com a capa gerada.
      coverFileId = await saveImage(userId, "cover", image).catch(() => null);
    }
  }
  const id = await createBook(userId, { title: input.title, author: input.author, pages: input.pages, shelf: input.shelf, coverFileId }, await todayFor(userId));
  revalidatePath("/", "layout");
  return id;
}, { limit: { max: 30, windowSeconds: 60 } });

function readCover(form: FormData): File | null {
  const file = form.get("capa");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError(UPLOAD_TOO_LARGE);
  return file;
}

export const addBookManual = defineAction("book.addManual", z.instanceof(FormData), async (form, { userId }) => {
  const rawPages = String(form.get("paginas") ?? "").trim();
  const parsed = z.object({ title, author, pages, shelf }).safeParse({
    title: form.get("titulo"),
    author: String(form.get("autor") ?? ""),
    pages: rawPages ? Number(rawPages) : null,
    shelf: form.get("prateleira"),
  });
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const cover = readCover(form);
  const coverFileId = cover ? await saveImage(userId, "cover", Buffer.from(await cover.arrayBuffer())) : null;
  const id = await createBook(userId, { ...parsed.data, coverFileId }, await todayFor(userId));
  revalidatePath("/", "layout");
  return id;
}, { limit: { max: 30, windowSeconds: 60 } });

export const changeCover = defineAction("book.cover", z.instanceof(FormData), async (form, { userId }) => {
  const id = zId.parse(form.get("id"));
  const cover = readCover(form);
  if (!cover) throw new UserError("Escolha uma imagem.");
  const coverFileId = await saveImage(userId, "cover", Buffer.from(await cover.arrayBuffer()));
  const found = await updateBook(userId, id, { coverFileId }, await todayFor(userId));
  if (!found) throw new UserError("Livro não encontrado.");
  revalidatePath("/", "layout");
}, { limit: { max: 20, windowSeconds: 60 } });

export const saveBook = defineAction("book.update", z.object({
  id: zId,
  patch: z.object({
    title: title.optional(),
    author: author.optional(),
    pages: pages.optional(),
    shelf: shelf.optional(),
    startedOn: zDay.nullable().optional(),
    finishedOn: zDay.nullable().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
  }),
}), async ({ id, patch }, { userId }) => {
  const found = await updateBook(userId, id, patch, await todayFor(userId));
  if (!found) throw new UserError("Livro não encontrado.");
  revalidatePath("/", "layout");
});

export const saveReview = defineAction("book.review", z.object({ id: zId, review: zText(20_000) }), async ({ id, review }, { userId }) => {
  await updateBook(userId, id, { review }, await todayFor(userId));
});

export const updateProgress = defineAction("book.progress", z.object({ id: zId, page: z.number().int().min(0).max(50_000) }), async ({ id, page }, { userId }) => {
  const found = await setProgress(userId, id, page, await todayFor(userId));
  if (!found) throw new UserError("Livro não encontrado.");
  revalidatePath("/", "layout");
});

export const removeBook = defineAction("book.delete", z.object({ id: zId }), async ({ id }, { userId }) => {
  await deleteBook(userId, id);
  revalidatePath("/", "layout");
});

export const addBookQuote = defineAction("quote.add", z.object({
  bookId: zId,
  text: z.string().trim().min(1, "Escreva a citação.").max(2000),
  page: z.number().int().min(1).max(50_000).nullable(),
}), async ({ bookId, text, page }, { userId }) => {
  const found = await addQuote(userId, bookId, text, page);
  if (!found) throw new UserError("Livro não encontrado.");
  revalidatePath("/", "layout");
});

export const removeQuote = defineAction("quote.delete", z.object({ id: zId }), async ({ id }, { userId }) => {
  await deleteQuote(userId, id);
  revalidatePath("/", "layout");
});
