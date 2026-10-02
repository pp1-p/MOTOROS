import { expect, test } from "@playwright/test";

test("repair item and recorded-estimate sections remain contained and read-only in demo", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/repairs/00000000-0000-4000-8000-000000001091", {
      waitUntil: "load",
    });
    await expect(
      page.getByRole("heading", { name: "Labour & parts", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Labour and parts for this repair job" }),
    ).toBeVisible();
    await expect(
      page.getByText("Item total including VAT", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recorded estimate" }),
    ).toBeVisible();
    await expect(
      page.getByText("Read-only demo job", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add labour or part" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("heading", { name: "Labour & parts", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`repair-items-${width}.png`) });
  }
  expect(errors).toEqual([]);
});
