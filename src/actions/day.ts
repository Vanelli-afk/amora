"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveDayEntry } from "@/data/day";
import { archiveHabit, createHabit, setHabitDone, updateHabit } from "@/data/habits";
import { defineAction, UserError } from "@/lib/action";
import { zDay, zId, zText, zTitle } from "@/lib/validation";

const metrics = z.object({
  date: zDay,
  mood: z.number().int().min(1).max(5).nullable().optional(),
  waterMl: z.number().int().min(0).max(10_000).optional(),
  steps: z.number().int().min(0).max(300_000).nullable().optional(),
  sleepMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  sticker: z.enum(["star", "rainbow", "moon"]).nullable().optional(),
});

export const saveMetrics = defineAction("day.metrics", metrics, async ({ date, ...patch }, { userId }) => {
  await saveDayEntry(userId, date, patch);
  if (patch.sticker !== undefined) revalidatePath("/", "layout");
});

const MAX_DIARY_TEXT = 20_000;

export const saveJournal = defineAction("day.journal", z.object({
  date: zDay,
  gratitude: zText(MAX_DIARY_TEXT).optional(),
  reflection: zText(MAX_DIARY_TEXT).optional(),
}), async ({ date, ...patch }, { userId }) => {
  await saveDayEntry(userId, date, patch);
});

export const toggleHabit = defineAction("habit.toggle", z.object({ id: zId, date: zDay, done: z.boolean() }), async (input, { userId }) => {
  const found = await setHabitDone(userId, input.id, input.date, input.done);
  if (!found) throw new UserError("Hábito não encontrado.");
  revalidatePath("/", "layout");
});

// Bit 0 = domingo. Pelo menos um dia, senão o hábito nunca valeria.
const weekdays = z.number().int().min(1).max(127);

export const addHabit = defineAction("habit.add", z.object({ title: zTitle, weekdays: weekdays.optional() }), async ({ title, weekdays: days }, { userId }) => {
  await createHabit(userId, title, days);
  revalidatePath("/", "layout");
});

export const editHabit = defineAction("habit.edit", z.object({ id: zId, title: zTitle.optional(), weekdays: weekdays.optional() }), async ({ id, ...patch }, { userId }) => {
  const found = await updateHabit(userId, id, patch);
  if (!found) throw new UserError("Hábito não encontrado.");
  revalidatePath("/", "layout");
});

export const removeHabit = defineAction("habit.remove", z.object({ id: zId }), async ({ id }, { userId }) => {
  await archiveHabit(userId, id);
  revalidatePath("/", "layout");
});
