import { describe, expect, it } from "vitest";

import { hasPermission } from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("gives owners full operational access", () => {
    expect(hasPermission("owner", "integrations:manage")).toBe(true);
    expect(hasPermission("owner", "commercial:view")).toBe(true);
  });

  it("prevents technicians from viewing commercial data", () => {
    expect(hasPermission("technician", "technician:update")).toBe(true);
    expect(hasPermission("technician", "documents:view")).toBe(true);
    expect(hasPermission("technician", "commercial:view")).toBe(false);
    expect(hasPermission("technician", "customers:manage")).toBe(false);
  });

  it("limits website editors to presentation data", () => {
    expect(hasPermission("website_editor", "website:manage")).toBe(true);
    expect(hasPermission("website_editor", "documents:view")).toBe(false);
    expect(hasPermission("website_editor", "documents:manage")).toBe(false);
    expect(hasPermission("website_editor", "leads:view")).toBe(false);
    expect(hasPermission("website_editor", "commercial:view")).toBe(false);
  });

  it("keeps salesperson sourcing access read-only", () => {
    expect(hasPermission("salesperson", "sourcing:view")).toBe(true);
    expect(hasPermission("salesperson", "sourcing:manage")).toBe(false);
  });
});
