begin;

-- =============================================================================
-- MOTOR.OS · Address Supabase "Security Definer View" lint
--
-- The five public.* projection views (public_dealerships, public_safe_vehicles,
-- public_vehicle_images, public_vehicle_features, public_vehicle_inventory)
-- were created without `security_invoker = on`. In PostgreSQL a view without
-- this setting runs with the view *owner's* privileges, which effectively
-- bypasses RLS on the underlying tables — the whole reason those views could
-- be read by `anon` today.
--
-- Fix: flip every view to `security_invoker = on` (so the caller's role and
-- RLS apply), then add narrow public-read policies on the underlying tables
-- that mirror the exact subset the views project. Read paths for `anon`
-- (and any authenticated user) go through those policies; the existing
-- authenticated / staff policies keep working unchanged.
-- =============================================================================


-- Public read on organisations: only ever the active ones the public views
-- already exposed via the join. Reading other columns is still blocked by
-- the fact that this policy grants SELECT on rows only — column-level access
-- comes from the view definitions, which pick a public-safe projection.
create policy organisations_public_read
  on public.organisations
  for select
  to anon, authenticated
  using (status = 'active' and deleted_at is null);

-- Public read on dealership_settings: only for those whose organisation is
-- active. Same public-safe columns come through the public_dealerships view.
create policy dealership_settings_public_read
  on public.dealership_settings
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );

-- Public read on vehicles: mirrors the filter the public_safe_vehicles view
-- already enforces (published, not soft-deleted, publishable status, and
-- populated advert fields). Any authenticated non-member also sees only
-- these rows via this policy.
create policy vehicles_public_read
  on public.vehicles
  for select
  to anon, authenticated
  using (
    is_public = true
    and deleted_at is null
    and status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
    and slug is not null
    and public_title is not null
    and description is not null
    and retail_price > 0
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );

-- Public read on vehicle_images: only cover / gallery images whose parent
-- vehicle satisfies the public read policy above.
create policy vehicle_images_public_read
  on public.vehicle_images
  for select
  to anon, authenticated
  using (
    is_public = true
    and deleted_at is null
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and v.is_public = true
        and v.deleted_at is null
        and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
    )
  );

-- Public read on vehicle_features: same story — features of a publishable
-- vehicle only.
create policy vehicle_features_public_read
  on public.vehicle_features
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and v.is_public = true
        and v.deleted_at is null
        and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
    )
  );


-- Recreate the five views with `security_invoker = on`. The projected
-- columns and WHERE clauses are unchanged from the current definitions.

create or replace view public.public_dealerships
with (security_invoker = on, security_barrier = true)
as
select
  o.id,
  o.slug,
  ds.dealership_name,
  ds.logo_path,
  ds.telephone,
  ds.email,
  ds.address,
  ds.opening_hours,
  ds.social_links,
  ds.company_number,
  ds.vat_number,
  ds.brand_primary_colour,
  ds.brand_accent_colour,
  ds.homepage_wording,
  ds.legal_wording,
  ds.timezone
from public.organisations o
join public.dealership_settings ds on ds.organisation_id = o.id
where o.status = 'active'
  and o.deleted_at is null;

create or replace view public.public_safe_vehicles
with (security_invoker = on, security_barrier = true)
as
select
  v.id,
  v.organisation_id,
  o.slug as organisation_slug,
  v.slug,
  v.public_title,
  v.attention_grabber,
  v.make,
  v.model,
  v.derivative,
  v.trim_level,
  v.body_type,
  v.fuel_type,
  v.transmission,
  v.colour,
  v.doors,
  v.seats,
  v.engine_size_cc,
  v.power_bhp,
  v.co2_emissions_g_km,
  v.euro_emissions_standard,
  v.ulez_status,
  v.year,
  v.registration_year,
  v.mot_expiry,
  v.mot_status,
  v.mileage,
  v.service_history,
  v.warranty,
  v.retail_price as price,
  v.description,
  v.standard_equipment,
  v.optional_equipment,
  v.finance_example_text,
  v.warranty_wording,
  v.video_url,
  v.featured,
  v.status,
  v.created_at
from public.vehicles v
join public.organisations o on o.id = v.organisation_id
where v.is_public = true
  and v.deleted_at is null
  and o.status = 'active'
  and o.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and v.slug is not null
  and v.public_title is not null
  and v.description is not null
  and v.retail_price > 0;

create or replace view public.public_vehicle_images
with (security_invoker = on, security_barrier = true)
as
select
  vi.id,
  vi.vehicle_id,
  vi.storage_bucket,
  vi.storage_path,
  vi.external_url,
  vi.mime_type,
  vi.width,
  vi.height,
  vi.sort_order,
  vi.is_cover,
  vi.alt_text,
  vi.caption
from public.vehicle_images vi
join public.vehicles v on v.id = vi.vehicle_id
join public.organisations o on o.id = vi.organisation_id
where vi.is_public = true
  and vi.deleted_at is null
  and v.is_public = true
  and v.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and o.status = 'active'
  and o.deleted_at is null;

create or replace view public.public_vehicle_features
with (security_invoker = on, security_barrier = true)
as
select
  vf.id,
  vf.vehicle_id,
  vf.name,
  vf.sort_order
from public.vehicle_features vf
join public.vehicles v on v.id = vf.vehicle_id
join public.organisations o on o.id = v.organisation_id
where v.is_public = true
  and v.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and o.status = 'active'
  and o.deleted_at is null;

create or replace view public.public_vehicle_inventory
with (security_invoker = on, security_barrier = true)
as
select
  safe_vehicle.*,
  vehicle.features
from public.public_safe_vehicles safe_vehicle
join public.vehicles vehicle
  on vehicle.id = safe_vehicle.id
  and vehicle.organisation_id = safe_vehicle.organisation_id;

-- Grant identical select privileges on the recreated views.
revoke all on public.public_dealerships from public;
grant select on public.public_dealerships to anon, authenticated;

revoke all on public.public_safe_vehicles from public;
grant select on public.public_safe_vehicles to anon, authenticated;

revoke all on public.public_vehicle_images from public;
grant select on public.public_vehicle_images to anon, authenticated;

revoke all on public.public_vehicle_features from public;
grant select on public.public_vehicle_features to anon, authenticated;

revoke all on public.public_vehicle_inventory from public;
grant select on public.public_vehicle_inventory to anon, authenticated;

commit;
