import { expect, test } from "@playwright/test";
import { fakeIp, linkFromMail, newAccount, uniqueEmail } from "./helpers";

test.describe("autenticação", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(({ isMobile }) => isMobile, "fluxos de conta rodam uma vez, no desktop");

  test("página privada leva para entrar", async ({ page }) => {
    await page.goto("/tarefas");
    await expect(page).toHaveURL(/\/entrar\?volta=%2Ftarefas/);
  });

  test("cadastro, confirmação de e-mail e saída", async ({ browser, baseURL }) => {
    const { page, context } = await newAccount(browser, baseURL as string);
    await expect(page.locator(".tl")).toBeVisible();
    await page.goto("/perfil");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto("/hoje");
    await expect(page).toHaveURL(/\/entrar/);
    await context.close();
  });

  test("sem confirmar o e-mail não entra", async ({ page }) => {
    const email = uniqueEmail();
    await page.goto("/criar-conta");
    await page.getByLabel("Nome").fill("Sem Confirmar");
    await page.getByLabel("E-mail").fill(email);
    await page.locator("#senha").fill("senha-de-teste-123");
    await page.locator('input[name="termos"]').check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Olhe o seu e-mail")).toBeVisible();

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.locator("#senha").fill("senha-de-teste-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator(".errmsg")).toContainText("Confirme o seu e-mail");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("o servidor exige o aceite dos termos", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      headers: { origin: "http://localhost:3100", "x-forwarded-for": fakeIp(1) },
      data: { name: "Sem Aceite", email: uniqueEmail(), password: "senha-de-teste-123" },
    });
    expect(response.status()).toBe(400);
  });

  test("cadastro não revela se o e-mail já existe", async ({ request }) => {
    const headers = { origin: "http://localhost:3100", "x-forwarded-for": fakeIp(2) };
    const email = uniqueEmail();
    const data = { name: "A", email, password: "senha-de-teste-123", acceptTerms: true };
    const first = await request.post("/api/auth/sign-up/email", { headers, data });
    const second = await request.post("/api/auth/sign-up/email", { headers, data });
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
  });

  // Conta própria: redefinir a senha desconecta todos os aparelhos daquela conta.
  test("redefinição não revela se a conta existe, desconecta os aparelhos, e o link é de uso único", async ({ page, request, browser, baseURL }) => {
    const account = await newAccount(browser, baseURL as string);
    const headers = { origin: "http://localhost:3100", "x-forwarded-for": fakeIp(3) };
    const missing = await request.post("/api/auth/request-password-reset", { headers, data: { email: uniqueEmail(), redirectTo: "/redefinir-senha" } });
    const existing = await request.post("/api/auth/request-password-reset", { headers, data: { email: account.email, redirectTo: "/redefinir-senha" } });
    expect(missing.status()).toBe(existing.status());
    expect(await missing.text()).toBe(await existing.text());

    const link = await linkFromMail(account.email);
    expect(link).toContain("reset-password");
    await page.goto(link);
    await page.locator("#senha").fill("senha-nova-456789");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page).toHaveURL(/senha=redefinida/);

    await account.page.goto("/hoje");
    await expect(account.page).toHaveURL(/\/entrar/);
    await account.context.close();

    await page.goto(link);
    await expect(page.getByText(/expirou ou já foi usado|Link inválido/).first()).toBeVisible();
  });

  test("tentativas de login em excesso são bloqueadas", async ({ request }) => {
    const headers = { origin: "http://localhost:3100", "x-forwarded-for": fakeIp(77) };
    const data = { email: "demo@amora.local", password: "senha-errada-000" };
    const statuses: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      statuses.push((await request.post("/api/auth/sign-in/email", { headers, data })).status());
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  test("não redireciona para fora do site", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/entrar?volta=//mal.exemplo");
    await page.getByLabel("E-mail").fill("demo@amora.local");
    await page.locator("#senha").fill("amora-demo-2026");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/hoje/);
    expect(new URL(page.url()).hostname).toBe("localhost");
    await context.close();
  });
});

test.describe("proteções da aplicação", () => {
  test.skip(({ isMobile }) => isMobile, "independe do tamanho de tela");

  test("cabeçalhos de segurança em toda página", async ({ request }) => {
    const response = await request.get("/entrar");
    const headers = response.headers();
    const csp = headers["content-security-policy"] as string;
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();

    const another = await request.get("/entrar");
    expect(another.headers()["content-security-policy"]).not.toBe(csp);
  });

  test("páginas privadas não ficam em cache", async ({ request }) => {
    const response = await request.get("/hoje");
    expect(response.headers()["cache-control"]).toMatch(/no-store/);
  });

  test("cookie de sessão não é acessível por script", async ({ context }) => {
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name.includes("session_token"));
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
  });

  test("texto com script aparece como texto e não executa", async ({ page }) => {
    let executed = false;
    await page.exposeFunction("marcarXss", () => { executed = true; });
    const attack = `<img src=x onerror="window.marcarXss()">${Date.now()}`;
    await page.goto("/dia/2026-11-20");
    await page.getByLabel("Adicionar tarefa rápida").fill(attack);
    await page.getByLabel("Adicionar tarefa rápida").press("Enter");
    await expect(page.locator(".task .tt", { hasText: attack })).toBeVisible();
    await page.reload();
    await expect(page.locator(".task .tt", { hasText: attack })).toBeVisible();
    expect(executed).toBe(false);
  });

  test("outra conta não abre os dados nem os arquivos da primeira", async ({ page, browser, baseURL, request }) => {
    await page.goto("/notas");
    const href = await page.getByRole("link", { name: /Bolo de laranja da vovó/ }).first().getAttribute("href");
    expect(href).toBeTruthy();

    await page.goto("/livros/adicionar");
    await page.getByLabel("Título", { exact: true }).fill("Livro com capa");
    await page.locator('input[name="capa"]').setInputFiles({
      name: "capa.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64"),
    });
    await page.getByRole("button", { name: "Salvar livro" }).click();
    await page.waitForURL(/\/livros\/[0-9a-f-]{36}/);
    const cover = await page.locator(".book-cover img").getAttribute("src");
    expect(cover).toMatch(/^\/api\/arquivos\//);
    expect((await request.get(cover as string)).status()).toBe(200);

    const { page: other, context } = await newAccount(browser, baseURL as string);
    // O status já saiu como 200 quando o loading.tsx começa a transmitir; o que importa é o conteúdo.
    const note = await other.goto(href as string);
    expect(await note?.text()).not.toMatch(/laranja|Ingredientes/);
    await expect(other.getByRole("heading", { name: "Página em branco" })).toBeVisible();
    await expect(other.locator("body")).not.toContainText("laranja");
    const file = await context.request.get(cover as string);
    expect(file.status()).toBe(404);
    await context.close();

    const anonymous = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    expect((await anonymous.request.get(cover as string)).status()).toBe(404);
    expect((await anonymous.request.get("/api/exportar")).status()).toBe(401);
    await anonymous.close();
  });

  test("upload de HTML disfarçado de PNG é recusado", async ({ page }) => {
    await page.goto("/livros/adicionar");
    await page.getByLabel("Título", { exact: true }).fill("Livro malicioso");
    await page.locator('input[name="capa"]').setInputFiles({
      name: "capa.png",
      mimeType: "image/png",
      buffer: Buffer.from("<html><script>alert(1)</script></html>"),
    });
    await page.getByRole("button", { name: "Salvar livro" }).click();
    await expect(page.locator(".errmsg")).toContainText("imagem JPG ou PNG");
    await expect(page).toHaveURL(/\/livros\/adicionar/);
  });

  test("exportar traz os textos decifrados; excluir conta encerra tudo", async ({ browser, baseURL }) => {
    const { page, context, email, password } = await newAccount(browser, baseURL as string);
    await page.getByLabel("Adicionar tarefa rápida").fill("Tarefa para exportar");
    await page.getByLabel("Adicionar tarefa rápida").press("Enter");
    await expect(page.locator(".task .tt", { hasText: "Tarefa para exportar" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    const exported = await context.request.get("/api/exportar");
    expect(exported.headers()["content-disposition"]).toContain("attachment");
    expect(await exported.text()).toContain("Tarefa para exportar");

    await page.goto("/perfil");
    await page.getByRole("button", { name: "Excluir conta" }).click();
    await page.getByLabel("Digite o seu e-mail para confirmar").fill(email);
    await page.locator("#senha-excluir").fill(password);
    await page.getByRole("button", { name: "Excluir definitivamente" }).click();
    await expect(page).toHaveURL(/\/entrar/);

    await page.getByLabel("E-mail").fill(email);
    await page.locator("#senha").fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.locator(".errmsg")).toContainText("incorretos");
    await context.close();
  });
});
