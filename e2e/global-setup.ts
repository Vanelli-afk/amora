import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { Client } from "pg";

/** Prepara o banco de teste e guarda a sessão da conta de demonstração. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL as string;
  const testDb = readFileSync(".env", "utf8").match(/^TEST_DATABASE_URL=(.+)$/m)?.[1]?.trim() as string;
  const env = { ...process.env, DATABASE_URL: testDb };

  mkdirSync("test-results", { recursive: true });
  rmSync("test-results/mail.jsonl", { force: true });
  execSync("npx drizzle-kit migrate", { env, stdio: "pipe" });
  execSync("npm run db:seed", { env, stdio: "pipe" });

  // Cada rodada começa sem os limites de tentativas da anterior.
  const client = new Client({ connectionString: testDb });
  await client.connect();
  await client.query("TRUNCATE rate_limit, action_limits");
  await client.end();

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/entrar", { timeout: 120_000 });
  await page.getByLabel("E-mail").fill("demo@amora.local");
  await page.locator("#senha").fill("amora-demo-2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/hoje", { timeout: 120_000 });
  await page.context().storageState({ path: "test-results/demo-state.json" });
  // Compila as rotas antes dos testes: a primeira compilação recarrega a página em desenvolvimento.
  for (const url of ["/dia/2026-11-04", "/calendario/mes/2026-11", "/calendario/semana/2026-11-04", "/tarefas", "/notas", "/livros", "/livros/adicionar", "/perfil", "/criar-conta", "/esqueci-senha"]) {
    await page.goto(url, { timeout: 120_000 }).catch(() => {});
  }
  await browser.close();
}
