import { createHash, timingSafeEqual } from "node:crypto";
import { cleanup, runNotificationCycle } from "@/data/notifications";
import { sendWebPush } from "@/data/push";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const digest = (value: string) => createHash("sha256").update(value).digest();

function authorized(request: Request): boolean {
  // Lido a cada chamada, e sem segredo nada entra: nunca comparar com um valor vazio.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const received = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(received), digest(`Bearer ${secret}`));
}

// O agendador pode atrasar ou rodar a cada 15 minutos; a limpeza é idempotente, então repetir não faz mal.
const isCleanupWindow = (now: Date) => now.getUTCHours() === 6 && now.getUTCMinutes() < 15;

/** Um ciclo do worker. A Vercel chama por GET, com o segredo em `Authorization: Bearer`. */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });

  env();
  const now = new Date();
  const sent = await runNotificationCycle(now, sendWebPush);
  if (isCleanupWindow(now)) await cleanup(now);
  return Response.json({ sent }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = GET;
