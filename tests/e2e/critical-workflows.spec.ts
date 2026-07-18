import { expect, test } from "@playwright/test";

function nextBookableWeekday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 3);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test("repair availability exposes slots without private diary data", async ({ request }) => {
  const response = await request.post("/api/availability", {
    data: { date: nextBookableWeekday(), appointmentType: "repair_call" },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body.slots)).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(/customer|internal_notes|staff schedule/i);
});

test("the same repair-call slot cannot be booked twice", async ({ request }) => {
  const date = nextBookableWeekday();
  const availability = await request.post("/api/availability", {
    data: { date, appointmentType: "repair_call" },
  });
  const { slots } = await availability.json();
  test.skip(!slots?.length, "No slot is available in the configured test window.");

  const booking = {
    reason: "Engine warning light",
    registration: "AB12CDE",
    makeModel: "Ford Mondeo",
    faultDescription: "Amber warning light appeared during a normal journey.",
    warningLights: "Amber engine symbol",
    driveable: "yes",
    preferredDate: date,
    timeSlot: slots[0].start,
    name: "Jamie Taylor",
    email: "jamie@example.test",
    phone: "07123 456789",
    preferredContact: "phone",
    consent: "true",
  };

  const first = await request.post("/api/bookings", { multipart: booking });
  expect(first.status()).toBe(200);
  const second = await request.post("/api/bookings", { multipart: booking });
  expect(second.status()).toBe(409);
});

test("unknown mock registration returns manual fallback without invented data", async ({
  request,
}) => {
  const response = await request.post("/api/vehicle-lookup", {
    data: { registration: "ZZ99ZZZ" },
  });
  expect([401, 404]).toContain(response.status());
  const body = await response.json();
  if (response.status() === 404) {
    expect(body.manualFallback).toBe(true);
    expect(body.data).toBeUndefined();
  }
});

test("full authenticated Supabase workflow", async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for the live Supabase journey.",
  );

  await page.goto("/admin/sign-in");
  await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/admin/stock/new");
  await page.getByLabel(/registration/i).fill("DE24 LER");
  await page.getByRole("button", { name: /look up/i }).click();
  await expect(page.getByText(/review|manual/i).first()).toBeVisible();
});
