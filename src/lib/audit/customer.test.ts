import { describe, expect, it } from "vitest";

import { buildCustomerUpdateAuditEntry } from "@/lib/audit/customer";

describe("customer update audit entries", () => {
  it("records changed field names without retaining customer PII snapshots", () => {
    const entry = buildCustomerUpdateAuditEntry({
      organisationId: "org-1",
      actorUserId: "user-1",
      customerId: "customer-1",
      updates: {
        full_name: "Private Person",
        email: "private@example.test",
        phone: "07000000000",
        address: { formatted: "Private address" },
        notes: "Private note",
      },
    });

    expect(entry.changed_fields).toEqual([
      "address",
      "email",
      "full_name",
      "notes",
      "phone",
    ]);
    expect(entry).not.toHaveProperty("old_values");
    expect(entry).not.toHaveProperty("new_values");
    expect(JSON.stringify(entry)).not.toContain("Private Person");
    expect(JSON.stringify(entry)).not.toContain("private@example.test");
  });
});
