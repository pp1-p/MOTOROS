import { describe, expect, it } from "vitest";

import {
  canMutatePlatform,
  parsePlatformBootstrapEmails,
  resolvePlatformRole,
} from "./platform-admin";

describe("platform role resolution", () => {
  it("normalises the bootstrap owner allowlist", () => {
    expect(
      [...parsePlatformBootstrapEmails(" Owner@Example.test, support@example.test ")],
    ).toEqual(["owner@example.test", "support@example.test"]);
  });

  it("prefers a stable database role over the bootstrap email fallback", () => {
    expect(
      resolvePlatformRole({
        databaseAssignment: { role: "support", status: "active" },
        email: "owner@example.test",
        bootstrapEmails: new Set(["owner@example.test"]),
      }),
    ).toEqual({ role: "support", source: "database" });
  });

  it("uses the bootstrap email only as an owner fallback", () => {
    expect(
      resolvePlatformRole({
        databaseAssignment: null,
        email: "OWNER@example.test",
        bootstrapEmails: new Set(["owner@example.test"]),
      }),
    ).toEqual({ role: "owner", source: "bootstrap_email" });
  });

  it("does not grant access for an unknown database role or email", () => {
    expect(
      resolvePlatformRole({
        databaseAssignment: { role: "manager", status: "active" },
        email: "staff@example.test",
        bootstrapEmails: new Set(),
      }),
    ).toBeNull();
  });

  it("does not let a bootstrap email bypass a suspended database assignment", () => {
    expect(
      resolvePlatformRole({
        databaseAssignment: { role: "owner", status: "suspended" },
        email: "owner@example.test",
        bootstrapEmails: new Set(["owner@example.test"]),
      }),
    ).toBeNull();
  });

  it("keeps platform support read-only", () => {
    expect(canMutatePlatform("owner")).toBe(true);
    expect(canMutatePlatform("support")).toBe(false);
  });
});
