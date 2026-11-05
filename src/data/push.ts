import { and, eq } from "drizzle-orm";
import webPush from "web-push";
import { db, schema } from "@/db";

const { pushSubscriptions } = schema;

export type PushPayload = { title: string; body: string; url: string };
export type Sender = (userId: string, payload: PushPayload) => Promise<void>;

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }) {
  await db.insert(pushSubscriptions).values({ userId, ...sub })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:contato@amora.local", publicKey, privateKey);
  configured = true;
  return true;
}

/** O conteúdo vai cifrado até o navegador (RFC 8291); o serviço de push não o lê. */
export const sendWebPush: Sender = async (userId, payload) => {
  if (!configure()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  await Promise.all(subs.map(async (sub) => {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60, timeout: 10_000 },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404 e 410: o aparelho cancelou a inscrição, não adianta insistir.
      if (status === 404 || status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        console.error(`[push] falha de envio: ${status ?? "rede"}`);
      }
    }
  }));
};
