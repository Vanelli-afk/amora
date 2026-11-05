"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { removeFile, saveImage } from "@/data/files";
import { removePushSubscription, savePushSubscription } from "@/data/push";
import { reschedulePending } from "@/data/reminders";
import { getSettings, updateSettings } from "@/data/settings";
import { defineAction, UserError } from "@/lib/action";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";
import { zTime, zTimezone } from "@/lib/validation";

const ONE_YEAR = 60 * 60 * 24 * 365;

export const saveSettings = defineAction("settings.update", z.object({
  theme: z.enum(["light", "dark", "auto"]).optional(),
  timezone: zTimezone.optional(),
  stepGoal: z.number().int().min(100).max(200_000).optional(),
  pagesGoal: z.number().int().min(1).max(2000).optional(),
  booksGoal: z.number().int().min(1).max(1000).optional(),
  notifyEvents: z.boolean().optional(),
  notifyMorning: z.boolean().optional(),
  morningTime: zTime.optional(),
  notifyEvening: z.boolean().optional(),
  eveningTime: zTime.optional(),
}), async (patch, { userId }) => {
  const before = await getSettings(userId);
  await updateSettings(userId, patch);
  if (patch.theme) {
    (await cookies()).set("amora-theme", patch.theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  }
  if (patch.timezone && patch.timezone !== before.timezone) await reschedulePending(userId, patch.timezone);
  revalidatePath("/", "layout");
});

const pushSubscription = z.object({
  endpoint: z.url().max(1000).refine((v) => v.startsWith("https://"), "Endereço inválido."),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
});

export const subscribePush = defineAction("push.subscribe", pushSubscription, async (input, { userId }) => {
  await savePushSubscription(userId, input);
}, { limit: { max: 20, windowSeconds: 60 } });

export const unsubscribePush = defineAction("push.unsubscribe", z.object({ endpoint: z.string().max(1000) }), async ({ endpoint }, { userId }) => {
  await removePushSubscription(userId, endpoint);
});

export const uploadAvatar = defineAction("profile.avatar", z.instanceof(FormData), async (form, { userId }) => {
  const file = form.get("foto");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Escolha uma imagem.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError("A imagem precisa ter até 5 MB.");
  const previous = (await getSession())?.user.image?.match(/^\/api\/arquivos\/([0-9a-f-]{36})$/)?.[1];
  const id = await saveImage(userId, "avatar", Buffer.from(await file.arrayBuffer()));
  await auth.api.updateUser({ headers: await headers(), body: { image: `/api/arquivos/${id}` } });
  if (previous) await removeFile(userId, previous);
  revalidatePath("/", "layout");
}, { limit: { max: 10, windowSeconds: 60 } });
