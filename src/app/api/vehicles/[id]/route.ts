import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { vehicleUpdateSchema } from "@/lib/validation/vehicle";
import { validateAndNormaliseRegistration } from "@/lib/vehicle-lookup/registration";

const idSchema = z.uuid();
const commercialFields = new Set([
  "purchasePrice",
  "preparationCosts",
  "repairCosts",
  "otherCosts",
  "minimumAcceptablePrice",
  "actualSalePrice",
]);
const costSummaryFields = new Set([
  "purchasePrice",
  "preparationCosts",
  "repairCosts",
  "otherCosts",
  "minimumAcceptablePrice",
]);
const websiteEditorFields = new Set([
  "publicTitle",
  "attentionGrabber",
  "description",
  "features",
  "standardEquipment",
  "optionalEquipment",
  "financeExampleText",
  "warrantyWording",
  "videoUrl",
  "featured",
  "isPublic",
  "changeReason",
]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  if (!hasPermission(staff.role, "stock:manage") && !hasPermission(staff.role, "website:manage")) {
    return NextResponse.json({ message: "You do not have permission to edit this vehicle." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Invalid vehicle ID." }, { status: 400 });
  }
  const payload = await request.json().catch(() => null);
  const parsed = vehicleUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the vehicle changes.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (
    !hasPermission(staff.role, "commercial:view") &&
    Object.keys(payload as Record<string, unknown>).some((key) => commercialFields.has(key))
  ) {
    return NextResponse.json({ message: "Commercial fields require manager access." }, { status: 403 });
  }
  if (
    staff.role === "website_editor" &&
    Object.keys(payload as Record<string, unknown>).some(
      (key) => !websiteEditorFields.has(key),
    )
  ) {
    return NextResponse.json(
      { message: "Website editors can change presentation fields only." },
      { status: 403 },
    );
  }

  const input = parsed.data;
  const vehicleUpdates: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    registration: "registration",
    stockNumber: "stock_number",
    make: "make",
    model: "model",
    derivative: "derivative",
    trim: "trim",
    bodyType: "body_type",
    fuelType: "fuel_type",
    transmission: "transmission",
    colour: "colour",
    doors: "doors",
    seats: "seats",
    engineSizeCc: "engine_size_cc",
    powerBhp: "power_bhp",
    co2EmissionsGKm: "co2_emissions_g_km",
    euroStatus: "euro_status",
    year: "year",
    firstRegistrationDate: "first_registration_date",
    motExpiry: "mot_expiry",
    taxStatus: "tax_status",
    previousOwners: "previous_owners",
    mileage: "mileage",
    serviceHistory: "service_history",
    keys: "number_of_keys",
    warranty: "warranty",
    inspectionNotes: "inspection_notes",
    knownFaults: "known_faults",
    provenanceStatus: "provenance_status",
    retailPrice: "retail_price",
    depositAmount: "deposit_amount",
    actualSalePrice: "actual_sale_price",
    publicTitle: "public_title",
    attentionGrabber: "attention_grabber",
    description: "description",
    features: "features",
    standardEquipment: "standard_equipment",
    optionalEquipment: "optional_equipment",
    financeExampleText: "finance_example_text",
    warrantyWording: "warranty_wording",
    videoUrl: "video_url",
    featured: "is_featured",
    isPublic: "is_public",
    status: "status",
    slug: "slug",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (key in input) vehicleUpdates[column] = input[key as keyof typeof input];
  }
  if (input.registration !== undefined) {
    try {
      vehicleUpdates.registration_normalised =
        validateAndNormaliseRegistration(input.registration);
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "Invalid registration.",
        },
        { status: 400 },
      );
    }
  }
  if (input.standardEquipment !== undefined) {
    vehicleUpdates.standard_equipment = input.standardEquipment.join("\n");
  }
  if (input.optionalEquipment !== undefined) {
    vehicleUpdates.optional_equipment = input.optionalEquipment.join("\n");
  }
  if (input.featured !== undefined) {
    vehicleUpdates.featured = input.featured;
  }

  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("vehicles")
    .select(
      "id,retail_price,status,is_public,estimated_gross_profit,slug,public_title,description",
    )
    .eq("id", id)
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .single();
  if (!existing.data) return NextResponse.json({ message: "Vehicle not found." }, { status: 404 });

  if (input.isPublic === true) {
    const finalStatus = input.status ?? existing.data.status;
    const finalPrice = input.retailPrice ?? existing.data.retail_price;
    const finalSlug = input.slug ?? existing.data.slug;
    const finalTitle = input.publicTitle ?? existing.data.public_title;
    const finalDescription = input.description ?? existing.data.description;
    const cover = await supabase
      .from("vehicle_images")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", id)
      .eq("organisation_id", staff.organisationId)
      .eq("is_cover", true)
      .is("deleted_at", null);
    const eligibleStatus = [
      "ready_for_sale",
      "on_forecourt",
      "reserved",
      "sold",
    ].includes(finalStatus);
    if (
      !eligibleStatus ||
      !finalSlug ||
      !finalTitle ||
      !finalDescription ||
      !finalPrice ||
      (cover.count ?? 0) < 1
    ) {
      return NextResponse.json(
        {
          message:
            "Add a public title, description, price, valid slug and cover photo, then move the vehicle to an eligible sales status before publishing.",
        },
        { status: 422 },
      );
    }
  }

  const hasCostChanges = Object.keys(input).some((key) =>
    costSummaryFields.has(key),
  );

  let costsPayload: Record<string, number | null> | null = null;
  if (hasCostChanges) {
    costsPayload = {};
    if (input.purchasePrice !== undefined) {
      costsPayload.purchase_price = input.purchasePrice;
    }
    if (input.preparationCosts !== undefined) {
      costsPayload.preparation_costs = input.preparationCosts;
    }
    if (input.repairCosts !== undefined) {
      costsPayload.repair_costs = input.repairCosts;
    }
    if (input.otherCosts !== undefined) {
      costsPayload.other_costs = input.otherCosts;
    }
    if ("minimumAcceptablePrice" in input) {
      costsPayload.minimum_acceptable_price =
        input.minimumAcceptablePrice ?? null;
    }
  }

  const update = await supabase.rpc("update_vehicle_with_costs", {
    p_organisation_id: staff.organisationId,
    p_vehicle_id: id,
    p_actor_user_id: staff.userId,
    p_vehicle_changes: vehicleUpdates,
    p_costs: costsPayload,
    p_change_reason: input.changeReason,
  });
  const vehicle = update.data as
    | { id: string; slug: string | null; status: string; is_public: boolean }
    | null;
  if (update.error || !vehicle) {
    const invalidState = update.error?.code === "23514";
    return NextResponse.json(
      {
        message:
          update.error?.code === "23505"
            ? "This registration, stock number or public URL is already in use."
            : invalidState
              ? update.error?.message ??
                "Review the public listing requirements."
            : "The vehicle and commercial changes could not be saved. No fields were changed.",
      },
      {
        status:
          update.error?.code === "23505" ? 409 : invalidState ? 422 : 500,
      },
    );
  }

  return NextResponse.json({ ok: true, message: "Vehicle updated.", vehicle });
}
