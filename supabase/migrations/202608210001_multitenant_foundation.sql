begin;

-- =============================================================================
-- MOTOR.OS multi-tenant foundation
--
-- This is deliberately forward-only. It adds tenant identity/lifecycle data,
-- verified domains, platform roles and immutable theme publication history.
-- It also narrows the public inventory ACL introduced in 202607290001 so an
-- authenticated user can never use a public policy to read another tenant's
-- commercial vehicle columns.
-- =============================================================================

alter table public.organisations
  drop constraint if exists organisations_status_check;

alter table public.organisations
  add column if not exists subdomain text,
  add column if not exists plan_code text not null default 'starter',
  add column if not exists website_status text not null default 'draft',
  add column if not exists onboarding_step text not null default 'business_details',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists cancelled_at timestamptz;

update public.organisations
set
  subdomain = lower(slug),
  website_status = 'published',
  onboarding_step = 'complete',
  onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where subdomain is null;

alter table public.organisations
  alter column subdomain set not null,
  add constraint organisations_status_check
    check (status in ('trial', 'active', 'suspended', 'cancelled', 'closed')),
  add constraint organisations_subdomain_check
    check (
      subdomain = lower(subdomain)
      and subdomain ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and char_length(subdomain) between 1 and 63
    ),
  add constraint organisations_plan_code_check
    check (char_length(trim(plan_code)) between 1 and 60),
  add constraint organisations_website_status_check
    check (website_status in ('draft', 'published', 'unpublished')),
  add constraint organisations_onboarding_step_check
    check (char_length(trim(onboarding_step)) between 1 and 80);

create unique index if not exists organisations_subdomain_unique
  on public.organisations (lower(subdomain));

create index if not exists organisations_public_tenant_idx
  on public.organisations (subdomain, status, website_status)
  where deleted_at is null;

alter table public.organisations
  alter column status set default 'trial';

create or replace function public.prepare_organisation_tenancy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.subdomain := lower(
    coalesce(nullif(btrim(new.subdomain), ''), btrim(new.slug))
  );

  if new.status = 'suspended'
    and (tg_op = 'INSERT' or new.status is distinct from old.status)
  then
    new.suspended_at := coalesce(new.suspended_at, now());
  end if;
  if new.status = 'cancelled'
    and (tg_op = 'INSERT' or new.status is distinct from old.status)
  then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  if new.onboarding_step = 'complete'
    and new.onboarding_completed_at is null
  then
    new.onboarding_completed_at := now();
  end if;

  return new;
end;
$$;

create trigger organisations_prepare_tenancy
before insert or update of slug, subdomain, status, onboarding_step
on public.organisations
for each row execute function public.prepare_organisation_tenancy();

alter table public.dealership_settings
  add column if not exists published_theme_id text not null default 'direct-motors-classic',
  add column if not exists draft_theme_id text not null default 'direct-motors-classic',
  add column if not exists font_preset text not null default 'classic',
  add column if not exists theme_settings jsonb not null default '{}'::jsonb;

alter table public.dealership_settings
  drop constraint if exists dealership_settings_published_theme_id_check,
  drop constraint if exists dealership_settings_draft_theme_id_check,
  drop constraint if exists dealership_settings_font_preset_check,
  drop constraint if exists dealership_settings_theme_settings_check;

alter table public.dealership_settings
  add constraint dealership_settings_published_theme_id_check
    check (
      published_theme_id in (
        'direct-motors-classic',
        'modern-marketplace',
        'prestige',
        'performance'
      )
    ),
  add constraint dealership_settings_draft_theme_id_check
    check (
      draft_theme_id in (
        'direct-motors-classic',
        'modern-marketplace',
        'prestige',
        'performance'
      )
    ),
  add constraint dealership_settings_font_preset_check
    check (font_preset in ('classic', 'modern', 'editorial', 'condensed')),
  add constraint dealership_settings_theme_settings_check
    check (jsonb_typeof(theme_settings) = 'object');

-- Platform onboarding creates an owner invitation. The original constraint
-- accidentally allowed every staff role except owner.
alter table public.team_invitations
  drop constraint if exists team_invitations_role_check;
alter table public.team_invitations
  add constraint team_invitations_role_check check (
    role in (
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'technician',
      'website_editor'
    )
  );

create table public.dealership_domains (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  hostname citext not null unique,
  type text not null check (type in ('subdomain', 'custom')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (status <> 'verified' or verified_at is not null)
);

create unique index dealership_domains_one_subdomain_per_org
  on public.dealership_domains (organisation_id)
  where type = 'subdomain';

create index dealership_domains_org_status_idx
  on public.dealership_domains (organisation_id, status);

create or replace function public.prepare_dealership_domain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hostname := trim(trailing '.' from lower(btrim(new.hostname::text)));

  if char_length(new.hostname::text) > 253
    or new.hostname::text !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$'
  then
    raise exception 'Invalid dealership hostname'
      using errcode = '22023';
  end if;

  if new.status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  return new;
end;
$$;

create trigger dealership_domains_prepare
before insert or update of hostname, status on public.dealership_domains
for each row execute function public.prepare_dealership_domain();

create trigger dealership_domains_touch_updated_at
before update on public.dealership_domains
for each row execute function public.touch_updated_at();

create table public.platform_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'support')),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index platform_user_roles_role_status_idx
  on public.platform_user_roles (role, status);

create trigger platform_user_roles_touch_updated_at
before update on public.platform_user_roles
for each row execute function public.touch_updated_at();

create table public.website_theme_publications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  theme_id text not null check (
    theme_id in (
      'direct-motors-classic',
      'modern-marketplace',
      'prestige',
      'performance'
    )
  ),
  previous_theme_id text,
  font_preset text not null,
  theme_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(theme_settings) = 'object'),
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);

create index website_theme_publications_org_published_idx
  on public.website_theme_publications (organisation_id, published_at desc);

-- Membership helpers are the database-wide tenant gate. A valid membership in
-- a suspended/cancelled/closed organisation no longer grants tenant access.
create or replace function public.is_org_member(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members om
    join public.organisations o on o.id = om.organisation_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
      and o.status in ('trial', 'active')
      and o.deleted_at is null
  );
$$;

create or replace function public.has_org_role(
  target_organisation_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members om
    join public.organisations o on o.id = om.organisation_id
    join public.roles r on r.id = om.role_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
      and o.status in ('trial', 'active')
      and o.deleted_at is null
      and (r.code = any(allowed_roles) or r.code = 'owner')
  );
$$;

create or replace function public.has_org_permission(
  target_organisation_id uuid,
  requested_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members om
    join public.organisations o on o.id = om.organisation_id
    join public.roles r on r.id = om.role_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
      and o.status in ('trial', 'active')
      and o.deleted_at is null
      and (
        r.permissions ? '*'
        or r.permissions ? requested_permission
        or r.permissions ? (split_part(requested_permission, ':', 1) || ':*')
      )
  );
$$;

create or replace function public.current_member_role(target_organisation_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.code
  from public.organisation_members om
  join public.organisations o on o.id = om.organisation_id
  join public.roles r on r.id = om.role_id
  where om.organisation_id = target_organisation_id
    and om.user_id = auth.uid()
    and om.status = 'active'
    and om.deleted_at is null
    and o.status in ('trial', 'active')
    and o.deleted_at is null
  limit 1;
$$;

drop policy if exists profiles_select_self_or_colleague on public.profiles;
create policy profiles_select_self_or_colleague
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organisation_members mine
    join public.organisation_members theirs
      on theirs.organisation_id = mine.organisation_id
    join public.organisations o on o.id = mine.organisation_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and mine.deleted_at is null
      and theirs.user_id = profiles.id
      and theirs.status = 'active'
      and theirs.deleted_at is null
      and o.status in ('trial', 'active')
      and o.deleted_at is null
  )
);

alter table public.dealership_domains enable row level security;
alter table public.platform_user_roles enable row level security;
alter table public.website_theme_publications enable row level security;

create policy dealership_domains_select_member
on public.dealership_domains for select
to authenticated
using (public.is_org_member(organisation_id));

create policy platform_user_roles_select_self
on public.platform_user_roles for select
to authenticated
using (user_id = auth.uid());

create policy website_theme_publications_select_member
on public.website_theme_publications for select
to authenticated
using (public.is_org_member(organisation_id));

revoke all on public.dealership_domains from public, anon, authenticated;
revoke all on public.platform_user_roles from public, anon, authenticated;
revoke all on public.website_theme_publications from public, anon, authenticated;

grant select on public.dealership_domains to authenticated;
grant select on public.platform_user_roles to authenticated;
grant select on public.website_theme_publications to authenticated;
grant select, insert, update, delete on public.dealership_domains to service_role;
grant select, insert, update, delete on public.platform_user_roles to service_role;
grant select, insert, update, delete on public.website_theme_publications to service_role;

-- Lifecycle, tenancy identity and platform ownership fields are service-only.
-- The old owner RLS policy remains useful for a future narrowly scoped RPC,
-- but authenticated users no longer possess a direct UPDATE table privilege.
revoke update on public.organisations from authenticated;

-- Publishing is the only way an authenticated tenant editor can change the
-- live theme. Draft edits stay behind the server-side admin route.
create or replace function public.publish_website_theme(
  p_organisation_id uuid,
  p_theme_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  previous_theme text;
  current_font_preset text;
  current_theme_settings jsonb;
  publication_id uuid;
begin
  if actor_id is null and auth.role() <> 'service_role' then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  p_theme_id := lower(btrim(p_theme_id));
  if p_theme_id not in (
    'direct-motors-classic',
    'modern-marketplace',
    'prestige',
    'performance'
  )
  then
    raise exception 'Theme identifier is invalid'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisations o
    where o.id = p_organisation_id
      and o.status in ('trial', 'active')
      and o.deleted_at is null
  ) then
    raise exception 'The dealership is not active'
      using errcode = '42501';
  end if;

  if actor_id is not null and not public.has_org_role(
      p_organisation_id,
      array['owner', 'manager', 'website_editor']
    ) then
    raise exception 'Website publishing permission is required'
      using errcode = '42501';
  end if;

  select published_theme_id, font_preset, theme_settings
  into strict previous_theme, current_font_preset, current_theme_settings
  from public.dealership_settings
  where organisation_id = p_organisation_id
  for update;

  insert into public.website_theme_publications (
    organisation_id,
    theme_id,
    previous_theme_id,
    font_preset,
    theme_settings,
    published_by
  )
  values (
    p_organisation_id,
    p_theme_id,
    previous_theme,
    current_font_preset,
    current_theme_settings,
    actor_id
  )
  returning id into publication_id;

  update public.dealership_settings
  set
    published_theme_id = p_theme_id,
    draft_theme_id = p_theme_id,
    updated_at = now()
  where organisation_id = p_organisation_id;

  update public.organisations
  set website_status = 'published', updated_at = now()
  where id = p_organisation_id;

  return publication_id;
end;
$$;

revoke all on function public.publish_website_theme(uuid, text)
  from public, anon;
grant execute on function public.publish_website_theme(uuid, text)
  to authenticated, service_role;

-- Public website compatibility views remain available to anonymous visitors,
-- but not to authenticated users. Anonymous users receive only the columns
-- required by these views; they never receive registrations, acquisition
-- costs, margins, minimum prices, provenance notes or other staff-only data.
drop policy if exists organisations_public_read on public.organisations;
drop policy if exists dealership_settings_public_read on public.dealership_settings;
drop policy if exists vehicles_public_read on public.vehicles;
drop policy if exists vehicle_images_public_read on public.vehicle_images;
drop policy if exists vehicle_features_public_read on public.vehicle_features;

create policy organisations_public_read
on public.organisations for select
to anon
using (
  status in ('trial', 'active')
  and website_status = 'published'
  and deleted_at is null
);

create policy dealership_settings_public_read
on public.dealership_settings for select
to anon
using (
  exists (
    select 1
    from public.organisations o
    where o.id = dealership_settings.organisation_id
      and o.status in ('trial', 'active')
      and o.website_status = 'published'
      and o.deleted_at is null
  )
);

create policy vehicles_public_read
on public.vehicles for select
to anon
using (
  is_public = true
  and deleted_at is null
  and status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and slug is not null
  and public_title is not null
  and description is not null
  and retail_price > 0
  and exists (
    select 1
    from public.organisations o
    where o.id = vehicles.organisation_id
      and o.status in ('trial', 'active')
      and o.website_status = 'published'
      and o.deleted_at is null
  )
);

create policy vehicle_images_public_read
on public.vehicle_images for select
to anon
using (
  is_public = true
  and deleted_at is null
  and exists (
    select 1
    from public.vehicles v
    join public.organisations o on o.id = v.organisation_id
    where v.id = vehicle_images.vehicle_id
      and v.organisation_id = vehicle_images.organisation_id
      and v.is_public = true
      and v.deleted_at is null
      and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
      and o.status in ('trial', 'active')
      and o.website_status = 'published'
      and o.deleted_at is null
  )
);

create policy vehicle_features_public_read
on public.vehicle_features for select
to anon
using (
  exists (
    select 1
    from public.vehicles v
    join public.organisations o on o.id = v.organisation_id
    where v.id = vehicle_features.vehicle_id
      and v.organisation_id = vehicle_features.organisation_id
      and v.is_public = true
      and v.deleted_at is null
      and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
      and o.status in ('trial', 'active')
      and o.website_status = 'published'
      and o.deleted_at is null
  )
);

revoke all on public.organisations from anon;
grant select (id, slug, subdomain, status, website_status, deleted_at)
  on public.organisations to anon;

revoke all on public.dealership_settings from anon;
grant select (
  organisation_id,
  dealership_name,
  logo_path,
  telephone,
  email,
  address,
  opening_hours,
  social_links,
  company_number,
  vat_number,
  brand_primary_colour,
  brand_accent_colour,
  homepage_wording,
  legal_wording,
  timezone,
  published_theme_id,
  font_preset,
  theme_settings
) on public.dealership_settings to anon;

revoke all on public.vehicles from anon;
grant select (
  id,
  organisation_id,
  slug,
  public_title,
  attention_grabber,
  make,
  model,
  derivative,
  trim_level,
  body_type,
  fuel_type,
  transmission,
  colour,
  doors,
  seats,
  engine_size_cc,
  power_bhp,
  co2_emissions_g_km,
  euro_emissions_standard,
  ulez_status,
  year,
  registration_year,
  mot_expiry,
  mot_status,
  mileage,
  service_history,
  warranty,
  retail_price,
  description,
  features,
  standard_equipment,
  optional_equipment,
  finance_example_text,
  warranty_wording,
  video_url,
  featured,
  status,
  is_public,
  published_at,
  created_at,
  deleted_at
) on public.vehicles to anon;

revoke all on public.vehicle_images from anon;
grant select (
  id,
  organisation_id,
  vehicle_id,
  storage_bucket,
  storage_path,
  external_url,
  mime_type,
  width,
  height,
  sort_order,
  is_cover,
  is_public,
  alt_text,
  caption,
  deleted_at
) on public.vehicle_images to anon;

revoke all on public.vehicle_features from anon;
grant select (id, organisation_id, vehicle_id, name, sort_order)
  on public.vehicle_features to anon;

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
  ds.timezone,
  o.subdomain,
  o.website_status,
  ds.published_theme_id,
  ds.font_preset,
  ds.theme_settings
from public.organisations o
join public.dealership_settings ds on ds.organisation_id = o.id
where o.status in ('trial', 'active')
  and o.website_status = 'published'
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
  and o.status in ('trial', 'active')
  and o.website_status = 'published'
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
  and v.organisation_id = vi.organisation_id
  and v.is_public = true
  and v.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and o.status in ('trial', 'active')
  and o.website_status = 'published'
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
join public.organisations o on o.id = vf.organisation_id
where v.organisation_id = vf.organisation_id
  and v.is_public = true
  and v.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and o.status in ('trial', 'active')
  and o.website_status = 'published'
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

revoke all on public.public_dealerships from public, anon, authenticated;
revoke all on public.public_safe_vehicles from public, anon, authenticated;
revoke all on public.public_vehicle_images from public, anon, authenticated;
revoke all on public.public_vehicle_features from public, anon, authenticated;
revoke all on public.public_vehicle_inventory from public, anon, authenticated;
grant select on public.public_dealerships to anon;
grant select on public.public_safe_vehicles to anon;
grant select on public.public_vehicle_images to anon;
grant select on public.public_vehicle_features to anon;
grant select on public.public_vehicle_inventory to anon;

-- Vehicle advert slugs only need to be unique inside a tenant.
drop index if exists public.vehicles_slug_unique;
create unique index vehicles_org_slug_unique
  on public.vehicles (organisation_id, slug)
  where slug is not null and deleted_at is null;

commit;
