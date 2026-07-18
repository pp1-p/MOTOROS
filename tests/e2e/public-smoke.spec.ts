import { expect, test } from "@playwright/test";

test("public home and inventory are usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator('a[href="/cars"]:visible').first()).toBeVisible();

  await page.goto("/cars");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/purchase price|minimum acceptable|gross profit/i);
});

test("legal and service routes render on mobile", async ({ page }) => {
  for (const route of ["/repairs", "/privacy", "/cookies", "/terms"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  }
});
