import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202608010002_security_invoker_staff_views.sql",
  ),
  "utf8",
);

describe("staff security-invoker migration contract", () => {
  it("runs all four staff views with caller privileges", () => {
    for (const view of [
      "vehicle_presentation_records",
      "technician_repair_jobs",
      "staff_vehicle_records",
      "staff_sales_records",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `alter view public\\.${view}\\s+set \\(security_invoker = on\\)`,
        ),
      );
    }
  });

  it("keeps commercial vehicle fields out of the authenticated column grant", () => {
    const vehicleGrant = migration.match(
      /grant select \(([\s\S]*?)\) on public\.vehicles to authenticated;/,
    )?.[1];

    expect(vehicleGrant).toBeTruthy();
    expect(vehicleGrant).not.toMatch(
      /purchase_price|preparation_costs|repair_costs|other_costs|minimum_acceptable_price|estimated_gross_profit|actual_sale_price|actual_gross_profit|inspection_notes|known_faults|autotrader_|lookup_provider|data_reviewed_by/,
    );
    expect(migration).not.toContain(
      "grant select on public.vehicles to authenticated",
    );
  });

  it("keeps gross profit and internal finance fields out of the sales grant", () => {
    const salesGrant = migration.match(
      /grant select \(([\s\S]*?)\) on public\.sales to authenticated;/,
    )?.[1];

    expect(salesGrant).toBeTruthy();
    expect(salesGrant).not.toMatch(
      /gross_profit|internal_notes|finance_referral_provider|finance_referral_status/,
    );
    expect(migration).not.toContain(
      "grant select on public.sales to authenticated",
    );
  });

  it("limits technician repair-job reads to assigned live jobs in their organisation", () => {
    expect(migration).toMatch(
      /create policy repair_jobs_read_technician[\s\S]*?for select to authenticated[\s\S]*?public\.has_org_role\(organisation_id, array\['technician'\]\)[\s\S]*?assigned_technician_id = \(select auth\.uid\(\)\)[\s\S]*?deleted_at is null/,
    );
  });
});
