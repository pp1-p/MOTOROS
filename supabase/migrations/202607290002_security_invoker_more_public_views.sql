begin;

-- =============================================================================
-- MOTOR.OS · Address Supabase "Security Definer View" lint (round two)
--
-- Same pattern as 202607290001, applied to the remaining three public.*
-- projection views the Supabase advisor flagged after round one:
--   * public.public_repair_services
--   * public.public_website_pages
--   * public.public_appointment_types
--
-- Each view is dropped and recreated with `security_invoker = on` so that
-- RLS on the underlying table is evaluated against the *caller's* role
-- (anon / authenticated) rather than the view owner. Narrow public-read
-- policies mirror the exact WHERE clause each view already enforces.
-- =============================================================================


-- Public-read policies on the underlying tables (idempotent).

drop policy if exists repair_services_public_read on public.repair_services;
create policy repair_services_public_read
  on public.repair_services
  for select
  to anon, authenticated
  using (
    is_public = true
    and active = true
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );

drop policy if exists website_pages_public_read on public.website_pages;
create policy website_pages_public_read
  on public.website_pages
  for select
  to anon, authenticated
  using (
    status = 'published'
    and deleted_at is null
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );

drop policy if exists appointment_types_public_read on public.appointment_types;
create policy appointment_types_public_read
  on public.appointment_types
  for select
  to anon, authenticated
  using (
    is_public_bookable = true
    and active = true
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_id
        and o.status = 'active'
        and o.deleted_at is null
    )
  );


-- Drop the existing views. None of these have downstream dependencies,
-- but keep CASCADE for safety on partial re-runs.

drop view if exists public.public_repair_services   cascade;
drop view if exists public.public_website_pages     cascade;
drop view if exists public.public_appointment_types cascade;


-- Recreate with security_invoker on; projections + filters unchanged.

create view public.public_repair_services
with (security_invoker = on, security_barrier = true)
as
select
  rs.id,
  rs.organisation_id,
  o.slug as organisation_slug,
  rs.name,
  rs.slug,
  rs.short_description,
  rs.full_description,
  rs.icon_name,
  rs.display_order,
  rs.indicative_price_from
from public.repair_services rs
join public.organisations o on o.id = rs.organisation_id
where rs.is_public = true
  and rs.active = true
  and o.status = 'active'
  and o.deleted_at is null;

create view public.public_website_pages
with (security_invoker = on, security_barrier = true)
as
select
  wp.id,
  wp.organisation_id,
  o.slug as organisation_slug,
  wp.page_type,
  wp.slug,
  wp.title,
  wp.content,
  wp.seo_title,
  wp.seo_description,
  wp.requires_legal_review,
  wp.published_at,
  wp.updated_at
from public.website_pages wp
join public.organisations o on o.id = wp.organisation_id
where wp.status = 'published'
  and wp.deleted_at is null
  and o.status = 'active'
  and o.deleted_at is null;

create view public.public_appointment_types
with (security_invoker = on, security_barrier = true)
as
select
  at.id,
  at.organisation_id,
  o.slug as organisation_slug,
  at.name,
  at.slug,
  at.description,
  at.category,
  at.duration_minutes,
  at.colour
from public.appointment_types at
join public.organisations o on o.id = at.organisation_id
where at.is_public_bookable = true
  and at.active = true
  and o.status = 'active'
  and o.deleted_at is null;

-- Re-grant identical select privileges.
revoke all on public.public_repair_services   from public;
revoke all on public.public_website_pages     from public;
revoke all on public.public_appointment_types from public;

grant select on public.public_repair_services   to anon, authenticated;
grant select on public.public_website_pages     to anon, authenticated;
grant select on public.public_appointment_types to anon, authenticated;

commit;
