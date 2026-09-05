import { expect, test } from "@playwright/test";

const themes = [
  ["direct-motors-classic", "Direct Motors Classic"],
  ["modern-marketplace", "Modern Marketplace"],
  ["prestige", "Prestige"],
  ["performance", "Performance"],
] as const;

for (const [themeId, themeName] of themes) {
  test(`${themeName} can be previewed with dealership content`, async ({ page }) => {
    await page.goto(`/admin/website/preview/${themeId}`);

    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(themeName) }).first(),
    ).toBeVisible();
    await expect(page.locator(`[data-public-theme="${themeId}"]`)).toBeVisible();
    await expect(page.getByText("We could not load this page.")).toHaveCount(0);
  });
}
