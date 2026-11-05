import { readFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";

export const DAY = "2026-11-04";

let counter = 0;
export const uniqueEmail = () => `pessoa-${Date.now()}-${counter++}@teste.local`;

/** Último e-mail capturado para o endereço, com o link de ação. */
export async function linkFromMail(email: string): Promise<string> {
  await expect.poll(() => {
    try {
      return readFileSync("test-results/mail.jsonl", "utf8").includes(email);
    } catch {
      return false;
    }
  }, { timeout: 30_000 }).toBe(true);
  const mails = readFileSync("test-results/mail.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; text: string });
  const mail = mails.filter((m) => m.to === email).at(-1);
  const match = mail?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("Link não encontrado no e-mail");
  return match[0];
}

/** Cria e confirma uma conta nova, já com a sessão aberta em uma página própria. */
export async function newAccount(browser: Browser, baseURL: string, password = "senha-de-teste-123") {
  const context = await browser.newContext({ baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const email = uniqueEmail();
  await page.goto("/criar-conta");
  await page.getByLabel("Nome").fill("Pessoa de Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.locator("#senha").fill(password);
  await page.locator('input[name="termos"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Olhe o seu e-mail")).toBeVisible();
  await page.goto(await linkFromMail(email));
  await page.waitForURL(/\/(hoje|verificar-email)/);
  if (page.url().includes("verificar-email")) await page.goto("/hoje");
  await page.waitForSelector(".tl");
  return { context, page, email, password };
}

export async function ready(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Espera a Server Action terminar. "networkidle" pode resolver antes de ela começar. */
export async function afterAction(page: Page, run: () => Promise<unknown>) {
  const done = page.waitForResponse((r) => r.request().method() === "POST");
  await run();
  await done;
}

// IP próprio por rodada: os limites de tentativas ficam gravados no banco.
const RUN = Math.floor(Date.now() / 1000) % 250;
export const fakeIp = (n: number) => `10.${RUN}.0.${n}`;
