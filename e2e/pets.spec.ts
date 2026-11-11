import { expect, test } from "@playwright/test";

const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const saoPauloDay = (offsetDays = 0) => {
  const base = new Date(Date.now() + offsetDays * 86_400_000);
  return base.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
};

test.describe("pets", () => {
  test("a visão geral mostra os pets da conta de demonstração", async ({ page }) => {
    await page.goto("/pets");
    await expect(page.getByRole("heading", { name: "Seus pets", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cuidados de hoje" })).toBeVisible();
    await expect(page.getByText("Mel").first()).toBeVisible();
  });

  test("cadastra um pet e abre a ficha", async ({ page }) => {
    const name = unique("Bolinha");
    await page.goto("/pets/novo");
    await page.getByLabel("Nome").fill(name);
    await page.getByLabel("Raça").fill("Vira-lata");
    await page.getByRole("button", { name: "Cadastrar pet" }).click();
    await expect(page).toHaveURL(/\/pets\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  });

  test("registra uma vacina e a próxima dose entra na agenda", async ({ page }) => {
    const vaccine = unique("Vacina");
    await page.goto("/pets/lista");
    await page.getByRole("link", { name: "Ver perfil" }).first().click();
    await page.getByRole("link", { name: "Saúde" }).click();
    await page.getByRole("button", { name: "Vacina", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Vacina", { exact: true }).fill(vaccine);
    await dialog.getByLabel("Próxima dose").fill(saoPauloDay(20));
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: new RegExp(vaccine) })).toBeVisible();

    await page.goto("/pets/agenda");
    await expect(page.getByText(new RegExp(`${vaccine} · `)).first()).toBeVisible();
  });

  test("um compromisso do pet aparece em Hoje", async ({ page }) => {
    const title = unique("Banho");
    await page.goto("/pets?novo=pet-compromisso");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Título").fill(title);
    await dialog.getByLabel("Data").fill(saoPauloDay());
    await dialog.getByRole("button", { name: "Salvar compromisso" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/hoje");
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("marca e desmarca um cuidado do dia", async ({ page }) => {
    await page.goto("/pets");
    const first = page.getByRole("button", { name: /Alimentação/ }).first();
    const before = await first.getAttribute("aria-pressed");
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", before ?? "false");
  });

  test("registra um gasto e ele entra no resumo do mês", async ({ page }) => {
    const title = unique("Petisco");
    await page.goto("/pets/gastos");
    await page.getByRole("button", { name: "Novo gasto" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor").fill("12,34");
    await dialog.getByLabel("Descrição").fill(title);
    await dialog.getByRole("button", { name: "Salvar gasto" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("não abre o pet de outra pessoa nem um id inválido", async ({ page }) => {
    const missing = await page.goto("/pets/00000000-0000-4000-8000-000000000000");
    expect(missing?.status()).toBe(404);
    const invalid = await page.goto("/pets/nao-e-um-id");
    expect(invalid?.status()).toBe(404);
  });
});
