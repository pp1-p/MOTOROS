import { NextResponse } from "next/server";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { validateAndNormaliseRegistration } from "@/lib/vehicle-lookup/registration";
import { vehicleCreateSchema } from "@/lib/validation/vehicle";

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "stock:manage")) {
    return NextResponse.json({ message: "You do not have permission to create stock." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "Connect Supabase before creating persistent stock records." },
      { status: 503 },
    );
  }

  const parsed = vehicleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Review the vehicle details before saving.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  let registration: string;
  try {
    registration = validateAndNormaliseRegistration(parsed.data.registration);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Invalid registration." },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const duplicate = await supabase
    .from("vehicles")
    .select("id,stock_number")
    .eq("organisation_id", staff.organisationId)
    .eq("registration_normalised", registration)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (duplicate.data) {
    return NextResponse.json(
      {
        message: `This registration already exists as ${duplicate.data.stock_number}.`,
        duplicate: duplicate.data,
      },
      { status: 409 },
    );
  }

  const input = parsed.data;
  const stockNumber = `DOS-${new Date().getUTCFullYear().toString().slice(-2)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const vehiclePayload = {
    registration,
    registration_normalised: registration,
    vin: input.vin,
    stock_number: stockNumber,
    make: input.make,
    model: input.model,
    derivative: input.derivative,
    trim: input.trim,
    body_type: input.bodyType,
    fuel_type: input.fuelType,
    transmission: input.transmission,
    colour: input.colour,
    doors: input.doors,
    seats: input.seats,
    engine_size_cc: input.engineSizeCc,
    power_bhp: input.powerBhp,
    co2_emissions_g_km: input.co2EmissionsGKm,
    euro_status: input.euroStatus,
    year: input.year,
    first_registration_date: input.firstRegistrationDate,
    mot_expiry: input.motExpiry,
    tax_status: input.taxStatus,
    previous_owners: input.previousOwners,
    mileage: input.mileage,
    service_history: input.serviceHistory,
    number_of_keys: input.keys,
    warranty: input.warranty,
    inspection_notes: input.inspectionNotes,
    known_faults: input.knownFaults,
    retail_price: input.retailPrice,
    deposit_amount: input.depositAmount,
    public_title: input.publicTitle,
    attention_grabber: input.attentionGrabber,
    description: input.description,
    features: input.features,
    standard_equipment: input.standardEquipment.join("\n"),
    optional_equipment: input.optionalEquipment.join("\n"),
    finance_example_text: input.financeExampleText,
    warranty_wording: input.warrantyWording,
    video_url: input.videoUrl,
    featured: input.featured,
    is_featured: input.featured,
    // A new vehicle cannot be public until a validated cover image exists.
    is_public: false,
    status: input.status,
    slug: makeSlug(input.publicTitle),
    lookup_provider: input.provider,
    lookup_retrieved_at: input.lookupRetrievedAt,
  };
  const costsPayload = {
    purchase_price: input.purchasePrice,
    preparation_costs: input.preparationCosts,
    repair_costs: input.repairCosts,
    other_costs: input.otherCosts,
    minimum_acceptable_price: input.minimumAcceptablePrice,
  };
  const { data, error } = await supabase.rpc("create_vehicle_with_costs", {
    p_organisation_id: staff.organisationId,
    p_actor_user_id: staff.userId,
    p_vehicle: vehiclePayload,
    p_costs: costsPayload,
  });
  const vehicle = data as
    | {
        id: string;
        slug: string;
        stock_number: string;
        status: string;
        is_public: boolean;
      }
    | null;

  if (error || !vehicle) {
    return NextResponse.json(
      {
        message:
          error?.code === "23505"
            ? "A vehicle with this registration, stock number or public URL already exists."
            : "The vehicle and its commercial costs could not be saved. No stock record was created.",
      },
      { status: error?.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Vehicle created. Add photography before publishing.",
      vehicle,
    },
    { status: 201 },
  );
}
