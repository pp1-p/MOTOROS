import type { StaffRole } from "@/lib/types";
import { hasPermission } from "@/lib/auth/permissions";

export const technicianRepairStatusValues = [
  "awaiting_inspection",
  "diagnosing",
  "estimate_preparing",
  "approved",
  "parts_ordered",
  "parts_received",
  "work_in_progress",
  "quality_check",
  "ready_for_collection",
] as const;

export const technicianRepairWritableFields = [
  "status",
  "diagnosis",
  "technicianNotes",
  "workCompleted",
  "changeReason",
] as const;

const technicianWritableFieldSet = new Set<string>(
  technicianRepairWritableFields,
);
const technicianStatusSet = new Set<string>(technicianRepairStatusValues);

export function isTechnicianRepairStatus(
  status: string,
): status is (typeof technicianRepairStatusValues)[number] {
  return technicianStatusSet.has(status);
}

export function buildTechnicianRepairRpcArguments(
  repairJobId: string,
  payload: Record<string, unknown>,
) {
  const changes: Record<string, unknown> = {};
  const fieldMapping = {
    status: "status",
    diagnosis: "diagnosis",
    technicianNotes: "technician_notes",
    workCompleted: "work_completed",
  } as const;

  for (const [field, databaseField] of Object.entries(fieldMapping)) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      changes[databaseField] = payload[field];
    }
  }

  return {
    p_repair_job_id: repairJobId,
    p_changes: changes,
  };
}

export function technicianRepairResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
  };
}

const managementListColumns =
  "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,reported_fault,due_date,estimate_total,approval_status,payment_status,created_at";
const technicianListColumns =
  "id,reference,assigned_technician_id,status,registration,vehicle_make_model,reported_fault,due_date,created_at";

const managementDetailColumns =
  "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,technician_notes,customer_facing_notes,estimate_net,estimate_vat,estimate_total,approval_status,payment_status,start_date,due_date,collection_date";
const technicianDetailColumns =
  "id,reference,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,technician_notes,customer_facing_notes,start_date,due_date,collection_date";

const managementItemColumns =
  "id,description,item_type,quantity,unit_price,vat_rate,line_total,status,sort_order";
const technicianItemColumns =
  "id,description,item_type,quantity,status,sort_order";

const managementExportColumns =
  "id,reference,customer_id,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,estimate_net,estimate_vat,estimate_total,approval_status,payment_status,start_date,due_date,collection_date,created_at";
const technicianExportColumns =
  "id,reference,assigned_technician_id,status,registration,vehicle_make_model,mileage,reported_fault,diagnosis,work_completed,start_date,due_date,collection_date,created_at";

export type RepairReadPolicy = {
  isTechnician: boolean;
  canViewCustomerDetails: boolean;
  canViewCommercial: boolean;
  canViewAuditTimeline: boolean;
  listColumns: string;
  detailColumns: string;
  itemColumns: string;
  exportColumns: string;
};

export function getRepairReadPolicy(role: StaffRole): RepairReadPolicy {
  const isTechnician = role === "technician";
  return {
    isTechnician,
    canViewCustomerDetails: !isTechnician,
    canViewCommercial: !isTechnician,
    canViewAuditTimeline: hasPermission(role, "audit:view"),
    listColumns: isTechnician ? technicianListColumns : managementListColumns,
    detailColumns: isTechnician
      ? technicianDetailColumns
      : managementDetailColumns,
    itemColumns: isTechnician ? technicianItemColumns : managementItemColumns,
    exportColumns: isTechnician
      ? technicianExportColumns
      : managementExportColumns,
  };
}

export function validateTechnicianRepairUpdate(
  payload: Record<string, unknown>,
): { allowed: true } | { allowed: false; message: string } {
  const disallowedFields = Object.keys(payload).filter(
    (field) => !technicianWritableFieldSet.has(field),
  );
  if (disallowedFields.length > 0) {
    return {
      allowed: false,
      message:
        "Technicians can update only status, diagnosis, work completed and technician notes.",
    };
  }

  if (
    payload.status !== undefined &&
    (typeof payload.status !== "string" ||
      !isTechnicianRepairStatus(payload.status))
  ) {
    return {
      allowed: false,
      message: "Technicians cannot set that repair status.",
    };
  }

  return { allowed: true };
}
