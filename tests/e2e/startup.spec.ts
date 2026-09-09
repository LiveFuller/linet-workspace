import { test, expect } from "@playwright/test";

test("a fresh demo opens its dashboard and supports direct task links", async ({ page }) => {
  await page.goto("/linetapp/");
  await expect(page.getByRole("heading", { name: /Oliver/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Přidat úkol", exact: true })).toBeVisible();

  await page.goto("/linetapp/tasks");
  await expect(page.getByRole("heading", { name: "Úkoly", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Úkoly", exact: true })).toBeVisible();
  await expect(page.getByText("Vyřešit přístup ke Copilot licencím pro projektový tým", { exact: true })).toBeVisible();
});
