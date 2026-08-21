import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202608210001_multitenant_foundation.sql",
  ),
  "utf8",
);

describe("multi-tenant migration security contract", () => {
  it("removes direct organisation updates from tenant JWTs", () => {
    expect(migration).toContain(
      "revoke update on public.organisations from authenticated",
    );
  });

  it("limits public row policies and compatibility views to anon", () => {
    expect(migration).toMatch(
      /create policy vehicles_public_read[\s\S]*?to anon\s+using/,
    );
    expect(migration).toContain(
      "revoke all on public.public_vehicle_inventory from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select on public.public_vehicle_inventory to anon",
    );
    expect(migration).not.toContain(
      "grant select on public.public_vehicle_inventory to anon, authenticated",
    );
  });

  it("does not grant anonymous access to commercial vehicle columns", () => {
    const vehicleGrant = migration.match(
      /revoke all on public\.vehicles from anon;[\s\S]*?grant select \(([\s\S]*?)\) on public\.vehicles to anon;/,
    )?.[1];
    expect(vehicleGrant).toBeTruthy();
    expect(vehicleGrant).not.toMatch(
      /purchase_price|minimum_acceptable_price|estimated_gross_profit|actual_gross_profit|\bregistration\b|\bvin\b|inspection_notes|known_faults/,
    );
  });

  it("gates membership helpers on an eligible organisation lifecycle", () => {
    expect(
      migration.match(/o\.status in \('trial', 'active'\)/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
    expect(migration).toContain(
      "create or replace function public.publish_website_theme",
    );
  });

  it("allows platform onboarding to invite the first owner", () => {
    expect(migration).toContain(
      "drop constraint if exists team_invitations_role_check",
    );
    expect(migration).toMatch(
      /add constraint team_invitations_role_check check \([\s\S]*?'owner'/,
    );
  });
});
