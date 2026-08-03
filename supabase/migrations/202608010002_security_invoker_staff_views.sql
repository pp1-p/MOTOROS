begin;

-- =============================================================================
-- MOTOR.OS · Flip the four staff-only projection views to
-- `security_invoker = on` to clear the Supabase advisor's "Security Definer
-- View" lint:
--
--   * public.vehicle_presentation_records   (sales / website editor)
--   * public.technician_repair_jobs         (technician's own jobs)
--   * public.staff_vehicle_records          (all operational staff)
--   * public.staff_sales_records            (management + assigned salesperson)
--
-- These views existed to expose a *column-restricted* subset of vehicles /
-- sales / repair_jobs to authenticated users. The original design used
-- `revoke select on <table> from authenticated` (see 202607160006 lines
-- 209-211) plus SECURITY DEFINER views to hide margin / gross-profit /
-- internal-notes columns.
--
-- We keep the same guarantees while satisfying the advisor by:
--   1. Adding column-level GRANT SELECT on the exact columns the views
--      project. Sensitive columns (purchase_price, gross_profit,
--      minimum_acceptable_price, internal_notes, finance_referral_*)
--      stay revoked.
--   2. Flipping each view's security_invoker option with ALTER VIEW so
--      RLS on the underlying table is evaluated against the caller. We
--      use ALTER (not DROP + CREATE) because several SECURITY DEFINER
--      helper functions (`update_vehicle_presentation`,
--      `update_assigned_repair_job`, and its retry variants) reference
--      these views as their return row-type, and DROP ... CASCADE would
--      take those functions with it.
--   3. Adding a missing RLS policy so technicians can read their own
--      repair jobs (repair_jobs_read_operational only covers owner /
--      manager / service_advisor).
-- =============================================================================


-- --- Column-level grants -----------------------------------------------------

-- public.vehicles: union of columns projected by staff_vehicle_records and
-- vehicle_presentation_records. Excludes purchase_price, preparation_costs,
-- repair_costs, other_costs, minimum_acceptable_price, estimated_gross_profit,
-- actual_sale_price, actual_gross_profit, inspection_notes, known_faults,
-- autotrader_*, lookup_provider, lookup_retrieved_at, data_reviewed_by,
-- data_reviewed_at.
grant select (
  id, organisation_id, registration, stock_number,
  make, model, derivative, year, mileage,
  fuel_type, transmission, body_type, colour,
  retail_price, status,
  public_title, attention_grabber, description,
  standard_equipment, optional_equipment,
  finance_example_text, warranty_wording, video_url,
  featured, is_public, slug, seo_title, seo_description,
  sold_at, acquired_at, published_at,
  created_at, updated_at, deleted_at
) on public.vehicles to authenticated;

-- public.sales: columns projected by staff_sales_records. Excludes
-- gross_profit, internal_notes, finance_referral_provider,
-- finance_referral_status.
grant select (
  id, organisation_id, reference,
  vehicle_id, customer_id, lead_id, salesperson_id,
  status,
  sale_price, deposit, part_exchange_allowance, discount,
  warranty, additional_products, payment_method,
  sale_date, handover_date, completed_at,
  created_at, updated_at, deleted_at
) on public.sales to authenticated;

-- public.repair_jobs already grants select to authenticated (no revoke was
-- ever issued); no column change needed.


-- --- RLS gap: technicians reading their own repair jobs ---------------------

drop policy if exists repair_jobs_read_technician on public.repair_jobs;
create policy repair_jobs_read_technician
  on public.repair_jobs for select to authenticated
  using (
    public.has_org_role(organisation_id, array['technician'])
    and assigned_technician_id = (select auth.uid())
    and deleted_at is null
  );


-- --- Flip the view flag without disturbing dependent functions -------------

alter view public.vehicle_presentation_records set (security_invoker = on);
alter view public.technician_repair_jobs       set (security_invoker = on);
alter view public.staff_vehicle_records        set (security_invoker = on);
alter view public.staff_sales_records          set (security_invoker = on);

commit;
