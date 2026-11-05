"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createEvent, deleteEvent, getEvent, updateEvent } from "@/data/events";
import { defineAction, UserError } from "@/lib/action";
import { minutesOf } from "@/lib/dates";
import { zColor, zDay, zId, zOptionalTime, zText, zTitle } from "@/lib/validation";

const eventInput = z.object({
  title: zTitle,
  date: zDay,
  startTime: zOptionalTime,
  endTime: zOptionalTime,
  color: zColor,
  location: zText(300),
  notes: zText(5000),
  recurrence: z.object({
    freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
    until: zDay.optional(),
  }).nullable(),
  reminderMinutes: z.number().int().min(0).max(60 * 24 * 14).nullable(),
}).refine((e) => !e.endTime || (e.startTime && minutesOf(e.endTime) > minutesOf(e.startTime)), {
  message: "O fim precisa ser depois do início.",
});

const scope = z.enum(["this", "all"]);

export const saveNewEvent = defineAction("event.create", eventInput, async (input, { userId }) => {
  const id = await createEvent(userId, input);
  revalidatePath("/", "layout");
  return id;
});

export const saveEvent = defineAction("event.update", z.object({
  id: zId, occurrence: zDay, scope, input: eventInput,
}), async ({ id, occurrence, scope: which, input }, { userId }) => {
  const found = await updateEvent(userId, id, occurrence, which, input);
  if (!found) throw new UserError("Compromisso não encontrado.");
  revalidatePath("/", "layout");
});

export const removeEvent = defineAction("event.delete", z.object({
  id: zId, occurrence: zDay, scope,
}), async ({ id, occurrence, scope: which }, { userId }) => {
  const found = await deleteEvent(userId, id, occurrence, which);
  if (!found) throw new UserError("Compromisso não encontrado.");
  revalidatePath("/", "layout");
});

export const loadEvent = defineAction("event.get", z.object({ id: zId, occurrence: zDay.optional() }), async ({ id, occurrence }, { userId }) => {
  const event = await getEvent(userId, id, occurrence);
  if (!event) throw new UserError("Compromisso não encontrado.");
  return event;
});
