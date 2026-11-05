"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createStandaloneReminder, deleteStandaloneReminder } from "@/data/reminders";
import { defineAction } from "@/lib/action";
import { zDay, zId, zTime, zTitle } from "@/lib/validation";

export const addReminder = defineAction("reminder.add", z.object({ title: zTitle, date: zDay, time: zTime }), async (input, { userId }) => {
  await createStandaloneReminder(userId, input);
  revalidatePath("/", "layout");
});

export const removeReminder = defineAction("reminder.delete", z.object({ id: zId }), async ({ id }, { userId }) => {
  await deleteStandaloneReminder(userId, id);
  revalidatePath("/", "layout");
});
