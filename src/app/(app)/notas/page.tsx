import type { Metadata } from "next";
import { NotesBoard } from "@/components/notas/notes-board";
import { listNotes } from "@/data/notes";
import { getSettings } from "@/data/settings";
import { todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Notas" };

export default async function NotasPage() {
  const user = await requireUser();
  const [{ timezone }, notes] = await Promise.all([getSettings(user.id), listNotes(user.id)]);
  return <NotesBoard notes={notes} openId={null} today={todayIn(timezone)} timezone={timezone} />;
}
