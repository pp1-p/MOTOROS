import "server-only";

import { differenceInCalendarDays } from "date-fns";

import {
  vehicles as demoVehicles,
  type AdminVehicle,
  type AdminVehicleHistory,
  type AdminVehiclePhoto,
} from "@/components/admin/admin-data";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminVehicleInventory = {
  vehicles: AdminVehicle[];
  photosByVehicle: Record<string, AdminVehiclePhoto[]>;
  historyByVehicle: Record<string, AdminVehicleHistory[]>;
  canViewCommercial: boolean;
};

function displayStatus(value: string) {
  const words = value.replaceAll("_", " ");
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function demoInventory(): AdminVehicleInventory {
  return {
    vehicles: demoVehicles,
    canViewCommercial: true,
    historyByVehicle: {},
    photosByVehicle: Object.fromEntries(
      demoVehicles.map((vehicle) => [
        vehicle.id,
        [
          {
            id: `demo-${vehicle.id}`,
            url: vehicle.image,
            altText: `${vehicle.title} front three-quarter view`,
            cover: true,
            status: "ready" as const,
          },
        ],
      ]),
    ),
  };
}

export async function getAdminVehicleInventory(): Promise<AdminVehicleInventory> {
  if (!isSupabaseConfigured()) {
    return isDevelopmentDemoMode()
      ? demoInventory()
      : {
          vehicles: [],
          photosByVehicle: {},
          historyByVehicle: {},
          canViewCommercial: false,
        };
  }
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service access is required to load the stock workspace.");
  }

  const staff = await getStaffContext();
  if (!staff) throw new Error("A dealership membership is required.");
  const canViewCommercial = hasPermission(staff.role, "commercial:view");
  const canViewHistory = hasPermission(staff.role, "audit:view");
  const presentationOnly = staff.role === "website_editor";

  const supabase = createAdminSupabaseClient();
  const [vehicleResult, imageResult, historyResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_images")
      .select(
        "id,vehicle_id,storage_bucket,storage_path,external_url,alt_text,is_cover,sort_order",
      )
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    canViewHistory
      ? supabase
          .from("audit_logs")
          .select("id,entity_id,action,change_reason,created_at,actor_user_id")
          .eq("organisation_id", staff.organisationId)
          .eq("entity_type", "vehicle")
          .order("created_at", { ascending: false })
          .limit(250)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (vehicleResult.error) {
    throw new Error(`Stock could not be loaded: ${vehicleResult.error.message}`);
  }
  if (imageResult.error) {
    throw new Error(`Vehicle photography could not be loaded: ${imageResult.error.message}`);
  }
  if (historyResult.error) {
    throw new Error(`Vehicle history could not be loaded: ${historyResult.error.message}`);
  }

  const photosByVehicle: Record<string, AdminVehiclePhoto[]> = {};
  for (const image of imageResult.data ?? []) {
    const url =
      image.external_url ??
      (image.storage_bucket && image.storage_path
        ? supabase.storage
            .from(image.storage_bucket)
            .getPublicUrl(image.storage_path).data.publicUrl
        : null);
    if (!url) continue;
    const photos = photosByVehicle[image.vehicle_id] ?? [];
    photos.push({
      id: image.id,
      url,
      altText: image.alt_text ?? "Vehicle photograph",
      cover: image.is_cover,
      status: "ready",
    });
    photosByVehicle[image.vehicle_id] = photos;
  }

  const actorIds = [
    ...new Set(
      (historyResult.data ?? [])
        .map((event) => event.actor_user_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const profiles =
    actorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", actorIds)
      : { data: [], error: null };
  const actorNames = new Map(
    (profiles.data ?? []).map((profile) => [
      profile.id,
      profile.display_name ?? profile.full_name ?? "Team member",
    ]),
  );
  const historyByVehicle: Record<string, AdminVehicleHistory[]> = {};
  for (const event of historyResult.data ?? []) {
    if (!event.entity_id) continue;
    const events = historyByVehicle[event.entity_id] ?? [];
    events.push({
      id: event.id,
      title: String(event.action).replaceAll(".", " ").replaceAll("_", " "),
      detail: event.change_reason ?? "Recorded by DealerOS",
      time: new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      }).format(new Date(event.created_at)),
      actor: event.actor_user_id
        ? actorNames.get(event.actor_user_id) ?? "Team member"
        : "System",
    });
    historyByVehicle[event.entity_id] = events;
  }

  const vehicles = (vehicleResult.data ?? []).map((row): AdminVehicle => {
    const photos = photosByVehicle[row.id] ?? [];
    const purchasePrice = numeric(row.purchase_price);
    const preparationCosts = numeric(row.preparation_costs);
    const repairCosts = numeric(row.repair_costs);
    const otherCosts = numeric(row.other_costs);
    const title =
      row.public_title ??
      [row.make, row.model, row.derivative].filter(Boolean).join(" ");
    return {
      id: row.id,
      stockNumber: row.stock_number,
      registration: row.registration ?? "Unregistered",
      title,
      year: numeric(row.year),
      mileage: numeric(row.mileage),
      price: numeric(row.retail_price),
      cost: canViewCommercial
        ? purchasePrice + preparationCosts + repairCosts + otherCosts
        : 0,
      status: displayStatus(row.status),
      age: Math.max(
        0,
        differenceInCalendarDays(
          new Date(),
          new Date(row.acquired_at ?? row.created_at),
        ),
      ),
      image: photos.find((photo) => photo.cover)?.url ?? photos[0]?.url ?? "",
      slug: row.slug,
      vin: presentationOnly ? null : row.vin,
      make: row.make,
      model: row.model,
      derivative: row.derivative,
      bodyType: row.body_type,
      fuelType: row.fuel_type,
      transmission: row.transmission,
      colour: row.colour,
      doors: row.doors,
      seats: row.seats,
      engineSizeCc: row.engine_size_cc,
      powerBhp: numeric(row.power_bhp) || null,
      co2EmissionsGKm: numeric(row.co2_emissions_g_km) || null,
      motExpiry: row.mot_expiry,
      previousOwners: row.previous_owners,
      serviceHistory: row.service_history,
      keys: row.number_of_keys,
      provenanceStatus: presentationOnly ? null : row.provenance_status,
      inspectionNotes: presentationOnly ? null : row.inspection_notes,
      attentionGrabber: row.attention_grabber,
      description: row.description,
      features: Array.isArray(row.features) ? row.features : [],
      featured: Boolean(row.featured || row.is_featured),
      isPublic: Boolean(row.is_public),
      purchasePrice: canViewCommercial ? purchasePrice : 0,
      preparationCosts: canViewCommercial ? preparationCosts : 0,
      repairCosts: canViewCommercial ? repairCosts : 0,
      otherCosts: canViewCommercial ? otherCosts : 0,
      minimumAcceptablePrice:
        !canViewCommercial || row.minimum_acceptable_price === null
          ? null
          : numeric(row.minimum_acceptable_price),
      depositAmount: canViewCommercial ? numeric(row.deposit_amount) : 0,
      actualSalePrice:
        !canViewCommercial || row.actual_sale_price === null
          ? null
          : numeric(row.actual_sale_price),
    };
  });

  return { vehicles, photosByVehicle, historyByVehicle, canViewCommercial };
}
