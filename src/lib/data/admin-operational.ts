import "server-only";

import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfWeek,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import {
  appointments as demoAppointments,
  customers as demoCustomers,
  leads as demoLeads,
  sourcingRequests as demoSourcingRequests,
  tasks as demoTasks,
} from "@/components/admin/admin-data";
import { getStaffContext, type StaffContext } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  AdminCustomerList,
  AdminDiaryList,
  AdminLeadList,
  AdminSalesPipeline,
  AdminSourcingList,
  AdminTaskListItem,
  AdminTeamList,
} from "@/lib/types/admin-operational";

type OperationalClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type MemberDirectoryEntry = {
  userId: string;
  displayName: string;
  role: string;
  status: string;
  invitedEmail: string | null;
  lastSeenAt: string | null;
  joinedAt: string | null;
  createdAt: string;
};

type LiveContext = {
  staff: StaffContext;
  supabase: OperationalClient;
};

const closedLeadStatuses = new Set(["won", "lost", "spam"]);
const closedSourcingStatuses = new Set(["completed", "lost"]);

function displayStatus(value: string) {
  const words = value.replaceAll("_", " ");
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

function roleLabel(value: string) {
  return displayStatus(value);
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function numberValue(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function relativeDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (!isValid(date)) return "Never";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function dueLabel(value: string | null | undefined, timezone = "Europe/London") {
  if (!value) return "No due date";
  const date = new Date(value);
  if (!isValid(date)) return "No due date";
  const now = new Date();
  const dueDate = formatInTimeZone(date, timezone, "yyyy-MM-dd");
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const tomorrow = formatInTimeZone(addDays(now, 1), timezone, "yyyy-MM-dd");
  const time = formatInTimeZone(date, timezone, "HH:mm");
  if (dueDate === today) return `Today, ${time}`;
  if (dueDate === tomorrow) return `Tomorrow, ${time}`;
  if (date < now) return `Overdue · ${formatInTimeZone(date, timezone, "d MMM")}`;
  return formatInTimeZone(date, timezone, "d MMM");
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "TM"
  );
}

function demoModeEnabled() {
  return (
    !isSupabaseConfigured() &&
    getServerEnv().DEALEROS_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

async function getLiveContext(): Promise<LiveContext | null> {
  if (demoModeEnabled()) return null;
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Operational fixtures are available only when DEALEROS_DEMO_MODE=true in development.",
    );
  }
  const staff = await getStaffContext();
  if (!staff) throw new Error("An active dealership membership is required.");
  return { staff, supabase: await createServerSupabaseClient() };
}

function dataOrThrow<T>(
  result: { data: T; error: { message: string } | null },
  label: string,
): T {
  if (result.error) throw new Error(`${label} could not be loaded: ${result.error.message}`);
  return result.data;
}

async function loadMemberDirectory(
  supabase: OperationalClient,
  organisationId: string,
): Promise<MemberDirectoryEntry[]> {
  const result = await supabase
    .from("organisation_members")
    .select(
      "user_id,role,status,invited_email,joined_at,created_at,profiles(display_name,full_name,last_seen_at)",
    )
    .eq("organisation_id", organisationId)
    .is("deleted_at", null);
  const rows = dataOrThrow(result, "Team directory") ?? [];
  return rows.map((member) => {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    const profileData = profile as {
      display_name?: string | null;
      full_name?: string | null;
      last_seen_at?: string | null;
    } | null;
    return {
      userId: member.user_id,
      displayName:
        profileData?.display_name ??
        profileData?.full_name ??
        member.invited_email?.split("@")[0] ??
        "Team member",
      role: member.role,
      status: member.status,
      invitedEmail: member.invited_email,
      lastSeenAt: profileData?.last_seen_at ?? null,
      joinedAt: member.joined_at,
      createdAt: member.created_at,
    };
  });
}

function memberNameMap(members: MemberDirectoryEntry[]) {
  return new Map(members.map((member) => [member.userId, member.displayName]));
}

export async function getAdminLeadList(): Promise<AdminLeadList> {
  const context = await getLiveContext();
  if (!context) {
    return {
      leads: demoLeads.map((lead) => ({
        ...lead,
        reference: lead.id,
        email: null,
        phone: null,
        assignedToMe: lead.owner === "Tom Harris",
        followUpDue: lead.due.includes("Today"),
      })),
      metrics: {
        open: 18,
        newToday: 7,
        averageResponseMinutes: 18,
        conversionRate: 31,
        mine: 9,
        followUpDue: 5,
        highPriority: 4,
      },
    };
  }

  const { staff, supabase } = context;
  const [leadResult, customerResult, vehicleResult, members] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id,reference,customer_id,vehicle_id,assigned_user_id,title,subject,source,status,priority,due_at,created_at,last_activity_at",
      )
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("customers")
      .select("id,full_name,first_name,last_name,email,phone")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("staff_vehicle_records")
      .select(
        "id,public_title,make,model,derivative,registration,retail_price",
      )
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    loadMemberDirectory(supabase, staff.organisationId),
  ]);
  const rows = dataOrThrow(leadResult, "Leads") ?? [];
  const customers = dataOrThrow(customerResult, "Lead customers") ?? [];
  const vehicles = dataOrThrow(vehicleResult, "Lead vehicles") ?? [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const ownerById = memberNameMap(members);
  const now = new Date();
  const today = formatInTimeZone(now, "Europe/London", "yyyy-MM-dd");

  const leads = rows.map((row) => {
    const customer = row.customer_id ? customerById.get(row.customer_id) : null;
    const vehicle = row.vehicle_id ? vehicleById.get(row.vehicle_id) : null;
    const customerName =
      customer?.full_name ??
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ??
      "";
    const vehicleTitle =
      vehicle?.public_title ||
      [vehicle?.make, vehicle?.model, vehicle?.derivative]
        .filter(Boolean)
        .join(" ") ||
      vehicle?.registration ||
      "";
    const due = row.due_at ? new Date(row.due_at) : null;
    return {
      id: row.id,
      reference: row.reference,
      name: customerName || "Unlinked customer",
      subject:
        row.title ||
        row.subject ||
        vehicleTitle ||
        "General enquiry",
      source: row.source || "Unknown",
      status: displayStatus(row.status),
      priority: displayStatus(row.priority),
      owner: row.assigned_user_id
        ? ownerById.get(row.assigned_user_id) ?? "Former team member"
        : "Unassigned",
      due: dueLabel(row.due_at),
      value: vehicle ? money(vehicle.retail_price) : "Not set",
      email: customer?.email ?? null,
      phone: customer?.phone ?? null,
      assignedToMe: row.assigned_user_id === staff.userId,
      followUpDue:
        Boolean(due && due <= now) && !closedLeadStatuses.has(row.status),
    };
  });

  const responseMinutes = rows
    .filter((row) => row.last_activity_at)
    .map((row) =>
      Math.max(
        0,
        differenceInMinutes(
          new Date(row.last_activity_at as string),
          new Date(row.created_at),
        ),
      ),
    );
  const decided = rows.filter((row) => ["won", "lost"].includes(row.status));
  const won = decided.filter((row) => row.status === "won").length;
  const averageResponseMinutes = responseMinutes.length
    ? Math.round(
        responseMinutes.reduce((total, value) => total + value, 0) /
          responseMinutes.length,
      )
    : null;

  return {
    leads,
    metrics: {
      open: rows.filter((row) => !closedLeadStatuses.has(row.status)).length,
      newToday: rows.filter(
        (row) =>
          row.status === "new" &&
          formatInTimeZone(new Date(row.created_at), "Europe/London", "yyyy-MM-dd") ===
            today,
      ).length,
      averageResponseMinutes,
      conversionRate: decided.length ? Math.round((won / decided.length) * 100) : 0,
      mine: leads.filter((lead) => lead.assignedToMe).length,
      followUpDue: leads.filter((lead) => lead.followUpDue).length,
      highPriority: rows.filter(
        (row) =>
          ["high", "urgent"].includes(row.priority) &&
          !closedLeadStatuses.has(row.status),
      ).length,
    },
  };
}

export async function getAdminSourcingList(): Promise<AdminSourcingList> {
  const context = await getLiveContext();
  if (!context) {
    return {
      requests: demoSourcingRequests.map((request) => ({
        ...request,
        reference: request.id,
        sourcingFee: null,
        expectedMargin: null,
      })),
      metrics: {
        open: demoSourcingRequests.length,
        averageDaysToFirstOption: 4.2,
        expectedMargin: 12_850,
        successRate: 68,
      },
    };
  }

  const { staff, supabase } = context;
  const [requestResult, customerResult, candidateResult, members] =
    await Promise.all([
      supabase
        .from("sourcing_requests")
        .select("*")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("customers")
        .select("id,full_name,first_name,last_name")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      supabase
        .from("sourcing_candidates")
        .select("sourcing_request_id,expected_margin,created_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      loadMemberDirectory(supabase, staff.organisationId),
    ]);
  const rows = dataOrThrow(requestResult, "Sourcing requests") ?? [];
  const customers = dataOrThrow(customerResult, "Sourcing customers") ?? [];
  const candidates = dataOrThrow(candidateResult, "Sourcing candidates") ?? [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const ownerById = memberNameMap(members);
  const candidateCount = new Map<string, number>();
  const firstCandidateAt = new Map<string, string>();
  for (const candidate of candidates) {
    candidateCount.set(
      candidate.sourcing_request_id,
      (candidateCount.get(candidate.sourcing_request_id) ?? 0) + 1,
    );
    const current = firstCandidateAt.get(candidate.sourcing_request_id);
    if (!current || new Date(candidate.created_at) < new Date(current)) {
      firstCandidateAt.set(candidate.sourcing_request_id, candidate.created_at);
    }
  }

  const requests = rows.map((row) => {
    const customer = customerById.get(row.customer_id);
    const customerName =
      customer?.full_name ??
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ??
      "Customer";
    const preferences = [
      [row.preferred_make, row.preferred_model].filter(Boolean).join(" "),
      row.minimum_year ? `${row.minimum_year}+` : null,
      row.transmission_preference,
      row.fuel_preference,
      row.colour_preferences,
    ].filter(Boolean);
    return {
      id: row.id,
      reference: row.reference,
      customer: customerName,
      brief:
        row.requirements ||
        preferences.join(", ") ||
        row.alternative_models ||
        "Requirements to be confirmed",
      budget: money(row.budget),
      status: displayStatus(row.status),
      owner: row.assigned_user_id
        ? ownerById.get(row.assigned_user_id) ?? "Former team member"
        : "Unassigned",
      priority: displayStatus(row.priority),
      updated: relativeDate(row.updated_at),
      candidates: candidateCount.get(row.id) ?? 0,
      sourcingFee:
        row.sourcing_fee === null || row.sourcing_fee === undefined
          ? null
          : numberValue(row.sourcing_fee),
      expectedMargin:
        row.expected_margin === null || row.expected_margin === undefined
          ? null
          : numberValue(row.expected_margin),
    };
  });
  const timesToFirstOption = rows.flatMap((row) => {
    const candidateAt = firstCandidateAt.get(row.id);
    if (!candidateAt) return [];
    return [
      Math.max(
        0,
        differenceInCalendarDays(new Date(candidateAt), new Date(row.created_at)),
      ),
    ];
  });
  const decided = rows.filter((row) => ["completed", "lost"].includes(row.status));
  const completed = decided.filter((row) => row.status === "completed").length;

  return {
    requests,
    metrics: {
      open: rows.filter((row) => !closedSourcingStatuses.has(row.status)).length,
      averageDaysToFirstOption: timesToFirstOption.length
        ? Math.round(
            (timesToFirstOption.reduce((total, value) => total + value, 0) /
              timesToFirstOption.length) *
              10,
          ) / 10
        : null,
      expectedMargin: rows.some(
        (row) => row.expected_margin !== null && row.expected_margin !== undefined,
      )
        ? rows.reduce(
            (total, row) => total + numberValue(row.expected_margin),
            0,
          )
        : candidates.reduce(
            (total, candidate) => total + numberValue(candidate.expected_margin),
            0,
          ),
      successRate: decided.length
        ? Math.round((completed / decided.length) * 100)
        : 0,
    },
  };
}

export async function getAdminCustomerList(): Promise<AdminCustomerList> {
  const context = await getLiveContext();
  if (!context) {
    return {
      customers: demoCustomers.map((customer) => ({
        ...customer,
        consent: "Service only",
      })),
      metrics: { total: 1_284, active: 62, possibleDuplicates: 3 },
    };
  }

  const { staff, supabase } = context;
  const [customerResult, leadResult, sourcingResult, repairResult, saleResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id,full_name,first_name,last_name,email,phone,normalised_email,normalised_phone,marketing_consent,do_not_contact,updated_at",
        )
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .is("merged_into_customer_id", null)
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase
        .from("leads")
        .select("customer_id,status,updated_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      supabase
        .from("sourcing_requests")
        .select("customer_id,status,updated_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      supabase
        .from("repair_jobs")
        .select("customer_id,status,updated_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      supabase
        .from("staff_sales_records")
        .select("customer_id,status,updated_at")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
    ]);
  const rows = dataOrThrow(customerResult, "Customers") ?? [];
  const leads = dataOrThrow(leadResult, "Customer leads") ?? [];
  const sourcing = dataOrThrow(sourcingResult, "Customer sourcing records") ?? [];
  const repairs = dataOrThrow(repairResult, "Customer repair records") ?? [];
  const sales = dataOrThrow(saleResult, "Customer sales") ?? [];
  const openCount = new Map<string, number>();
  const lastActivity = new Map<string, string>();
  const relationships = new Map<string, Set<string>>();

  function addRelationship(
    customerId: string | null,
    relation: string,
    updatedAt: string,
    open: boolean,
  ) {
    if (!customerId) return;
    const values = relationships.get(customerId) ?? new Set<string>();
    values.add(relation);
    relationships.set(customerId, values);
    if (open) openCount.set(customerId, (openCount.get(customerId) ?? 0) + 1);
    const current = lastActivity.get(customerId);
    if (!current || new Date(updatedAt) > new Date(current)) {
      lastActivity.set(customerId, updatedAt);
    }
  }

  for (const lead of leads) {
    addRelationship(
      lead.customer_id,
      "Sales prospect",
      lead.updated_at,
      !closedLeadStatuses.has(lead.status),
    );
  }
  for (const request of sourcing) {
    addRelationship(
      request.customer_id,
      "Sourcing client",
      request.updated_at,
      !closedSourcingStatuses.has(request.status),
    );
  }
  for (const repair of repairs) {
    addRelationship(
      repair.customer_id,
      "Service customer",
      repair.updated_at,
      !["collected", "cancelled"].includes(repair.status),
    );
  }
  for (const sale of sales) {
    addRelationship(
      sale.customer_id,
      "Vehicle buyer",
      sale.updated_at,
      !["completed", "cancelled"].includes(sale.status),
    );
  }

  const duplicateKeys = new Map<string, number>();
  for (const customer of rows) {
    for (const value of [
      customer.normalised_email
        ? `email:${customer.normalised_email}`
        : null,
      customer.normalised_phone
        ? `phone:${customer.normalised_phone}`
        : null,
    ]) {
      if (value) duplicateKeys.set(value, (duplicateKeys.get(value) ?? 0) + 1);
    }
  }
  const possibleDuplicates = [...duplicateKeys.values()].filter(
    (count) => count > 1,
  ).length;

  const customers = rows.map((customer) => {
    const relationValues = [...(relationships.get(customer.id) ?? [])];
    const relationship =
      relationValues.length > 1
        ? `${relationValues[0]} & ${relationValues[1]
            ?.replace(" customer", "")
            .replace(" client", "")
            .toLowerCase()}`
        : relationValues[0] ?? "Customer";
    const activityAt = lastActivity.get(customer.id) ?? customer.updated_at;
    return {
      id: customer.id,
      name:
        customer.full_name ??
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ??
        "Customer",
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      relationship,
      lastContact: relativeDate(activityAt),
      open: openCount.get(customer.id) ?? 0,
      consent: customer.do_not_contact
        ? "Do not contact"
        : customer.marketing_consent
          ? "Marketing consent"
          : "Service only",
    };
  });

  return {
    customers,
    metrics: {
      total: rows.length,
      active: customers.filter((customer) => customer.open > 0).length,
      possibleDuplicates,
    },
  };
}

export async function getAdminTaskList(): Promise<{
  tasks: AdminTaskListItem[];
  currentUserName: string;
}> {
  const context = await getLiveContext();
  if (!context) {
    return {
      tasks: demoTasks.map((task) => ({
        ...task,
        href: task.linked.startsWith("REP")
          ? `/admin/repairs/${task.linked}`
          : task.linked.startsWith("SRC")
            ? `/admin/sourcing?request=${task.linked}`
            : "/admin/leads",
        assignedToMe: task.owner === "Tom Harris",
        completed: false,
      })),
      currentUserName: "Tom Harris",
    };
  }

  const { staff, supabase } = context;
  const [
    taskResult,
    customerResult,
    vehicleResult,
    leadResult,
    sourcingResult,
    appointmentResult,
    repairResult,
    saleResult,
    members,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("customers")
      .select("id,full_name")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("staff_vehicle_records")
      .select("id,stock_number,registration")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("leads")
      .select("id,reference")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("sourcing_requests")
      .select("id,reference")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("appointments")
      .select("id,reference")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("repair_jobs")
      .select("id,reference")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    supabase
      .from("staff_sales_records")
      .select("id,reference")
      .eq("organisation_id", staff.organisationId)
      .is("deleted_at", null),
    loadMemberDirectory(supabase, staff.organisationId),
  ]);
  const rows = dataOrThrow(taskResult, "Tasks") ?? [];
  const customers = new Map(
    (dataOrThrow(customerResult, "Task customers") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const vehicles = new Map(
    (dataOrThrow(vehicleResult, "Task vehicles") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const leads = new Map(
    (dataOrThrow(leadResult, "Task leads") ?? []).map((row) => [row.id, row]),
  );
  const sourcing = new Map(
    (dataOrThrow(sourcingResult, "Task sourcing requests") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const appointments = new Map(
    (dataOrThrow(appointmentResult, "Task appointments") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const repairs = new Map(
    (dataOrThrow(repairResult, "Task repair jobs") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const sales = new Map(
    (dataOrThrow(saleResult, "Task sales") ?? []).map((row) => [row.id, row]),
  );
  const ownerById = memberNameMap(members);
  const now = new Date();

  const tasks = rows.map((row) => {
    let linked = "General";
    let href = `/admin/tasks?task=${row.id}`;
    if (row.repair_job_id && repairs.get(row.repair_job_id)) {
      linked = repairs.get(row.repair_job_id)!.reference;
      href = `/admin/repairs/${row.repair_job_id}`;
    } else if (
      row.sourcing_request_id &&
      sourcing.get(row.sourcing_request_id)
    ) {
      linked = sourcing.get(row.sourcing_request_id)!.reference;
      href = `/admin/sourcing?request=${row.sourcing_request_id}`;
    } else if (row.lead_id && leads.get(row.lead_id)) {
      linked = leads.get(row.lead_id)!.reference;
      href = `/admin/leads?query=${encodeURIComponent(linked)}`;
    } else if (row.vehicle_id && vehicles.get(row.vehicle_id)) {
      const vehicle = vehicles.get(row.vehicle_id)!;
      linked = vehicle.stock_number ?? vehicle.registration ?? "Vehicle";
      href = `/admin/stock/${row.vehicle_id}`;
    } else if (row.customer_id && customers.get(row.customer_id)) {
      linked = customers.get(row.customer_id)!.full_name ?? "Customer";
      href = `/admin/customers?customer=${row.customer_id}`;
    } else if (row.appointment_id && appointments.get(row.appointment_id)) {
      linked = appointments.get(row.appointment_id)!.reference;
      href = `/admin/diary?appointment=${row.appointment_id}`;
    } else if (row.sale_id && sales.get(row.sale_id)) {
      linked = sales.get(row.sale_id)!.reference;
      href = `/admin/sales?sale=${row.sale_id}`;
    }
    const completed = row.status === "completed";
    const overdue =
      Boolean(row.due_at && new Date(row.due_at) < now) &&
      !["completed", "cancelled"].includes(row.status);
    return {
      id: row.id,
      title: row.title,
      linked,
      href,
      owner: row.assigned_user_id
        ? ownerById.get(row.assigned_user_id) ?? "Former team member"
        : "Unassigned",
      due: dueLabel(row.due_at),
      status: overdue ? "Overdue" : displayStatus(row.status),
      priority: displayStatus(row.priority),
      assignedToMe: row.assigned_user_id === staff.userId,
      completed,
    };
  });
  return { tasks, currentUserName: staff.displayName };
}

export async function getAdminDiaryList(
  requestedWeek?: string,
): Promise<AdminDiaryList> {
  const parsedWeek = requestedWeek ? parseISO(requestedWeek) : new Date();
  const referenceDate = isValid(parsedWeek) ? parsedWeek : new Date();
  const requestedStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekStart = format(requestedStart, "yyyy-MM-dd");
  const context = await getLiveContext();
  if (!context) {
    const demoDate = format(addDays(requestedStart, 3), "yyyy-MM-dd");
    return {
      appointments: demoAppointments.map((appointment) => ({
        ...appointment,
        reference: appointment.id,
        date: demoDate,
        dateLabel: format(addDays(requestedStart, 3), "EEEE, d MMMM"),
        durationMinutes: Number.parseInt(appointment.duration, 10),
        customerName: appointment.customer.split(" · ")[0] ?? appointment.customer,
        phone: null,
        tone: appointment.tone as "blue" | "green" | "amber",
        status: "Confirmed",
        registration: appointment.customer.split(" · ")[1] ?? null,
        internalNote: null,
      })),
      weekStart,
      timezone: "Europe/London",
      staffOptions: [
        { id: "demo-sarah", name: "Sarah Reid" },
        { id: "demo-tom", name: "Tom Harris" },
        { id: "demo-aisha", name: "Aisha Khan" },
      ],
    };
  }

  const { staff, supabase } = context;
  const settingsResult = await supabase
    .from("dealership_settings")
    .select("timezone")
    .eq("organisation_id", staff.organisationId)
    .maybeSingle();
  const timezone = settingsResult.data?.timezone ?? "Europe/London";
  const rangeStart = fromZonedTime(`${weekStart}T00:00:00`, timezone);
  const rangeEnd = fromZonedTime(
    `${format(addDays(requestedStart, 7), "yyyy-MM-dd")}T00:00:00`,
    timezone,
  );
  const [appointmentResult, typeResult, customerResult, members] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id,reference,appointment_type_id,customer_id,assigned_user_id,starts_at,ends_at,status,reason_for_call,registration,vehicle_make_model,internal_notes",
        )
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .gte("starts_at", rangeStart.toISOString())
        .lt("starts_at", rangeEnd.toISOString())
        .order("starts_at", { ascending: true }),
      supabase
        .from("appointment_types")
        .select("id,name,category,colour")
        .eq("organisation_id", staff.organisationId)
        .eq("active", true),
      supabase
        .from("customers")
        .select("id,full_name,first_name,last_name,phone")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      loadMemberDirectory(supabase, staff.organisationId),
    ]);
  const rows = dataOrThrow(appointmentResult, "Appointments") ?? [];
  const types = new Map(
    (dataOrThrow(typeResult, "Appointment types") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const customers = new Map(
    (dataOrThrow(customerResult, "Appointment customers") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const ownerById = memberNameMap(members);
  const toneForCategory = (category?: string): "blue" | "green" | "amber" => {
    if (["viewing", "test_drive", "handover"].includes(category ?? "")) {
      return "green";
    }
    if (["sales_call", "internal"].includes(category ?? "")) return "amber";
    return "blue";
  };
  const appointments = rows.map((row) => {
    const type = types.get(row.appointment_type_id);
    const customer = row.customer_id ? customers.get(row.customer_id) : null;
    const joinedName = [customer?.first_name, customer?.last_name]
      .filter(Boolean)
      .join(" ");
    const customerName =
      customer?.full_name ?? (joinedName || "Internal appointment");
    const vehicleDetail = row.registration ?? row.vehicle_make_model;
    const durationMinutes = Math.max(
      1,
      differenceInMinutes(new Date(row.ends_at), new Date(row.starts_at)),
    );
    return {
      id: row.id,
      reference: row.reference,
      date: formatInTimeZone(new Date(row.starts_at), timezone, "yyyy-MM-dd"),
      dateLabel: formatInTimeZone(
        new Date(row.starts_at),
        timezone,
        "EEEE, d MMMM",
      ),
      time: formatInTimeZone(new Date(row.starts_at), timezone, "HH:mm"),
      duration: `${durationMinutes} min`,
      durationMinutes,
      title: type?.name ?? row.reason_for_call ?? "Appointment",
      customer: [customerName, vehicleDetail].filter(Boolean).join(" · "),
      customerName,
      phone: customer?.phone ?? null,
      staff: row.assigned_user_id
        ? ownerById.get(row.assigned_user_id) ?? "Former team member"
        : "Unassigned",
      tone: toneForCategory(type?.category),
      status: displayStatus(row.status),
      registration: row.registration ?? null,
      internalNote: row.internal_notes ?? null,
    };
  });
  return {
    appointments,
    weekStart,
    timezone,
    staffOptions: members
      .filter((member) => member.status === "active")
      .map((member) => ({ id: member.userId, name: member.displayName })),
  };
}

export async function getAdminSalesPipeline(): Promise<AdminSalesPipeline> {
  const context = await getLiveContext();
  if (!context) {
    const stageByStatus: Record<string, string> = {
      Qualified: "Qualified",
      "Appointment booked": "Viewing / test drive",
      Negotiation: "Negotiation",
      Won: "Won / handover",
    };
    return {
      opportunities: demoLeads
        .filter((lead) => stageByStatus[lead.status])
        .map((lead) => ({
          id: lead.id,
          name: lead.name,
          subject: lead.subject,
          owner: lead.owner,
          value: lead.value,
          stage: stageByStatus[lead.status]!,
          href: `/admin/leads?query=${lead.id}`,
        })),
      metrics: {
        openPipelineValue: 103_730,
        conversionRate: 31,
        handoversThisWeek: 3,
      },
    };
  }

  const { staff, supabase } = context;
  const [saleResult, leadResult, customerResult, vehicleResult, members] =
    await Promise.all([
      supabase
        .from("staff_sales_records")
        .select(
          "id,reference,lead_id,vehicle_id,customer_id,salesperson_id,status,sale_price,handover_date,created_at",
        )
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("leads")
        .select(
          "id,reference,customer_id,vehicle_id,assigned_user_id,status,title,subject",
        )
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null)
        .in("status", [
          "qualified",
          "appointment_booked",
          "negotiation",
          "deposit_taken",
          "won",
        ])
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("customers")
        .select("id,full_name,first_name,last_name")
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      supabase
        .from("staff_vehicle_records")
        .select(
          "id,public_title,make,model,derivative,registration,retail_price",
        )
        .eq("organisation_id", staff.organisationId)
        .is("deleted_at", null),
      loadMemberDirectory(supabase, staff.organisationId),
    ]);
  const sales = dataOrThrow(saleResult, "Sales pipeline") ?? [];
  const leads = dataOrThrow(leadResult, "Qualified leads") ?? [];
  const customers = new Map(
    (dataOrThrow(customerResult, "Sales customers") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const vehicles = new Map(
    (dataOrThrow(vehicleResult, "Sales vehicles") ?? []).map((row) => [
      row.id,
      row,
    ]),
  );
  const ownerById = memberNameMap(members);
  const customerName = (customerId: string | null) => {
    if (!customerId) return "Customer";
    const customer = customers.get(customerId);
    return (
      customer?.full_name ??
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ??
      "Customer"
    );
  };
  const vehicleTitle = (vehicleId: string | null) => {
    if (!vehicleId) return "Vehicle opportunity";
    const vehicle = vehicles.get(vehicleId);
    return (
      vehicle?.public_title ||
      [vehicle?.make, vehicle?.model, vehicle?.derivative]
        .filter(Boolean)
        .join(" ") ||
      vehicle?.registration ||
      "Vehicle opportunity"
    );
  };
  const salesStage: Record<string, string> = {
    enquiry: "Qualified",
    viewing: "Viewing / test drive",
    test_drive: "Viewing / test drive",
    negotiation: "Negotiation",
    deposit_taken: "Deposit taken",
    reserved: "Deposit taken",
    sale_agreed: "Deposit taken",
    handover_scheduled: "Won / handover",
    completed: "Won / handover",
  };
  const leadStage: Record<string, string> = {
    qualified: "Qualified",
    appointment_booked: "Viewing / test drive",
    negotiation: "Negotiation",
    deposit_taken: "Deposit taken",
    won: "Won / handover",
  };
  const convertedLeadIds = new Set(
    sales.map((sale) => sale.lead_id).filter(Boolean),
  );
  const saleOpportunities = sales.map((sale) => ({
    id: sale.id,
    name: customerName(sale.customer_id),
    subject: vehicleTitle(sale.vehicle_id),
    owner: sale.salesperson_id
      ? ownerById.get(sale.salesperson_id) ?? "Former team member"
      : "Unassigned",
    value: money(sale.sale_price),
    stage: salesStage[sale.status] ?? "Qualified",
    href: `/admin/sales/${sale.id}`,
  }));
  const leadOpportunities = leads
    .filter((lead) => !convertedLeadIds.has(lead.id))
    .map((lead) => ({
      id: lead.id,
      name: customerName(lead.customer_id),
      subject:
        lead.title ?? lead.subject ?? vehicleTitle(lead.vehicle_id),
      owner: lead.assigned_user_id
        ? ownerById.get(lead.assigned_user_id) ?? "Former team member"
        : "Unassigned",
      value: money(
        lead.vehicle_id ? vehicles.get(lead.vehicle_id)?.retail_price : 0,
      ),
      stage: leadStage[lead.status] ?? "Qualified",
      href: `/admin/leads?query=${encodeURIComponent(lead.reference)}`,
    }));
  const opportunities = [...saleOpportunities, ...leadOpportunities];
  const completed = sales.filter((sale) => sale.status === "completed").length;
  const closedLeads = leads.filter((lead) => lead.status === "won").length;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  return {
    opportunities,
    metrics: {
      openPipelineValue:
        sales
          .filter((sale) => sale.status !== "completed")
          .reduce((total, sale) => total + numberValue(sale.sale_price), 0) +
        leads
          .filter((lead) => !convertedLeadIds.has(lead.id))
          .reduce(
            (total, lead) =>
              total +
              numberValue(
                lead.vehicle_id
                  ? vehicles.get(lead.vehicle_id)?.retail_price
                  : 0,
              ),
            0,
          ),
      conversionRate:
        leads.length + sales.length
          ? Math.round(
              ((completed + closedLeads) / (leads.length + sales.length)) * 100,
            )
          : 0,
      handoversThisWeek: sales.filter((sale) => {
        if (!sale.handover_date) return false;
        const handover = parseISO(sale.handover_date);
        return handover >= weekStart && handover <= weekEnd;
      }).length,
    },
  };
}

export async function getAdminTeamList(): Promise<AdminTeamList> {
  const context = await getLiveContext();
  if (!context) {
    const demo = [
      ["Tom Harris", "tom@dealership.co.uk", "Owner", "Active", "Now"],
      ["Aisha Khan", "aisha@dealership.co.uk", "Salesperson", "Active", "14 min ago"],
      ["Sarah Reid", "sarah@dealership.co.uk", "Service advisor", "Active", "22 min ago"],
      ["Ben Carter", "ben@dealership.co.uk", "Technician", "Active", "1 hr ago"],
      ["Maya Patel", "maya@dealership.co.uk", "Website editor", "Active", "Yesterday"],
      ["Chris Webb", "chris@dealership.co.uk", "Technician", "Invite pending", "Never"],
    ] as const;
    return {
      members: demo.map(([name, email, role, status, lastActive]) => ({
        id: email,
        name,
        email,
        role,
        status,
        lastActive,
        initials: initials(name),
      })),
      metrics: { total: 6, active: 5, configuredRoles: 6 },
    };
  }

  const { staff, supabase } = context;
  const [members, invitationResult] = await Promise.all([
    loadMemberDirectory(supabase, staff.organisationId),
    supabase
      .from("team_invitations")
      .select("id,email,role,expires_at,accepted_at,created_at")
      .eq("organisation_id", staff.organisationId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const invitations = dataOrThrow(invitationResult, "Team invitations") ?? [];
  const memberRows = members.map((member) => {
    const email =
      (member.userId === staff.userId ? staff.email : null) ??
      member.invitedEmail ??
      "Email unavailable";
    return {
      id: member.userId,
      name: member.displayName,
      email,
      role: roleLabel(member.role),
      status: displayStatus(member.status),
      lastActive: relativeDate(member.lastSeenAt ?? member.joinedAt),
      initials: initials(member.displayName),
    };
  });
  const existingEmails = new Set(
    memberRows.map((member) => member.email.toLowerCase()),
  );
  const invitationRows = invitations
    .filter((invitation) => !existingEmails.has(invitation.email.toLowerCase()))
    .map((invitation) => {
      const name = invitation.email.split("@")[0] || "Invited team member";
      const pending = new Date(invitation.expires_at) > new Date();
      return {
        id: invitation.id,
        name,
        email: invitation.email,
        role: roleLabel(invitation.role),
        status: pending ? "Invite pending" : "Invite expired",
        lastActive: "Never",
        initials: initials(name),
      };
    });
  const allMembers = [...memberRows, ...invitationRows];
  return {
    members: allMembers,
    metrics: {
      total: allMembers.length,
      active: memberRows.filter((member) => member.status === "Active").length,
      configuredRoles: 6,
    },
  };
}
