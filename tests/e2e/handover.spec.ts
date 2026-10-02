import { expect, test, type Page } from "@playwright/test";

// These checks use disposable demo records and mocked writes, never live dealership data.
test.skip(process.env.E2E_USE_SUPABASE === "true", "Demo handover checks must not run against a real database.");
const publicRoutes = ["/", "/cars", "/about", "/contact", "/find-us", "/services", "/repairs", "/book-repair-call", "/source-a-car", "/part-exchange", "/finance", "/privacy", "/terms", "/cookies", "/message-received", "/enquiry-received", "/sourcing-request-received", "/repair-call-booked"];
const adminRoutes = ["/admin", "/admin/stock", "/admin/stock/veh-001", "/admin/stock/new", "/admin/stock/new/review", "/admin/stock/advertising", "/admin/customers", "/admin/customers/new", "/admin/leads", "/admin/sales", "/admin/sales/new", "/admin/sourcing", "/admin/repairs", "/admin/diary", "/admin/invoices", "/admin/invoices/new", "/admin/invoices/new/repair", "/admin/invoices/new/vehicle-sale", "/admin/reports", "/admin/reports/invoices", "/admin/settings", "/admin/settings/invoice-numbering", "/admin/settings/repair-codes", "/admin/documents", "/admin/tasks", "/admin/team", "/admin/website", "/admin/integrations", "/admin/audit", "/admin/health", "/admin/sign-in", "/admin/reset-password", "/admin/accept-invite", "/admin/forbidden"];
for (const route of [...publicRoutes, ...adminRoutes]) {
  test(`handover route renders without page errors or horizontal overflow: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("We could not load this page.", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

async function contactDetails(page: Page, prefix: string) {
  await page.locator(`#${prefix}Name`).fill("Handover Test");
  await page.locator(`#${prefix}Email`).fill("handover@example.test");
  const phone = page.locator(`#${prefix}Phone`);
  if (await phone.count()) await phone.fill("07123 456789");
}
async function createVehicleDetails(page: Page) {
  await page.goto("/admin/stock/new/review?registration=AB12CDE");
  await page.getByLabel("Make", { exact: true }).fill("Ford");
  await page.getByLabel("Model", { exact: true }).fill("Focus");
  await page.getByLabel("Year", { exact: true }).fill("2021");
  await page.getByLabel("Mileage", { exact: true }).fill("25000");
}

test("customer save keeps errors accessible and redirects only after confirmation", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/customers", route => {
    calls++;
    return route.fulfill({ status: calls === 1 ? 400 : 201, json: calls === 1 ? { message: "Check your email.", fieldErrors: { email: ["Use an email address."] } } : { ok: true } });
  });
  await page.goto("/admin/customers/new");
  await page.getByLabel("Full name", { exact: true }).fill("Handover Test");
  await page.getByLabel("Email", { exact: true }).fill("handover@example.test");
  await page.getByRole("button", { name: "Create customer", exact: true }).click();
  const summary = page.getByRole("alert", { name: "Please check this form" });
  await expect(summary).toBeFocused();
  await summary.getByRole("button", { name: "Use an email address." }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Create customer", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/customers$/, { timeout: 15_000 });
  expect(calls).toBe(2);
});

test("photo retry reuses the created vehicle instead of creating a duplicate", async ({ page }) => {
  let creates = 0; let uploads = 0;
  await page.route("**/api/admin/vehicles", route => { creates++; return route.fulfill({ status: 201, json: { ok: true, data: { id: "veh-001" } } }); });
  await page.route("**/api/uploads/vehicle-images", route => { uploads++; return route.fulfill({ status: uploads === 1 ? 503 : 200, json: uploads === 1 ? { message: "Upload unavailable." } : { ok: true } }); });
  await createVehicleDetails(page);
  await page.getByLabel("Vehicle photos", { exact: true }).setInputFiles({ name: "handover.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCxoAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "Create and upload 1 photo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry photo uploads", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry photo uploads", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/stock\/veh-001\?created=1&tab=media/, { timeout: 15_000 });
  expect(creates).toBe(1); expect(uploads).toBe(2);
});

test("an unconfirmed vehicle save blocks another creation", async ({ page }) => {
  let creates = 0;
  await page.route("**/api/admin/vehicles", route => { creates++; return route.fulfill({ status: 201, json: { ok: true } }); });
  await createVehicleDetails(page);
  await page.getByRole("button", { name: "Confirm and create", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(/check stock/i);
  await expect(page.getByRole("button", { name: "Confirm and create", exact: true })).toBeDisabled();
  expect(creates).toBe(1);
});

test("contact validation focuses a summary and links to the invalid field", async ({ page }) => {
  await page.goto("/contact");
  await page.locator('form button[type="submit"]').click();
  const summary = page.getByRole("alert", { name: "Please check this form" });
  await expect(summary).toBeFocused();
  await summary.getByRole("button", { name: "Enter a valid email address" }).click();
  await expect(page.locator("#contactEmail")).toBeFocused();
  await expect(page.locator("#contactEmail")).toHaveAttribute("aria-describedby", "email-error");
});

test("contact enquiry is accepted by the demo API and reaches confirmation", async ({ page }) => {
  await page.goto("/contact");
  await contactDetails(page, "contact");
  await page.locator("#contactMessage").fill("Please arrange a call about your available stock.");
  await page.locator('form input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/message-received$/, { timeout: 15_000 });
});

test("a rejected enquiry retains entries and displays the provider error", async ({ page }) => {
  await page.route("**/api/enquiries", route => route.fulfill({ status: 503, json: { message: "Please contact the dealership." } }));
  await page.goto("/contact");
  await contactDetails(page, "contact");
  await page.locator("#contactMessage").fill("Please arrange a call about your available stock.");
  await page.locator('form input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("alert", { name: "Please check this form" })).toContainText("Please contact the dealership.");
  await expect(page.locator("#contactName")).toHaveValue("Handover Test");
});

test("sourcing request reaches confirmation using the demo API", async ({ page }) => {
  await page.goto("/source-a-car");
  await contactDetails(page, "source");
  await page.locator("#sourceMake").fill("Ford");
  await page.locator("#sourceModel").fill("Focus");
  await page.locator("#sourceBudget").fill("15000");
  await page.locator("#sourceRequirements").fill("Looking for an automatic family car with a full service history.");
  for (const checkbox of await page.locator('form input[type="checkbox"]').all()) await checkbox.check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/sourcing-request-received$/, { timeout: 15_000 });
});

test("part-exchange request reaches confirmation using the demo API", async ({ page }) => {
  await page.goto("/part-exchange");
  for (const [id, value] of Object.entries({ pxFirstName: "Handover", pxSurname: "Test", pxEmail: "handover@example.test", pxPhone: "07123 456789", pxMake: "Ford", pxModel: "Focus", pxRegistration: "AB12CDE", pxMileage: "25000" })) await page.locator(`#${id}`).fill(value);
  await page.locator('form input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/enquiry-received/, { timeout: 15_000 });
});

test("finance enquiry reaches confirmation without making a finance application", async ({ page }) => {
  await page.goto("/finance");
  await contactDetails(page, "fin");
  await page.locator('form input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/enquiry-received/, { timeout: 15_000 });
});

test("vehicle-specific enquiry retains its vehicle link", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await page.route("**/api/enquiries", async route => { payload = route.request().postDataJSON(); await route.continue(); });
  await page.goto("/cars/2022-bmw-320i-m-sport");
  await contactDetails(page, "enquiry");
  await page.locator("#enquiryMessage").fill("Please confirm when I can view this vehicle.");
  await page.locator('form input[type="checkbox"]').first().check();
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/enquiry-received/, { timeout: 15_000 });
  expect(payload.vehicleId).toBe("d0d3d9b0-92d8-4f68-8ef6-000000000001");
});

test("public mobile navigation traps focus, restores the trigger and follows links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Main navigation menu", exact: true });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 15; i++) { await page.keyboard.press("Tab"); expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Cars for sale", exact: true }).click();
  await expect(page).toHaveURL(/\/cars$/);
  await expect(dialog).not.toBeVisible();
});

test("every vehicle workspace section works at phone and desktop widths", async ({ page }) => {
  test.setTimeout(90_000);
  const sections = ["Vehicle details", "Invoices / costs", "Write-up", "Specification", "Features", "Condition & history", "Images", "Videos", "Highlight", "Sales channels", "Documents", "Silent Salesman", "Leads", "Notes", "Audit trail"];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/stock/veh-001");
    for (const label of sections) {
      const button = page.getByRole("button", { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("We could not load this page.", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test("platform administration remains unavailable to the demo dealership owner", async ({ page }) => {
  await page.goto("/platform");
  await expect(page.getByRole("heading", { name: "That page has moved on.", exact: true })).toBeVisible();
  await expect(page.getByText("Platform overview", { exact: true })).toHaveCount(0);
});
