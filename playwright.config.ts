import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const testDb = readFileSync(".env", "utf8").match(/^TEST_DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!testDb) throw new Error("TEST_DATABASE_URL não definida. Rode `npm run setup`.");

export default defineConfig({
  testDir: "./e2e",
  // Compartilham banco e limites de tentativas: rodam em sequência.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    storageState: "test-results/demo-state.json",
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${BASE_URL}/entrar`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: testDb,
      BETTER_AUTH_URL: BASE_URL,
      MAIL_CAPTURE_FILE: "test-results/mail.jsonl",
      STORAGE_DIR: "test-results/storage",
    },
  },
});
