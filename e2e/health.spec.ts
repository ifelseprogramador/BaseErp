import { test, expect } from "@playwright/test";

/**
 * Smoke test mínimo: a página de login carrega sem erro. Um vertical
 * nascido deste template deve adicionar aqui os fluxos de negócio dele
 * (criar cliente, criar ordem, etc.) — este arquivo só garante que a
 * infraestrutura de e2e está funcionando.
 */
test("a página de login carrega", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});
