import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { afterAction, DAY, ready } from "./helpers";

test.describe("dia", () => {
  test("mostra os dados do design", async ({ page }) => {
    await page.goto(`/dia/${DAY}`);
    await expect(page.getByRole("heading", { name: "4 de novembro" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Reunião de alinhamento/ })).toBeVisible();
    await expect(page.getByText("Enviar relatório semanal")).toBeVisible();
    await expect(page.getByLabel("Hoje agradeço por…")).toHaveValue(/café quentinho/);
  });

  test("humor e reflexão persistem depois de recarregar", async ({ page, isMobile }) => {
    const day = isMobile ? "2026-11-11" : "2026-11-12";
    await page.goto(`/dia/${day}`);
    await afterAction(page, () => page.getByRole("button", { name: "Ótimo" }).click());
    const text = `Aprendi algo novo ${Date.now()}`;
    await page.getByLabel("Reflexão da noite").fill(text);
    await expect(page.locator(".saved.on", { hasText: "salvo" })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Reflexão da noite")).toHaveValue(text);
    await expect(page.getByRole("button", { name: "Ótimo" })).toHaveAttribute("aria-pressed", "true");
  });

  test("marcar tarefa é instantâneo e persiste; desfazer volta", async ({ page, isMobile }) => {
    const title = `Marcar ${isMobile ? "m" : "d"} ${Date.now()}`;
    await page.goto("/dia/2026-11-13");
    await page.getByLabel("Adicionar tarefa rápida").fill(title);
    await afterAction(page, () => page.getByLabel("Adicionar tarefa rápida").press("Enter"));
    const row = page.locator(".task", { hasText: title });
    await expect(row).toBeVisible();

    await row.locator("input.ck").check();
    await expect(row).toHaveClass(/done/);
    await afterAction(page, () => page.getByRole("button", { name: "Desfazer" }).click());
    await page.reload();
    await expect(page.locator(".task", { hasText: title })).not.toHaveClass(/done/);

    await afterAction(page, () => page.locator(".task", { hasText: title }).locator("input.ck").check());
    await page.reload();
    await expect(page.locator(".task", { hasText: title })).toHaveClass(/done/);
  });

  test("criar compromisso pelo painel; voltar do navegador fecha", async ({ page, isMobile }) => {
    const title = `Consulta ${isMobile ? "m" : "d"} ${Date.now()}`;
    await page.goto("/dia/2026-11-17");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Compromisso" }).click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.goBack();
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.getByRole("link", { name: "Compromisso" }).click();
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Início").fill("09:00");
    await page.getByLabel("Fim").fill("09:45");
    await page.getByLabel("Lavanda · Foco").click();
    await page.getByRole("button", { name: "Salvar compromisso" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    const event = page.locator("a.ev", { hasText: title });
    await expect(event).toBeVisible();
    await expect(event).toHaveClass(/c-lav/);

    await event.click();
    await expect(page.locator("dialog[open] h1")).toHaveText(title);
    await expect(page.locator("dialog[open]")).toContainText("45 min");
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.locator("a.ev", { hasText: title })).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.locator("a.ev", { hasText: title })).toBeVisible();
  });

  test("fim antes do início é recusado", async ({ page }) => {
    await page.goto("/dia/2026-11-18");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Compromisso" }).click();
    await page.getByLabel("Título").fill("Inválido");
    await page.getByLabel("Início").fill("10:00");
    await page.getByLabel("Fim").fill("09:00");
    await page.getByRole("button", { name: "Salvar compromisso" }).click();
    await expect(page.locator("dialog[open] .errmsg")).toContainText("depois do início");
  });
});

test.describe("navegação", () => {
  test("setas do teclado trocam de dia", async ({ page, isMobile }) => {
    test.skip(isMobile, "teclado é do desktop");
    await page.goto(`/dia/${DAY}`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/dia\/2026-11-05/);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/dia\/2026-11-04/);
  });

  test("atalhos N, H e / funcionam, e não atrapalham a digitação", async ({ page, isMobile }) => {
    test.skip(isMobile, "teclado é do desktop");
    await page.goto(`/dia/${DAY}`);
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("n");
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.keyboard.press("/");
    await expect(page.locator('dialog[open] input[type="search"]')).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await page.getByLabel("Adicionar tarefa rápida").fill("nh/");
    await expect(page.getByLabel("Adicionar tarefa rápida")).toHaveValue("nh/");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page).toHaveURL(/\/dia\/2026-11-04/);
  });

  test("deslizar o dedo troca de dia", async ({ page, isMobile }) => {
    test.skip(!isMobile, "gesto é do celular");
    await page.goto(`/dia/${DAY}`);
    await page.waitForLoadState("networkidle");
    const session = await page.context().newCDPSession(page);
    const touch = (type: string, x: number, y: number) => session.send("Input.dispatchTouchEvent", {
      type, touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    } as never);
    await touch("touchStart", 320, 200);
    for (let x = 300; x >= 100; x -= 20) {
      await touch("touchMove", x, 202);
      await page.waitForTimeout(16);
    }
    await touch("touchEnd", 100, 202);
    await expect(page).toHaveURL(/\/dia\/2026-11-05/);
  });

  test("a busca ignora acentos e abre o resultado", async ({ page }) => {
    await page.goto(`/dia/${DAY}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^Buscar/ }).locator("visible=true").first().click();
    await page.locator('dialog[open] input[type="search"]').fill("reuniao alinhamento");
    const hit = page.locator(".palette-item", { hasText: "Reunião de alinhamento" }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/evento=/);
    await expect(page.locator("dialog[open] h1")).toHaveText("Reunião de alinhamento");
  });
});

test.describe("telas", () => {
  test("calendário mostra feriado, adesivo e resumo do dia escolhido", async ({ page }) => {
    await page.goto("/calendario/mes/2026-11?dia=2026-11-14");
    await expect(page.getByRole("link", { name: /^2 de novembro, Finados/ })).toBeVisible();
    await expect(page.locator(".mc", { has: page.locator(".stk") })).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "14 de novembro" })).toBeVisible();
    await page.getByRole("link", { name: /^7 de novembro/ }).click();
    await expect(page.getByRole("heading", { name: "7 de novembro" })).toBeVisible();
  });

  test("semana mostra os compromissos e a recorrência", async ({ page }) => {
    await page.goto("/calendario/semana/2026-11-11");
    await expect(page.locator(".week-col a.ev", { hasText: "Reunião de alinhamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /8 – 14 de novembro/ })).toBeVisible();
  });

  test("reordenar tarefas pelo teclado persiste", async ({ page, isMobile }) => {
    test.skip(isMobile, "teclado é do desktop");
    await page.goto("/tarefas");
    await page.waitForLoadState("networkidle");
    const group = page.locator("section.group-drop", { has: page.getByRole("heading", { name: "Sem data" }) });
    const titles = () => group.locator(".tt").allInnerTexts();
    const before = await titles();
    await group.getByRole("button", { name: `Arrastar ${before[0]}` }).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    await page.waitForLoadState("networkidle");
    await expect.poll(titles).toEqual([before[1], before[0], ...before.slice(2)]);
    await page.reload();
    await expect.poll(titles).toEqual([before[1], before[0], ...before.slice(2)]);
  });

  test("nota reabre idêntica, e o salvamento automático grava", async ({ page }) => {
    await page.goto("/notas");
    await page.getByRole("link", { name: /Bolo de laranja da vovó/ }).first().click();
    const editor = page.locator(".ProseMirror");
    await expect(editor).toContainText("1 laranja inteira");
    await expect(editor.locator("mark")).toContainText("1 laranja inteira");
    await expect(editor.locator('li[data-checked="true"]')).toContainText("3 ovos");

    const stamp = `Dica ${Date.now()}`;
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(` ${stamp}`);
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(".ProseMirror")).toContainText(stamp);
  });

  test("livro: atualizar progresso e nota", async ({ page, isMobile }) => {
    // Cada projeto usa uma nota: clicar de novo na mesma desmarca.
    const stars = isMobile ? "2 de 5 estrelas" : "3 de 5 estrelas";
    await page.goto("/livros");
    await page.getByRole("link", { name: /Cartas para a Lua/ }).first().click();
    await page.waitForURL(/\/livros\/[0-9a-f-]{36}/);
    const input = page.getByLabel("Página atual");
    const start = Number(await input.inputValue());
    await page.getByRole("button", { name: "+10 págs" }).click();
    await page.getByRole("button", { name: "Atualizar progresso" }).click();
    await expect(page.getByText("Progresso atualizado")).toBeVisible();
    await afterAction(page, () => page.getByRole("radio", { name: stars }).click());
    await page.reload();
    await expect(page.getByLabel("Página atual")).toHaveValue(String(start + 10));
    await expect(page.getByRole("radio", { name: stars })).toHaveAttribute("aria-checked", "true");
  });

  test("tema Abajur vale sem recarregar e persiste", async ({ page }) => {
    await page.goto("/perfil");
    await page.waitForLoadState("networkidle");
    await afterAction(page, () => page.getByRole("radio", { name: "Abajur" }).click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
    expect(await bg()).toBe("#2B221D");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await afterAction(page, () => page.getByRole("radio", { name: "Claro" }).click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("layout e acessibilidade", () => {
  const PAGES = [
    `/dia/${DAY}`, "/calendario/mes/2026-11", "/calendario/semana/2026-11-04", "/tarefas", "/notas", "/livros", "/livros/adicionar", "/perfil",
  ];

  for (const url of PAGES) {
    test(`sem rolagem lateral nem violações sérias: ${url}`, async ({ page }) => {
      await ready(page, url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const results = await new AxeBuilder({ page }).disableRules(["region"]).analyze();
      const serious = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(serious).toEqual([]);
    });
  }

  test("sem violações sérias nas telas de entrada", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    for (const url of ["/entrar", "/criar-conta", "/esqueci-senha"]) {
      await ready(page, url);
      const results = await new AxeBuilder({ page }).disableRules(["region"]).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    }
    await context.close();
  });

  test("com movimento reduzido nada se anima", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page, `/dia/${DAY}`);
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
    expect(running).toBe(0);
    const duration = await page.evaluate(() => getComputedStyle(document.querySelector(".btn") as Element).transitionDuration);
    expect(duration).toBe("0s");
  });
});
