"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTaskReminderMinutes } from "@/data/reminders";
import { clearDone, createTask, deleteTask, getTask, reorderTasks, setTaskDone, updateTask } from "@/data/tasks";
import { defineAction, UserError } from "@/lib/action";
import { zDay, zId, zOptionalDay, zOptionalTime, zTitle } from "@/lib/validation";

const taskInput = z.object({
  title: zTitle,
  date: zOptionalDay,
  dueTime: zOptionalTime,
  highlight: z.boolean(),
  reminderMinutes: z.number().int().min(0).max(60 * 24 * 14).nullable().optional(),
});

export const addTask = defineAction("task.create", taskInput, async (input, { userId }) => {
  const task = await createTask(userId, input);
  revalidatePath("/", "layout");
  return task;
});

export const quickAddTask = defineAction("task.quick", z.object({ title: zTitle, date: zOptionalDay }), async ({ title, date }, { userId }) => {
  const task = await createTask(userId, { title, date, dueTime: null, highlight: false });
  revalidatePath("/", "layout");
  return task;
});

export const saveTask = defineAction("task.update", z.object({ id: zId, input: taskInput }), async ({ id, input }, { userId }) => {
  const found = await updateTask(userId, id, input);
  if (!found) throw new UserError("Tarefa não encontrada.");
  revalidatePath("/", "layout");
});

export const toggleTask = defineAction("task.toggle", z.object({ id: zId, done: z.boolean() }), async ({ id, done }, { userId }) => {
  const found = await setTaskDone(userId, id, done);
  if (!found) throw new UserError("Tarefa não encontrada.");
  revalidatePath("/", "layout");
});

export const removeTask = defineAction("task.delete", z.object({ id: zId }), async ({ id }, { userId }) => {
  await deleteTask(userId, id);
  revalidatePath("/", "layout");
});

export const clearDoneTasks = defineAction("task.clear", z.object({}), async (_input, { userId }) => {
  await clearDone(userId);
  revalidatePath("/", "layout");
});

export const moveTasks = defineAction("task.move", z.object({
  orderedIds: z.array(zId).max(1000),
  moved: z.object({ id: zId, date: zDay.nullable() }).optional(),
}), async ({ orderedIds, moved }, { userId }) => {
  await reorderTasks(userId, orderedIds, moved);
  revalidatePath("/", "layout");
});

export const loadTask = defineAction("task.get", z.object({ id: zId }), async ({ id }, { userId }) => {
  const task = await getTask(userId, id);
  if (!task) throw new UserError("Tarefa não encontrada.");
  return { ...task, reminderMinutes: await getTaskReminderMinutes(userId, id) };
});
