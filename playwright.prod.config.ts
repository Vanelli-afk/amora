import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const testDb = readFileSync(".env", "utf8").match(/^TEST_DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!testDb) throw new Error("TEST_DATABASE_URL não definida. Rode `npm run setup`.");

// Roda no build de produção: CSP com nonce, cookies seguros e validação de ambiente, que `next dev` não exercita.
// Fica de fora auth-security.spec.ts: lê e-mails capturados, e a captura não existe em produção.
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["journal.spec.ts", "producao.spec.ts"],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/entrar`,
    timeout: 400_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: testDb,
      BETTER_AUTH_URL: BASE_URL,
      // Valores só para passar na validação: nenhum teste desta configuração envia e-mail.
      SMTP_URL: "smtp://127.0.0.1:2525",
      EMAIL_FROM: "Amora <nao-responda@amora.example>",
      VAPID_SUBJECT: "mailto:contato@amora.example",
      CRON_SECRET: "e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e",
      ALLOWED_EMAILS: "demo@amora.local",
    },
  },
});
