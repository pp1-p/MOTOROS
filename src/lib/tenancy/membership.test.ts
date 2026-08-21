import { describe, expect, it } from "vitest";

import {
  chooseActiveMembership,
  isEligibleMembership,
  type MembershipCandidate,
} from "@/lib/tenancy/membership";

const membership = (
  id: string,
  status: string,
  options: Partial<MembershipCandidate> = {},
): MembershipCandidate => ({
  organisation_id: id,
  role: "owner",
  created_at: "2026-01-01T00:00:00.000Z",
  organisations: { id, name: id, status, deleted_at: null },
  ...options,
});

describe("active dealership selection", () => {
  it("allows only trial and active organisations", () => {
    expect(isEligibleMembership(membership("trial", "trial"))).toBe(true);
    expect(isEligibleMembership(membership("active", "active"))).toBe(true);
    expect(isEligibleMembership(membership("suspended", "suspended"))).toBe(false);
    expect(isEligibleMembership(membership("cancelled", "cancelled"))).toBe(false);
    expect(isEligibleMembership(membership("closed", "closed"))).toBe(false);
  });

  it("honours a selected organisation only when it belongs to the user", () => {
    const first = membership("00000000-0000-4000-8000-000000000001", "active");
    const second = membership("00000000-0000-4000-8000-000000000002", "active");
    expect(
      chooseActiveMembership([first, second], second.organisation_id)
        ?.organisation_id,
    ).toBe(second.organisation_id);
    expect(
      chooseActiveMembership(
        [first, second],
        "00000000-0000-4000-8000-000000000099",
      )?.organisation_id,
    ).toBe(first.organisation_id);
  });

  it("falls back deterministically to the primary eligible membership", () => {
    const older = membership("00000000-0000-4000-8000-000000000001", "active");
    const primary = membership("00000000-0000-4000-8000-000000000002", "trial", {
      is_primary: true,
      created_at: "2026-06-01T00:00:00.000Z",
    });
    expect(chooseActiveMembership([older, primary])?.organisation_id).toBe(
      primary.organisation_id,
    );
  });

  it("never selects a forged cookie pointing at a suspended organisation", () => {
    const active = membership("00000000-0000-4000-8000-000000000001", "active");
    const suspended = membership(
      "00000000-0000-4000-8000-000000000002",
      "suspended",
      { is_primary: true },
    );
    expect(
      chooseActiveMembership([active, suspended], suspended.organisation_id)
        ?.organisation_id,
    ).toBe(active.organisation_id);
  });

  it("returns null when no eligible organisation remains", () => {
    expect(chooseActiveMembership([membership("closed", "closed")])).toBeNull();
  });
});
