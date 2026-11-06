import { expect, test } from "@playwright/test";

const ROUTES = ["/hoje", "/calendario/mes/2026-11", "/tarefas", "/notas", "/livros", "/perfil"];

test.describe("cadastro restrito", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("e-mail fora da lista vê o motivo e não cria conta", async ({ page }) => {
    await page.goto("/criar-conta");
    await page.getByLabel("Nome").fill("Fora da Lista");
    await page.getByLabel("E-mail").fill(`fora-${Date.now()}@teste.local`);
    await page.locator("#senha").fill("senha-de-teste-123");
    await page.locator('input[name="termos"]').check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.locator(".errmsg")).toContainText("Este e-mail não tem acesso ao Amora.");
    await expect(page.getByText("Olhe o seu e-mail")).toHaveCount(0);
  });
});

test.describe("build de produção", () => {
  for (const route of ROUTES) {
    test(`${route} abre sem violar o CSP nem gerar erro`, async ({ page }) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });

      await page.goto(route);
      await page.waitForLoadState("networkidle");

      expect(problems).toEqual([]);
    });
  }

  // Regressão: um loading.tsx acima destas rotas fazia a transição ficar suspensa para sempre,
  // só em produção e só com a resposta em streaming: a URL e a tela não mudavam, sem erro nenhum.
  test("trocar de dia no calendário sempre responde", async ({ page }) => {
    await page.goto("/calendario/mes/2026-11?dia=2026-11-14");
    await page.waitForLoadState("networkidle");
    for (const day of [7, 21, 5, 12, 26, 3]) {
      await page.getByRole("link", { name: new RegExp(`^${day} de novembro`) }).click();
      await expect(page.getByRole("heading", { name: `${day} de novembro`, exact: true })).toBeVisible({ timeout: 5000 });
    }
  });

  test("trocar de dia na visão do dia sempre responde", async ({ page }) => {
    await page.goto("/dia/2026-11-04");
    await page.waitForLoadState("networkidle");
    for (const day of ["2026-11-05", "2026-11-20", "2026-11-11", "2026-11-28"]) {
      await page.evaluate((url) => (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(url), `/dia/${day}`);
      await expect(page).toHaveURL(new RegExp(`/dia/${day}$`), { timeout: 5000 });
    }
  });

  test("os cabeçalhos de segurança são os de produção", async ({ request }) => {
    const response = await request.get("/entrar");
    const headers = response.headers();
    const csp = headers["content-security-policy"] ?? "";
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain("unsafe-eval");
    expect(headers["strict-transport-security"]).toBe("max-age=2592000");
  });

  test("o cookie de sessão é seguro", async ({ context }) => {
    const session = (await context.cookies()).find((cookie) => cookie.name.includes("session_token"));
    expect(session?.name.startsWith("__Secure-")).toBe(true);
    expect(session?.secure).toBe(true);
    expect(session?.httpOnly).toBe(true);
  });

  test("a rota do cron só aceita o segredo", async ({ request }) => {
    expect((await request.get("/api/cron/tick")).status()).toBe(401);
    const response = await request.get("/api/cron/tick", {
      headers: { authorization: "Bearer e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e-e2e" },
    });
    expect(response.status()).toBe(200);
  });
});
