import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { parseCsv } from "@/lib/csv";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { validateAndNormaliseRegistration } from "@/lib/vehicle-lookup/registration";

const rowSchema = z.object({
  registration: z.string().min(2),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(100),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 1),
  mileage: z.coerce.number().int().min(0).max(2_000_000),
  fuel_type: z.string().min(1).max(80),
  transmission: z.string().min(1).max(80),
  colour: z.string().max(80).optional(),
  retail_price: z.coerce.number().min(0).max(20_000_000),
  public_title: z.string().min(3).max(180).optional(),
  description: z.string().max(20_000).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "stock:manage")) {
    return NextResponse.json({ message: "Stock-management access is required." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const commit = form?.get("commit") === "true";
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ message: "Choose a CSV file no larger than 2 MB." }, { status: 400 });
  }
  const text = await file.text();
  if (text.includes("\0")) {
    return NextResponse.json({ message: "The CSV contains invalid binary data." }, { status: 400 });
  }

  let rows: ReturnType<typeof parseCsv>;
  try {
    rows = parseCsv(text);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "The CSV could not be read." },
      { status: 400 },
    );
  }
  if (rows.length > 1000) {
    return NextResponse.json({ message: "Imports are limited to 1,000 vehicles at a time." }, { status: 400 });
  }

  const valid: Array<z.infer<typeof rowSchema> & { registrationNormalised: string; rowNumber: number }> = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parsed = rowSchema.safeParse(row.values);
    if (!parsed.success) {
      errors.push({
        row: row.rowNumber,
        message: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
      continue;
    }
    try {
      const registrationNormalised = validateAndNormaliseRegistration(parsed.data.registration);
      if (seen.has(registrationNormalised)) {
        errors.push({ row: row.rowNumber, message: "Duplicate registration in CSV." });
        continue;
      }
      seen.add(registrationNormalised);
      valid.push({ ...parsed.data, registrationNormalised, rowNumber: row.rowNumber });
    } catch (error) {
      errors.push({ row: row.rowNumber, message: error instanceof Error ? error.message : "Invalid registration." });
    }
  }

  if (!commit || errors.length > 0) {
    return NextResponse.json({
      ok: errors.length === 0,
      preview: true,
      validRows: valid.length,
      errors,
      message:
        errors.length > 0
          ? "Resolve every row error before importing. Nothing has been saved."
          : `${valid.length} rows are ready to import.`,
    });
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("vehicles")
    .select("registration_normalised")
    .eq("organisation_id", staff.organisationId)
    .in("registration_normalised", valid.map((row) => row.registrationNormalised))
    .is("deleted_at", null);
  const existingSet = new Set(
    (existing.data ?? []).map((row) => row.registration_normalised as string),
  );
  if (existingSet.size > 0) {
    return NextResponse.json(
      {
        message: "Some registrations already exist. Nothing has been imported.",
        errors: valid
          .filter((row) => existingSet.has(row.registrationNormalised))
          .map((row) => ({ row: row.rowNumber, message: "Registration already exists in stock." })),
      },
      { status: 409 },
    );
  }

  const insert = await supabase.from("vehicles").insert(
    valid.map((row) => ({
      organisation_id: staff.organisationId,
      created_by: staff.userId,
      registration: row.registrationNormalised,
      registration_normalised: row.registrationNormalised,
      stock_number: `DOS-${new Date().getUTCFullYear().toString().slice(-2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      make: row.make,
      model: row.model,
      year: row.year,
      mileage: row.mileage,
      fuel_type: row.fuel_type,
      transmission: row.transmission,
      colour: row.colour || null,
      retail_price: row.retail_price,
      public_title: row.public_title || `${row.year} ${row.make} ${row.model}`,
      description:
        row.description ||
        "Imported stock record. Complete and verify the advert description before publication.",
      status: "appraisal",
      is_public: false,
      slug: `${row.year}-${row.make}-${row.model}-${crypto.randomUUID().slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-"),
    })),
  );
  if (insert.error) {
    return NextResponse.json(
      { message: "The CSV import failed atomically; review the file and retry." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    imported: valid.length,
    message: `${valid.length} vehicles imported into appraisal.`,
  });
}
