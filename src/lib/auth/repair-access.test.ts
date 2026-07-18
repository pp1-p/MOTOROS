import { describe, expect, it } from "vitest";

import {
  buildTechnicianRepairRpcArguments,
  getRepairReadPolicy,
  isTechnicianRepairStatus,
  technicianRepairResponse,
  technicianRepairStatusValues,
  validateTechnicianRepairUpdate,
} from "@/lib/auth/repair-access";

describe("technician repair access", () => {
  it("omits customer and commercial columns from every technician read", () => {
    const policy = getRepairReadPolicy("technician");
    const forbiddenColumns = [
      "customer_id",
      "estimate_net",
      "estimate_vat",
      "estimate_total",
      "approval_status",
      "payment_status",
      "unit_price",
      "vat_rate",
      "line_total",
    ];

    expect(policy.canViewCustomerDetails).toBe(false);
    expect(policy.canViewCommercial).toBe(false);
    expect(policy.canViewAuditTimeline).toBe(false);
    for (const columns of [
      policy.listColumns,
      policy.detailColumns,
      policy.itemColumns,
      policy.exportColumns,
    ]) {
      for (const forbidden of forbiddenColumns) {
        expect(columns.split(",")).not.toContain(forbidden);
      }
    }
  });

  it("allows only the fields and statuses supported by the narrow workflow", () => {
    for (const status of technicianRepairStatusValues) {
      expect(
        validateTechnicianRepairUpdate({
          status,
          diagnosis: "Confirmed",
          technicianNotes: "Internal note",
          workCompleted: "Inspection complete",
          changeReason: "Workshop update",
        }),
      ).toEqual({ allowed: true });
    }

    expect(
      validateTechnicianRepairUpdate({
        dueDate: "2026-07-20",
        changeReason: "Moved date",
      }),
    ).toMatchObject({ allowed: false });
    expect(
      validateTechnicianRepairUpdate({
        status: "cancelled",
        changeReason: "Cancelled",
      }),
    ).toMatchObject({ allowed: false });
    expect(
      validateTechnicianRepairUpdate({
        customerFacingNotes: "Call the customer",
        changeReason: "Customer note",
      }),
    ).toMatchObject({ allowed: false });
  });

  it("keeps the full repair projection for management roles", () => {
    const policy = getRepairReadPolicy("service_advisor");

    expect(policy.canViewCustomerDetails).toBe(true);
    expect(policy.canViewCommercial).toBe(true);
    expect(policy.detailColumns.split(",")).toContain("customer_id");
    expect(policy.detailColumns.split(",")).toContain("estimate_total");
    expect(policy.itemColumns.split(",")).toContain("unit_price");
  });

  it("loads raw repair audit history only for roles with audit access", () => {
    expect(getRepairReadPolicy("owner").canViewAuditTimeline).toBe(true);
    expect(getRepairReadPolicy("manager").canViewAuditTimeline).toBe(false);
    expect(getRepairReadPolicy("service_advisor").canViewAuditTimeline).toBe(
      false,
    );
    expect(getRepairReadPolicy("technician").canViewAuditTimeline).toBe(false);
  });

  it("preserves a manager-only status when a technician edits another field", () => {
    expect(isTechnicianRepairStatus("awaiting_customer_approval")).toBe(false);
    expect(isTechnicianRepairStatus("collected")).toBe(false);
    expect(isTechnicianRepairStatus("cancelled")).toBe(false);

    expect(
      buildTechnicianRepairRpcArguments(
        "repair-id",
        {
          technicianNotes: "New workshop note",
          changeReason: "Updated workshop note",
        },
      ),
    ).toEqual({
      p_repair_job_id: "repair-id",
      p_changes: {
        technician_notes: "New workshop note",
      },
    });
  });

  it("returns only the minimal technician-safe repair fields", () => {
    expect(
      technicianRepairResponse({
        id: "repair-id",
        reference: "REP-001",
        status: "diagnosing",
        customer_id: "customer-id",
        estimate_total: 500,
        approval_status: "requested",
      }),
    ).toEqual({
      id: "repair-id",
      reference: "REP-001",
      status: "diagnosing",
    });
  });
});
