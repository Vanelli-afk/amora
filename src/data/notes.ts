import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, decryptOpt, encrypt, encryptOpt } from "@/lib/crypto";
import { bodyToText, preview } from "@/lib/notes";

const { notes } = schema;

export type NoteColor = "y" | "p" | "m" | "b" | "l" | "paper";
export type NoteKind = "postit" | "note";

export type NoteSummary = {
  id: string;
  kind: NoteKind;
  color: NoteColor;
  pinned: boolean;
  date: string | null;
  title: string | null;
  text: string;
  preview: string;
  tags: string[];
  updatedAt: string;
};

export type Note = NoteSummary & { body: string };

type Row = typeof notes.$inferSelect;

function toNote(userId: string, row: Row): Note {
  const body = decrypt(row.bodyEnc, userId, "note.body");
  const tagsJson = decryptOpt(row.tagsEnc, userId, "note.tags");
  const text = bodyToText(row.kind, body);
  return {
    id: row.id,
    kind: row.kind,
    color: row.color,
    pinned: row.pinned,
    date: row.date,
    title: decryptOpt(row.titleEnc, userId, "note.title"),
    text,
    preview: preview(text),
    body,
    tags: tagsJson ? (JSON.parse(tagsJson) as string[]) : [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

function withoutBody(note: Note): NoteSummary {
  const summary: Partial<Note> = { ...note };
  delete summary.body;
  return summary as NoteSummary;
}

export async function listNotes(userId: string, limit = 500): Promise<NoteSummary[]> {
  const rows = await db.select().from(notes).where(eq(notes.userId, userId))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt)).limit(limit);
  return rows.map((row) => withoutBody(toNote(userId, row)));
}

export async function listDayNotes(userId: string, date: string): Promise<NoteSummary[]> {
  const rows = await db.select().from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.date, date)))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt)).limit(6);
  return rows.map((row) => withoutBody(toNote(userId, row)));
}

export async function getNote(userId: string, id: string): Promise<Note | null> {
  const [row] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return row ? toNote(userId, row) : null;
}

export type NoteInput = {
  kind: NoteKind;
  color: NoteColor;
  date: string | null;
  title: string | null;
  body: string;
  tags: string[];
};

const encryptFields = (userId: string, input: Pick<NoteInput, "title" | "body" | "tags">) => ({
  titleEnc: encryptOpt(input.title, userId, "note.title"),
  bodyEnc: encrypt(input.body, userId, "note.body"),
  tagsEnc: input.tags.length ? encrypt(JSON.stringify(input.tags), userId, "note.tags") : null,
});

export async function createNote(userId: string, input: NoteInput): Promise<string> {
  const [row] = await db.insert(notes).values({
    userId, kind: input.kind, color: input.color, date: input.date, ...encryptFields(userId, input),
  }).returning({ id: notes.id });
  if (!row) throw new Error("Falha ao criar a nota.");
  return row.id;
}

export async function updateNote(userId: string, id: string, input: Omit<NoteInput, "kind" | "date">): Promise<boolean> {
  const rows = await db.update(notes).set({ color: input.color, ...encryptFields(userId, input) })
    .where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  return rows.length > 0;
}

export async function setNotePinned(userId: string, id: string, pinned: boolean): Promise<boolean> {
  const rows = await db.update(notes).set({ pinned })
    .where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  return rows.length > 0;
}

export async function deleteNote(userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).returning({ id: notes.id });
  return rows.length > 0;
}
