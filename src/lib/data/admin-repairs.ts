import "server-only";

import { addDays, formatISO } from "date-fns";

import { repairJobs as demoRepairJobs } from "@/components/admin/admin-data";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const repairStatusValues = [
  "awaiting_inspection",
  "diagnosing",
  "estimate_preparing",
  "awaiting_customer_approval",
  "approved",
  "parts_ordered",
  "parts_received",
  "work_in_progress",
  "quality_check",
  "ready_for_collection",
  "collected",
  "cancelled",
] as const;

export type RepairStatus = (typeof repairStatusValues)[number];

export type RepairTechnician = {
  id: string;
  name: string;
};

export type AdminRepairListItem = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  vehicle: string;
  registration: string;
  reportedFault: string;
  status: RepairStatus;
  technicianName: string;
  dueDate: string | null;
  estimateTotal: number;
  approvalStatus: string;
  paymentStatus: string;
};

export type RepairJobItem = {
  id: string;
  description: string;
  itemType: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineTotal: number;
  status: string;
};

export type RepairDocument = {
  id: string;
  name: string;
  byteSize: number;
  mimeType: string;
  visibility: string;
};

export type RepairTimelineEntry = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
};

export type AdminRepairDetail = AdminRepairListItem & {
  mileage: number | null;
  diagnosis: string | null;
  technicianNotes: string | null;
  customerFacingNotes: string | null;
  workCompleted: string | null;
  assignedTechnicianId: string | null;
  estimateNet: number;
  estimateVat: number;
  startDate: string | null;
  collectionDate: string | null;
  items: RepairJobItem[];
  documents: RepairDocument[];
  timeline: RepairTimelineEntry[];
  technicians: RepairTechnician[];
};

export type RepairWorkspace = {
  jobs: AdminRepairListItem[];
  isDemo: boolean;
  metrics: {
    inProgress: number;
    awaitingApproval: number;
    readyForCollection: number;
    openEstimateTotal: number;
  };
};

const demoIds = [
  "00000000-0000-4000-8000-000000001092",
  "00000000-0000-4000-8000-000000001091",
  "00000000-0000-4000-8000-000000001089",
  "00000000-0000-4000-8000-000000001088",
  "00000000-0000-4000-8000-000000001086",
] as const;

const demoStatuses: RepairStatus[] = [
  "diagnosing",
  "work_in_progress",
  "awaiting_customer_approval",
  "ready_for_collection",
  "parts_ordered",
];

const demoEstimates = [0, 684, 492.5, 378, 563];

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function displayRepairStatus(status: string) {
  const words = status.replaceAll("_", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function demoDueDate(index: number) {
  const dayOffset = index < 2 || index === 3 ? 0 : index === 2 ? 1 : 3;
  return formatISO(addDays(new Date(), dayOffset), { representation: "date" });
}

function getDemoJobs(): AdminRepairListItem[] {
  return demoRepairJobs.map((job, index) => ({
    id: demoIds[index] ?? `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    reference: job.id,
    customerName: job.customer,
    customerEmail: `${job.customer.toLowerCase().replaceAll(" ", ".")}@example.com`,
    customerPhone: "07700 900318",
    vehicle: job.vehicle,
    registration: job.registration,
    reportedFault: job.summary,
    status: demoStatuses[index] ?? "awaiting_inspection",
    technicianName: job.technician,
    dueDate: demoDueDate(index),
    estimateTotal: demoEstimates[index] ?? 0,
    approvalStatus: index === 2 ? "requested" : "not_requested",
    paymentStatus: "not_invoiced",
  }));
}

function getMetrics(jobs: AdminRepairListItem[]) {
  const openJobs = jobs.filter(
    (job) => !["collected", "cancelled"].includes(job.status),
  );
  return {
    inProgress: openJobs.length,
    awaitingApproval: jobs.filter(
      (job) =>
        job.status === "awaiting_customer_approval" ||
        job.approvalStatus === "requested",
    ).length,
    readyForCollection: jobs.filter(
      (job) => job.status === "ready_for_collection",
    ).length,
    openEstimateTotal: openJobs.reduce(
      (total, job) => total + job.estimateTotal,
      0,
    ),
  };
}

function searchable(job: AdminRepairListItem, search: string) {
  const needle = search.trim().toLocaleLowerCase("en-GB");
  if (!needle) return true;
  return [
    job.reference,
    job.customerName,
    job.customerEmail,
    job.customerPhone,
    job.vehicle,
    job.registration,
    job.reportedFault,
    displayRepairStatus(job.status),
    job.technicianName,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("en-GB").includes(needle));
}

function profileName(profile: unknown, fallback = "Unassigned") {
  const value = Array.isArray(profile) ? profile[0] : profile;
  if (!value || typeof value !== "object") return fallback;
  const row = value as { display_name?: string | null; full_name?: string | null };
  return row.display_name ?? row.full_name ?? fallback;
}

async function getOrganisationMembers(
  organisationId: string,
): Promise<{
  names: Map<string, string>;
  technicians: RepairTechnician[];
}> {
  const supabase = createAdminSupabaseClient();
  const result = await supabase
    .from("organisation_members")
    .select("user_id,role,profiles(display_name,full_name)")
    .eq("organisation_id", organisationId)
    .eq("status", "active")
    .is("deleted_at", null);
  if (result.error) {
    throw new Error(`Repair team could not be loaded: ${result.error.message}`);
  }

  const names = new Map<string, string>();
  const technicians: RepairTechnician[] = [];
  for (const member of result.data ?? []) {
    const name = profileName(member.profiles, "Team member");
    names.set(member.user_id, name);
    if (member.role === "technician") {
      technicians.push({ id: member.user_id, name });
    }
  }
  technicians.sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
  return { names, technicians };
}

function customerName(customer: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  return (
    customer.full_name ??
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ??
    "Unknown customer"
  );
}

export async function getRepairWorkspace(search = ""): Promise<RepairWorkspace> {
  if (!isSupabaseConfigured()) {
    if (!isDevelopmentDemoMode()) {
      throw new Error(
        "Supabase is not configured. Repair fixtures are available only in explicit development demo mode.",
      );
    }
    const allJobs = getDemoJobs();
    return {
      jobs: allJobs.filter((job) => searchable(job, search)),
      isDemo: true,
      metrics: getMetrics(allJobs),
    };
  }
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service access is required to load repairs.");
  }

  const staff = await getStaffContext();
  if (!staff) throw new Error("A dealership membership is required.");
  if (!hasPermission(staff.role, "repairs:view")) {
    throw new Error("Repair access is required.");
  }
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("repair_jobs")
    .select(
      "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,reported_fault,due_date,estimate_total,approval_status,payment_status,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (staff.role === "technician") {
    query = query.eq("assigned_technician_id", staff.userId);
  }
  const jobsResult = await query;
  if (jobsResult.error) {
    throw new Error(`Repairs could not be loaded: ${jobsResult.error.message}`);
  }

  const customerIds = [
    ...new Set((jobsResult.data ?? []).map((job) => job.customer_id)),
  ];
  const [customersResult, members] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("id,full_name,first_name,last_name,email,phone")
          .eq("organisation_id", staff.organisationId)
          .in("id", customerIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    getOrganisationMembers(staff.organisationId),
  ]);
  if (customersResult.error) {
    throw new Error(`Repair customers could not be loaded: ${customersResult.error.message}`);
  }

  const customers = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const allJobs = (jobsResult.data ?? []).map((job): AdminRepairListItem => {
    const customer = customers.get(job.customer_id);
    return {
      id: job.id,
      reference: job.reference,
      customerName: customer ? customerName(customer) : "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      vehicle: job.vehicle_make_model ?? "Vehicle details pending",
      registration: job.registration ?? "Not recorded",
      reportedFault: job.reported_fault,
      status: job.status as RepairStatus,
      technicianName: job.assigned_technician_id
        ? (members.names.get(job.assigned_technician_id) ?? "Team member")
        : "Unassigned",
      dueDate: job.due_date,
      estimateTotal: numberValue(job.estimate_total),
      approvalStatus: job.approval_status,
      paymentStatus: job.payment_status,
    };
  });

  return {
    jobs: allJobs.filter((job) => searchable(job, search)),
    isDemo: false,
    metrics: getMetrics(allJobs),
  };
}

function getDemoDetail(idOrReference: string): AdminRepairDetail | null {
  const jobs = getDemoJobs();
  const job = jobs.find(
    (candidate) =>
      candidate.id === idOrReference ||
      candidate.reference.toUpperCase() === idOrReference.toUpperCase(),
  );
  if (!job) return null;
  const index = jobs.indexOf(job);
  const estimateNet = Math.round((job.estimateTotal / 1.2) * 100) / 100;
  return {
    ...job,
    mileage: 68_421 + index * 1_307,
    diagnosis:
      index === 0
        ? "Intermittent sensor signal confirmed during diagnostic testing. Replacement and a verification road test are recommended."
        : "Initial inspection completed and the findings have been recorded for customer review.",
    technicianNotes:
      "Check all related connectors and record final test readings before quality control.",
    customerFacingNotes:
      "We have inspected the vehicle and will confirm the recommended work before proceeding.",
    workCompleted: null,
    assignedTechnicianId:
      index % 2 === 0
        ? "00000000-0000-4000-8000-000000000101"
        : "00000000-0000-4000-8000-000000000102",
    estimateNet,
    estimateVat: Math.round((job.estimateTotal - estimateNet) * 100) / 100,
    startDate: formatISO(addDays(new Date(), -1), { representation: "date" }),
    collectionDate: null,
    items: job.estimateTotal
      ? [
          {
            id: "00000000-0000-4000-8000-000000000201",
            description: "Diagnostic investigation",
            itemType: "labour",
            quantity: 1.5,
            unitPrice: 78,
            vatRate: 20,
            lineTotal: 117,
            status: "completed",
          },
          {
            id: "00000000-0000-4000-8000-000000000202",
            description: "Replacement parts and workshop materials",
            itemType: "part",
            quantity: 1,
            unitPrice: Math.max(0, estimateNet - 117),
            vatRate: 20,
            lineTotal: Math.max(0, estimateNet - 117),
            status: "planned",
          },
        ]
      : [],
    documents: [],
    timeline: [
      {
        id: "demo-diagnosis",
        title: "Diagnosis recorded",
        detail: job.technicianName,
        occurredAt: new Date().toISOString(),
      },
      {
        id: "demo-created",
        title: "Repair job created",
        detail: "Demo repair workflow",
        occurredAt: addDays(new Date(), -1).toISOString(),
      },
    ],
    technicians: [
      {
        id: "00000000-0000-4000-8000-000000000101",
        name: "Ben Carter",
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        name: "Chris Webb",
      },
    ],
  };
}

export async function getRepairDetail(
  idOrReference: string,
): Promise<{ job: AdminRepairDetail | null; isDemo: boolean; canManage: boolean }> {
  if (!isSupabaseConfigured()) {
    if (!isDevelopmentDemoMode()) {
      throw new Error(
        "Supabase is not configured. Repair fixtures are available only in explicit development demo mode.",
      );
    }
    return { job: getDemoDetail(idOrReference), isDemo: true, canManage: false };
  }
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service access is required to load this repair.");
  }

  const staff = await getStaffContext();
  if (!staff) throw new Error("A dealership membership is required.");
  if (!hasPermission(staff.role, "repairs:view")) {
    throw new Error("Repair access is required.");
  }
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("repair_jobs")
    .select(
      "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,technician_notes,customer_facing_notes,estimate_net,estimate_vat,estimate_total,approval_status,payment_status,start_date,due_date,collection_date",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null);
  query = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idOrReference,
  )
    ? query.eq("id", idOrReference)
    : query.eq("reference", idOrReference.toUpperCase());
  if (staff.role === "technician") {
    query = query.eq("assigned_technician_id", staff.userId);
  }
  const jobResult = await query.maybeSingle();
  if (jobResult.error) {
    throw new Error(`Repair could not be loaded: ${jobResult.error.message}`);
  }
  if (!jobResult.data) {
    return {
      job: null,
      isDemo: false,
      canManage: hasPermission(staff.role, "repairs:manage"),
    };
  }
  const row = jobResult.data;

  const [customerResult, itemsResult, documentsResult, auditResult, members] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id,full_name,first_name,last_name,email,phone")
        .eq("id", row.customer_id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("repair_job_items")
        .select(
          "id,description,item_type,quantity,unit_price,vat_rate,line_total,status,sort_order",
        )
        .eq("repair_job_id", row.id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true }),
      supabase
        .from("documents")
        .select("id,title,file_name,byte_size,size_bytes,mime_type,visibility")
        .eq("repair_job_id", row.id)
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_logs")
        .select("id,action,change_reason,actor_user_id,occurred_at")
        .eq("organisation_id", staff.organisationId)
        .or(`entity_id.eq.${row.id},record_id.eq.${row.id}`)
        .order("occurred_at", { ascending: false })
        .limit(30),
      getOrganisationMembers(staff.organisationId),
    ]);
  if (customerResult.error) {
    throw new Error(`Repair customer could not be loaded: ${customerResult.error.message}`);
  }
  if (itemsResult.error) {
    throw new Error(`Repair items could not be loaded: ${itemsResult.error.message}`);
  }
  if (documentsResult.error) {
    throw new Error(`Repair documents could not be loaded: ${documentsResult.error.message}`);
  }
  if (auditResult.error) {
    throw new Error(`Repair activity could not be loaded: ${auditResult.error.message}`);
  }

  const customer = customerResult.data;
  const items = (itemsResult.data ?? []).map(
    (item): RepairJobItem => ({
      id: item.id,
      description: item.description,
      itemType: item.item_type,
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
      vatRate: numberValue(item.vat_rate),
      lineTotal: numberValue(item.line_total),
      status: item.status,
    }),
  );
  const timeline = (auditResult.data ?? []).map(
    (entry): RepairTimelineEntry => ({
      id: entry.id,
      title: displayRepairStatus(entry.action.replaceAll(".", "_")),
      detail:
        entry.change_reason ??
        (entry.actor_user_id
          ? (members.names.get(entry.actor_user_id) ?? "Team member")
          : "System"),
      occurredAt: entry.occurred_at,
    }),
  );
  if (timeline.length === 0) {
    timeline.push({
      id: `created-${row.id}`,
      title: "Repair job loaded",
      detail: "No recorded changes yet",
      occurredAt: row.start_date
        ? new Date(`${row.start_date}T09:00:00Z`).toISOString()
        : new Date().toISOString(),
    });
  }
  const technicians = [...members.technicians];
  if (
    row.assigned_technician_id &&
    !technicians.some((technician) => technician.id === row.assigned_technician_id)
  ) {
    technicians.push({
      id: row.assigned_technician_id,
      name: members.names.get(row.assigned_technician_id) ?? "Currently assigned team member",
    });
  }

  return {
    isDemo: false,
    canManage: hasPermission(staff.role, "repairs:manage"),
    job: {
      id: row.id,
      reference: row.reference,
      customerName: customer ? customerName(customer) : "Unknown customer",
      customerEmail: customer?.email ?? null,
      customerPhone: customer?.phone ?? null,
      vehicle: row.vehicle_make_model ?? "Vehicle details pending",
      registration: row.registration ?? "Not recorded",
      reportedFault: row.reported_fault,
      status: row.status as RepairStatus,
      technicianName: row.assigned_technician_id
        ? (members.names.get(row.assigned_technician_id) ?? "Team member")
        : "Unassigned",
      dueDate: row.due_date,
      estimateTotal: numberValue(row.estimate_total),
      approvalStatus: row.approval_status,
      paymentStatus: row.payment_status,
      mileage: row.mileage,
      diagnosis: row.diagnosis,
      technicianNotes: row.technician_notes,
      customerFacingNotes: row.customer_facing_notes,
      workCompleted: row.work_completed,
      assignedTechnicianId: row.assigned_technician_id,
      estimateNet: numberValue(row.estimate_net),
      estimateVat: numberValue(row.estimate_vat),
      startDate: row.start_date,
      collectionDate: row.collection_date,
      items,
      documents: (documentsResult.data ?? []).map(
        (document): RepairDocument => ({
          id: document.id,
          name: document.file_name ?? document.title ?? "Repair document",
          byteSize: numberValue(document.byte_size ?? document.size_bytes),
          mimeType: document.mime_type,
          visibility: document.visibility,
        }),
      ),
      timeline,
      technicians,
    },
  };
}
