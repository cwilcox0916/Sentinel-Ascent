import { test, expect } from "@playwright/test";

test("cold start renders the shell at PC width", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".shell")).toBeVisible();
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".rail")).toBeVisible();
  await expect(page.locator(".stage")).toBeVisible();
  await expect(page.locator(".bottom-dock")).toBeVisible();
  await expect(page.locator(".panel")).toBeVisible();
  await expect(page.locator(".brand .name")).toHaveText("Sentinel Ascent");
});

test("tablet fallback hides the bottom dock", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.locator(".shell")).toBeVisible();
  await expect(page.locator(".bottom-dock")).toBeHidden();
  await expect(page.locator(".panel")).toBeVisible();
});
