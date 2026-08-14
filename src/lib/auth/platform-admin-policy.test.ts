import { describe, expect, it } from "vitest";

import { resolvePlatformAdminAccess } from "@/lib/auth/platform-admin-policy";

describe("platform administrator policy", () => {
  it("allows a durable database role to manage without an email bootstrap entry", () => {
    expect(
      resolvePlatformAdminAccess({
        storedStatus: "active",
        emailAllowlisted: false,
      }),
    ).toEqual({ source: "database", canManage: true });
  });

  it("keeps email bootstrap access read-only", () => {
    expect(
      resolvePlatformAdminAccess({
        storedStatus: null,
        emailAllowlisted: true,
      }),
    ).toEqual({ source: "environment", canManage: false });
  });

  it("lets a suspended database row override the bootstrap allow-list", () => {
    expect(
      resolvePlatformAdminAccess({
        storedStatus: "suspended",
        emailAllowlisted: true,
      }),
    ).toBeNull();
  });

  it("denies an ordinary dealership user", () => {
    expect(
      resolvePlatformAdminAccess({
        storedStatus: null,
        emailAllowlisted: false,
      }),
    ).toBeNull();
  });
});
