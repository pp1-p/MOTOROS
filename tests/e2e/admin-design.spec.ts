import { expect, test } from "@playwright/test";

test("stock layouts, filters and empty states work at phone, tablet and desktop widths", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/stock");
    await expect(page.getByRole("heading", { name: "Stock", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByLabel("Stock status")).toBeVisible();
    await expect(page.getByLabel("Sort stock")).toBeVisible();
    if (width < 768) {
      await expect(page.getByLabel("Vehicle cards")).toBeVisible();
      await expect(page.getByRole("table")).not.toBeVisible();
    }
    await page.getByLabel("Search stock", { exact: true }).fill("zz-no-such-stock");
    await expect(page.getByRole("heading", { name: "No vehicles match those filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters", exact: true }).last().click();
    await expect(page.getByLabel("Search stock", { exact: true })).toHaveValue("");
    await page.getByLabel("Stock status").selectOption("All stock");
    await page.getByLabel("Sort stock").selectOption("price-high");
    await expect(page.getByLabel("Sort stock")).toHaveValue("price-high");
    if (width >= 768) {
      await page.getByRole("button", { name: "Grid view", exact: true }).click();
      await expect(page.getByLabel("Vehicle cards")).toBeVisible();
      await expect(page.getByRole("button", { name: "Grid view", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("Search stock", { exact: true }).fill("zz-no-such-stock");
      await expect(page.getByRole("heading", { name: "No vehicles match those filters" })).toBeVisible();
    }
  }
});

test("search and quick create trap keyboard focus, close with Escape and return focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const search = page.getByRole("button", { name: "Search MOTOR.OS", exact: true });
  await search.click();
  const searchDialog = page.getByRole("dialog", { name: "Global search", exact: true });
  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByRole("textbox", { name: "Search", exact: true })).toBeFocused();
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press("Tab");
    expect(await searchDialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(searchDialog).not.toBeVisible();
  await expect(search).toBeFocused();
  const quick = page.getByRole("button", { name: "Quick create", exact: true }).filter({ visible: true });
  await quick.click();
  await expect(page.getByRole("dialog", { name: "Quick create", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(quick).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(searchDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(quick).toBeFocused();
  await expect(page.getByText("All systems operational", { exact: true })).toHaveCount(0);
});

test("mobile navigation and notifications use accessible dialogs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/stock");
  const open = page.getByRole("button", { name: "Open navigation", exact: true });
  await expect(page.getByRole("link", { name: "Today", exact: true })).not.toBeVisible();
  await open.click();
  const navigation = page.getByRole("dialog", { name: "Navigation", exact: true });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Today", exact: true })).not.toHaveAttribute("aria-current");
  await expect(navigation.getByRole("link", { name: "Stock", exact: true })).toHaveAttribute("aria-current", "page");
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await navigation.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await open.click();
  await navigation.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(navigation).not.toBeVisible();
  const notifications = page.getByRole("button", { name: /unread notifications/ });
  await notifications.click();
  await expect(page.getByRole("dialog", { name: "Notification centre", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(notifications).toBeFocused();
});
