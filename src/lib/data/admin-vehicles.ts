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

export type VehicleRelatedRecord = {
  id: string;
  title: string;
  detail?: string | null;
  status?: string | null;
  amount?: number | null;
  date?: string | null;
  href?: string | null;
};

export type VehicleFeatureRecord = {
  id: string;
  category: string;
  name: string;
  isHighlight: boolean;
};

export type VehicleChannelRecord = {
  id: string;
  channel: string;
  status: string;
  externalStockId?: string | null;
  externalDerivativeId?: string | null;
  listingTitle?: string | null;
  listingSubtitle?: string | null;
  category?: string | null;
  listingUrl?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

export type VehicleWorkspaceData = {
  costs: VehicleRelatedRecord[];
  invoices: VehicleRelatedRecord[];
  leads: VehicleRelatedRecord[];
  documents: VehicleRelatedRecord[];
  serviceRecords: VehicleRelatedRecord[];
  notes: VehicleRelatedRecord[];
  videos: VehicleRelatedRecord[];
  features: VehicleFeatureRecord[];
  channels: VehicleChannelRecord[];
};

const emptyWorkspaceData = (): VehicleWorkspaceData => ({
  costs: [],
  invoices: [],
  leads: [],
  documents: [],
  serviceRecords: [],
  notes: [],
  videos: [],
  features: [],
  channels: [],
});

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
          .select("id,entity_id,action,change_reason,occurred_at,actor_user_id")
          .eq("organisation_id", staff.organisationId)
          .eq("entity_type", "vehicle")
          .order("occurred_at", { ascending: false })
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
      }).format(new Date(event.occurred_at)),
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
      vatStatus: row.vat_status,
      capId: row.cap_id,
      plate: row.plate,
      interiorColour: row.interior_colour,
      interiorMaterial: row.interior_material,
      fuelConsumptionUrbanMpg:
        row.fuel_consumption_urban_mpg === null
          ? null
          : numeric(row.fuel_consumption_urban_mpg),
      fuelConsumptionExtraUrbanMpg:
        row.fuel_consumption_extra_urban_mpg === null
          ? null
          : numeric(row.fuel_consumption_extra_urban_mpg),
      fuelConsumptionCombinedMpg:
        row.fuel_consumption_combined_mpg === null
          ? null
          : numeric(row.fuel_consumption_combined_mpg),
      euroEmissionsStandard: row.euro_emissions_standard,
      insuranceGroup: row.insurance_group,
      roadTaxAnnual:
        row.road_tax_annual === null ? null : numeric(row.road_tax_annual),
      ulezStatus: row.ulez_status,
      wheelchairAccessible: row.wheelchair_accessible,
      acceleration060Seconds:
        row.acceleration_0_60_seconds === null
          ? null
          : numeric(row.acceleration_0_60_seconds),
      topSpeedMph: row.top_speed_mph,
      torqueLbFt: row.torque_lb_ft,
      aspiration: row.aspiration,
      engineLocation: row.engine_location,
      engineNumber: row.engine_number,
      chassisNumber: row.chassis_number,
      cylinderCount: row.cylinder_count,
      gearCount: row.gear_count,
      driveType: row.drive_type,
      grossWeightKg: row.gross_weight_kg,
      lengthMm: row.length_mm,
      widthMm: row.width_mm,
      firstRegistrationDate: row.first_registration_date,
      acquiredAt: row.acquired_at,
      keeperStartDate: row.keeper_start_date,
      advertisedCondition: row.advertised_condition,
      insuranceWriteOffCategory: row.insurance_write_off_category,
      serviceHistoryVisible: row.service_history_visible,
      serviceHistorySummary: row.service_history_summary,
      silentSalesmanHeadline: row.silent_salesman_headline,
      silentSalesmanSummary: row.silent_salesman_summary,
      silentSalesmanCallToAction: row.silent_salesman_call_to_action,
      standardEquipment:
        typeof row.standard_equipment === "string"
          ? row.standard_equipment.split(/\r?\n/).filter(Boolean)
          : [],
      optionalEquipment:
        typeof row.optional_equipment === "string"
          ? row.optional_equipment.split(/\r?\n/).filter(Boolean)
          : [],
      videoUrl: row.video_url,
      autotraderPublicationStatus: row.autotrader_publication_status,
      autotraderStockId: row.autotrader_stock_id,
      autotraderReference: row.autotrader_reference,
    };
  });

  return { vehicles, photosByVehicle, historyByVehicle, canViewCommercial };
}

export async function getVehicleWorkspaceData(
  vehicleId: string,
): Promise<VehicleWorkspaceData> {
  if (!isSupabaseConfigured()) return emptyWorkspaceData();
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service access is required to load vehicle records.");
  }

  const staff = await getStaffContext();
  if (!staff) throw new Error("A dealership membership is required.");
  const supabase = createAdminSupabaseClient();
  const scope = { organisationId: staff.organisationId, vehicleId };

  const [
    costResult,
    invoiceResult,
    leadResult,
    documentResult,
    serviceResult,
    noteResult,
    videoResult,
    featureResult,
    channelResult,
  ] = await Promise.all([
    supabase
      .from("vehicle_costs")
      .select("id,cost_type,supplier_name,description,amount_net,vat_amount,incurred_on")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .not("cost_type", "is", null)
      .is("deleted_at", null)
      .order("incurred_on", { ascending: false }),
    supabase
      .from("invoices")
      .select("id,invoice_number,invoice_title,type,status,total,issued_at,created_at")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id,reference,title,source,status,priority,due_at,created_at")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id,title,file_name,document_type,visibility,created_at")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_service_records")
      .select("id,service_date,mileage,dealership_name,work_completed")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("service_date", { ascending: false }),
    supabase
      .from("vehicle_notes")
      .select("id,note,is_pinned,created_at")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_videos")
      .select("id,title,video_url,is_public,created_at")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("vehicle_features")
      .select("id,category,name,is_highlight")
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("vehicle_sales_channels")
      .select(
        "id,channel,status,external_stock_id,external_derivative_id,listing_title,listing_subtitle,category,listing_url,last_synced_at,last_error",
      )
      .eq("organisation_id", scope.organisationId)
      .eq("vehicle_id", scope.vehicleId)
      .order("channel", { ascending: true }),
  ]);

  const firstError = [
    costResult,
    invoiceResult,
    leadResult,
    documentResult,
    serviceResult,
    noteResult,
    videoResult,
    featureResult,
    channelResult,
  ].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(`Vehicle workspace could not be loaded: ${firstError.message}`);
  }

  return {
    costs: (costResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.description,
      detail: [row.cost_type, row.supplier_name].filter(Boolean).join(" · "),
      amount: numeric(row.amount_net) + numeric(row.vat_amount),
      date: row.incurred_on,
    })),
    invoices: (invoiceResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.invoice_title ?? row.invoice_number,
      detail: row.invoice_number,
      status: row.status,
      amount: numeric(row.total),
      date: row.issued_at ?? row.created_at,
      href: `/admin/invoices/${row.id}`,
    })),
    leads: (leadResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title ?? row.reference,
      detail: `${row.reference} · ${row.source} · ${row.priority}`,
      status: row.status,
      date: row.due_at ?? row.created_at,
      href: `/admin/leads?lead=${row.id}`,
    })),
    documents: (documentResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title ?? row.file_name ?? "Vehicle document",
      detail: `${row.document_type} · ${row.visibility}`,
      date: row.created_at,
      href: `/api/admin/documents/${row.id}/download`,
    })),
    serviceRecords: (serviceResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.dealership_name ?? "Service record",
      detail: [
        row.mileage === null ? null : `${Number(row.mileage).toLocaleString("en-GB")} miles`,
        row.work_completed,
      ]
        .filter(Boolean)
        .join(" · "),
      date: row.service_date,
    })),
    notes: (noteResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.is_pinned ? "Pinned note" : "Internal note",
      detail: row.note,
      date: row.created_at,
    })),
    videos: (videoResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.is_public ? "Public video" : "Internal video",
      date: row.created_at,
      href: row.video_url,
    })),
    features: (featureResult.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      name: row.name,
      isHighlight: row.is_highlight,
    })),
    channels: (channelResult.data ?? []).map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      externalStockId: row.external_stock_id,
      externalDerivativeId: row.external_derivative_id,
      listingTitle: row.listing_title,
      listingSubtitle: row.listing_subtitle,
      category: row.category,
      listingUrl: row.listing_url,
      lastSyncedAt: row.last_synced_at,
      lastError: row.last_error,
    })),
  };
}
