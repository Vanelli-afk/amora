import { closeDb } from "@/db";
import { cleanup, runNotificationCycle } from "@/data/notifications";
import { sendWebPush } from "@/data/push";
import { env } from "@/lib/env";

const TICK_MS = 30_000;
const CLEANUP_EVERY = 120;

let stopping = false;
let ticks = 0;

async function tick() {
  const now = new Date();
  const sent = await runNotificationCycle(now, sendWebPush);
  if (sent) console.info(`[worker] ${sent} lembrete(s) processado(s)`);
  ticks += 1;
  if (ticks % CLEANUP_EVERY === 0) await cleanup(now);
}

async function main() {
  env();
  console.info("[worker] no ar");
  while (!stopping) {
    try {
      await tick();
    } catch (error) {
      // Só o tipo: a mensagem pode trazer dados do usuário.
      console.error(`[worker] falha no ciclo: ${error instanceof Error ? error.name : "erro"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
  }
  await closeDb();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    process.exit(0);
  });
}

void main();
