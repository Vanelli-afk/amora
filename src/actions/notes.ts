"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createNote, deleteNote, setNotePinned, updateNote } from "@/data/notes";
import { defineAction, UserError } from "@/lib/action";
import { sanitizeDoc } from "@/lib/notes";
import { zId, zNoteColor, zOptionalDay } from "@/lib/validation";

const MAX_BODY = 200_000;

const tags = z.array(z.string().trim().min(1).max(30)).max(12);
const title = z.string().trim().max(200).transform((v) => v || null).nullable();

function cleanBody(kind: "postit" | "note", body: string): string {
  if (kind === "postit") return body.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new UserError("Não foi possível salvar a nota.");
  }
  const doc = sanitizeDoc(parsed);
  if (!doc) throw new UserError("Não foi possível salvar a nota.");
  return JSON.stringify(doc);
}

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export const addNote = defineAction("note.create", z.object({
  kind: z.enum(["postit", "note"]),
  color: zNoteColor,
  date: zOptionalDay,
  title,
  body: z.string().max(MAX_BODY),
  tags,
}), async (input, { userId }) => {
  if (input.kind === "postit" && !input.body.trim()) throw new UserError("Escreva algo no post-it.");
  const body = input.kind === "note" && !input.body ? EMPTY_DOC : cleanBody(input.kind, input.body);
  const id = await createNote(userId, { ...input, body });
  revalidatePath("/", "layout");
  return id;
});

export const saveNote = defineAction("note.update", z.object({
  id: zId,
  kind: z.enum(["postit", "note"]),
  color: zNoteColor,
  title,
  body: z.string().max(MAX_BODY),
  tags,
}), async ({ id, kind, ...input }, { userId }) => {
  const found = await updateNote(userId, id, { ...input, body: cleanBody(kind, input.body) });
  if (!found) throw new UserError("Nota não encontrada.");
  // Sem revalidar: é salvamento automático; a lista se atualiza ao clicar em "Pronto".
});

export const pinNote = defineAction("note.pin", z.object({ id: zId, pinned: z.boolean() }), async ({ id, pinned }, { userId }) => {
  await setNotePinned(userId, id, pinned);
  revalidatePath("/", "layout");
});

export const removeNote = defineAction("note.delete", z.object({ id: zId }), async ({ id }, { userId }) => {
  await deleteNote(userId, id);
  revalidatePath("/", "layout");
});

export const refreshNotes = defineAction("note.refresh", z.object({}), async () => {
  revalidatePath("/", "layout");
});
