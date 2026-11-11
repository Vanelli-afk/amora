import { expect, test } from "@playwright/test";

const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test.describe("finanças", () => {
  test("o resumo e o menu da seção aparecem", async ({ page, isMobile }) => {
    await page.goto("/financas");
    await expect(page.getByRole("heading", { name: "Finanças", level: 1 })).toBeVisible();
    await expect(page.getByText("Saldo atual")).toBeVisible();
    const nav = isMobile ? page.getByRole("navigation", { name: "Navegação de Finanças" }) : page.getByRole("complementary", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Lançamentos" })).toBeVisible();
  });

  test("cria, edita e exclui um lançamento", async ({ page }) => {
    const description = unique("Padaria");
    await page.goto("/financas/lancamentos?novo=lancamento");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor").fill("23,45");
    await dialog.getByLabel("Descrição").fill(description);
    await dialog.getByRole("button", { name: "Salvar despesa" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("link", { name: new RegExp(description) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("23,45");

    await row.click();
    await expect(dialog.getByRole("heading", { name: "Editar lançamento" })).toBeVisible();
    await dialog.getByLabel("Valor").fill("30,00");
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: new RegExp(description) })).toContainText("30,00");

    await page.getByRole("link", { name: new RegExp(description) }).click();
    await dialog.getByRole("button", { name: "Excluir" }).click();
    await expect(dialog.getByText("Excluir este lançamento?")).toBeVisible();
    await dialog.getByRole("button", { name: "Sim, excluir" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: new RegExp(description) })).toHaveCount(0);
  });

  test("recusa um valor inválido sem fechar o formulário", async ({ page }) => {
    await page.goto("/financas?novo=lancamento");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor").fill("abc");
    await dialog.getByLabel("Descrição").fill("Qualquer");
    await dialog.getByRole("button", { name: "Salvar despesa" }).click();
    await expect(dialog.getByText("Informe um valor válido.")).toBeVisible();
  });

  test("filtra por texto e exporta o CSV com o mesmo filtro", async ({ page }) => {
    const description = unique("Filtro");
    await page.goto("/financas/lancamentos?novo=lancamento");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor").fill("5,00");
    await dialog.getByLabel("Descrição").fill(description);
    await dialog.getByRole("button", { name: "Salvar despesa" }).click();
    await expect(dialog).toBeHidden();

    await page.goto(`/financas/lancamentos?q=${encodeURIComponent(description)}`);
    await expect(page.getByRole("link", { name: new RegExp(description) })).toHaveCount(1);

    const csv = await page.request.get(`/api/financas/exportar?q=${encodeURIComponent(description)}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const body = await csv.text();
    expect(body).toContain(description);
    expect(body.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  test("marca uma conta como paga e ela vai para as pagas", async ({ page }) => {
    const name = unique("Conta");
    await page.goto("/financas/contas");
    await page.getByRole("button", { name: "Nova conta" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill(name);
    await dialog.getByLabel("Valor").fill("42,00");
    await dialog.getByLabel("Vencimento").fill("2099-01-15");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("checkbox", { name: new RegExp(`Selecionar ${name}`) }).check();
    await page.getByRole("button", { name: "Marcar como paga" }).click();
    await expect(page.getByRole("checkbox", { name: new RegExp(`Selecionar ${name}`) })).toHaveCount(0);

    await page.goto("/financas/contas?aba=pagas");
    await expect(page.getByText(name)).toBeVisible();
  });

  test("define um limite de orçamento", async ({ page }) => {
    await page.goto("/financas/orcamentos");
    await expect(page.getByText("Orçamentos do mês")).toBeVisible();
    await page.getByRole("button", { name: "Definir limite" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Limite mensal").fill("777,00");
    await dialog.getByRole("button", { name: "Salvar limite" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("777,00").first()).toBeVisible();
  });
});
