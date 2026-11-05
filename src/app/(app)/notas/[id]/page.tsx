import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NoteEditor } from "@/components/notas/note-editor";
import { NotesBoard } from "@/components/notas/notes-board";
import { getNote, listNotes } from "@/data/notes";
import { getSettings } from "@/data/settings";
import { relativeDay, timeIn, todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Nota" };

export default async function NotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const [{ timezone }, notes, note] = await Promise.all([getSettings(user.id), listNotes(user.id), getNote(user.id, id)]);
  if (!note) notFound();

  const today = todayIn(timezone);
  const updated = new Date(note.updatedAt);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(updated);
  const label = `Editada ${relativeDay(day, today)}, ${timeIn(timezone, updated)}`;

  return (
    <NotesBoard notes={notes} openId={id} today={today} timezone={timezone}>
      <NoteEditor key={note.id} note={note} editedLabel={label} />
    </NotesBoard>
  );
}
