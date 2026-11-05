import type { Metadata } from "next";
import { TaskBoard } from "@/components/tarefas/task-board";
import { getSettings } from "@/data/settings";
import { listOpenTasks, listRecentDone } from "@/data/tasks";
import { todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TarefasPage() {
  const user = await requireUser();
  const { timezone } = await getSettings(user.id);
  const today = todayIn(timezone);
  const [open, done] = await Promise.all([listOpenTasks(user.id), listRecentDone(user.id)]);
  const doneToday = done.filter((t) => t.date === today).length;
  return <TaskBoard open={open} done={done} today={today} doneToday={doneToday} />;
}
