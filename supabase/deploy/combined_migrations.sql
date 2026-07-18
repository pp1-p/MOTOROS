-- Combined DealerOS migrations for one-shot setup via the Supabase SQL Editor.
-- Generated from supabase/migrations/ (0001–0006, in order). If new migration
-- files are added later, apply those individually instead of re-running this.

-- ===== 202607160001_core.sql =====

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalise_registration(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select upper(regexp_replace(value, '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.normalise_phone(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    case
      when value is null then null
      when regexp_replace(value, '[^0-9+]', '', 'g') like '+44%'
        then '0' || substr(regexp_replace(value, '[^0-9]', '', 'g'), 3)
      when regexp_replace(value, '[^0-9]', '', 'g') like '44%'
        then '0' || substr(regexp_replace(value, '[^0-9]', '', 'g'), 3)
      else regexp_replace(value, '[^0-9]', '', 'g')
    end,
    ''
  );
$$;

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  default_timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index organisations_status_idx on public.organisations (status)
  where deleted_at is null;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  full_name text,
  phone text,
  avatar_path text,
  job_title text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, display_name, full_name)
select
  u.id,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users u
on conflict (id) do nothing;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code in (
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'technician',
      'website_editor'
    )
  ),
  name text not null,
  description text not null,
  permissions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(permissions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (id, code, name, description, permissions)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'owner',
    'Owner',
    'Full tenant administration, financial, integration and team access.',
    '["*"]'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'manager',
    'Manager',
    'Operational access across stock, sales, sourcing, customers, repairs and reports.',
    '["stock:*","customers:*","leads:*","sourcing:*","appointments:*","repairs:*","sales:*","tasks:*","reports:read","website:read"]'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'salesperson',
    'Salesperson',
    'Stock access and access to assigned customers, leads, appointments and sales activity.',
    '["stock:read","stock:write","customers:assigned","leads:assigned","appointments:assigned","sales:assigned","tasks:assigned"]'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'service_advisor',
    'Service advisor',
    'Customer, diary and repair workflow access.',
    '["customers:*","appointments:*","repairs:*","tasks:assigned","stock:read"]'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'technician',
    'Technician',
    'Access to assigned repair work, notes, items and status updates.',
    '["repairs:assigned","tasks:assigned"]'
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'website_editor',
    'Website editor',
    'Website content, public vehicle presentation and media access only.',
    '["website:*","stock:presentation"]'
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  permissions = excluded.permissions,
  updated_at = now();

create table public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  role text not null check (
    role in (
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'technician',
      'website_editor'
    )
  ),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  is_primary boolean not null default false,
  invited_email citext,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  is_active boolean generated always as (
    status = 'active' and deleted_at is null
  ) stored,
  unique (organisation_id, user_id),
  constraint organisation_members_profile_fk
    foreign key (user_id) references public.profiles(id) on delete cascade
);

create index organisation_members_user_idx
  on public.organisation_members (user_id, status)
  where deleted_at is null;
create index organisation_members_org_role_idx
  on public.organisation_members (organisation_id, role_id, status)
  where deleted_at is null;

create table public.dealership_settings (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  dealership_name text not null,
  logo_path text,
  telephone text,
  email citext,
  address jsonb not null default '{}'::jsonb
    check (jsonb_typeof(address) = 'object'),
  opening_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(opening_hours) = 'object'),
  social_links jsonb not null default '{}'::jsonb
    check (jsonb_typeof(social_links) = 'object'),
  company_number text,
  vat_number text,
  brand_primary_colour text not null default '#172033'
    check (brand_primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  brand_accent_colour text not null default '#D4A853'
    check (brand_accent_colour ~ '^#[0-9A-Fa-f]{6}$'),
  homepage_wording jsonb not null default '{}'::jsonb
    check (jsonb_typeof(homepage_wording) = 'object'),
  legal_wording jsonb not null default '{}'::jsonb
    check (jsonb_typeof(legal_wording) = 'object'),
  public_contact_consent_text text,
  timezone text not null default 'Europe/London',
  currency_code char(3) not null default 'GBP',
  default_vat_rate numeric(5,2) not null default 20.00
    check (default_vat_rate between 0 and 100),
  data_retention_months integer not null default 84
    check (data_retention_months between 1 and 240),
  cookie_preferences jsonb not null default '{"necessary":true}'::jsonb
    check (jsonb_typeof(cookie_preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

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
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
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
    join public.roles r on r.id = om.role_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
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
    join public.roles r on r.id = om.role_id
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.deleted_at is null
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
  join public.roles r on r.id = om.role_id
  where om.organisation_id = target_organisation_id
    and om.user_id = auth.uid()
    and om.status = 'active'
    and om.deleted_at is null
  limit 1;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prepare_profile_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := coalesce(
    nullif(trim(new.display_name), ''),
    nullif(trim(new.full_name), '')
  );
  new.full_name := coalesce(
    nullif(trim(new.full_name), ''),
    nullif(trim(new.display_name), '')
  );
  return new;
end;
$$;

create trigger profiles_prepare_name
before insert or update of display_name, full_name on public.profiles
for each row execute function public.prepare_profile_name();

create or replace function public.prepare_member_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_role_id uuid;
  resolved_role_code text;
begin
  if new.role is not null
    and (
      tg_op = 'INSERT'
      or new.role is distinct from old.role
      or new.role_id is null
    ) then
    select id, code
    into strict resolved_role_id, resolved_role_code
    from public.roles
    where code = new.role;
  else
    select id, code
    into strict resolved_role_id, resolved_role_code
    from public.roles
    where id = new.role_id;
  end if;

  new.role_id := resolved_role_id;
  new.role := resolved_role_code;
  return new;
end;
$$;

create trigger organisation_members_prepare_role
before insert or update of role, role_id on public.organisation_members
for each row execute function public.prepare_member_role();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.bootstrap_organisation(
  organisation_name text,
  organisation_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_organisation_id uuid;
  owner_role_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication is required'
      using errcode = '28000';
  end if;

  if char_length(trim(organisation_name)) not between 2 and 120 then
    raise exception 'Organisation name must be between 2 and 120 characters'
      using errcode = '22023';
  end if;

  if organisation_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organisation slug is invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.organisation_members
    where user_id = actor_id
      and status = 'active'
      and deleted_at is null
  ) then
    raise exception 'This account already belongs to an active organisation'
      using errcode = '23505';
  end if;

  insert into public.profiles (id, display_name, full_name)
  select
    u.id,
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
  from auth.users u
  where u.id = actor_id
  on conflict (id) do nothing;

  select id into strict owner_role_id
  from public.roles
  where code = 'owner';

  insert into public.organisations (name, slug, created_by)
  values (trim(organisation_name), organisation_slug, actor_id)
  returning id into new_organisation_id;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role_id,
    role,
    status,
    is_primary,
    joined_at,
    created_by
  )
  values (
    new_organisation_id,
    actor_id,
    owner_role_id,
    'owner',
    'active',
    true,
    now(),
    actor_id
  );

  insert into public.dealership_settings (
    organisation_id,
    dealership_name,
    created_by
  )
  values (new_organisation_id, trim(organisation_name), actor_id);

  return new_organisation_id;
end;
$$;

create trigger organisations_touch_updated_at
before update on public.organisations
for each row execute function public.touch_updated_at();
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger roles_touch_updated_at
before update on public.roles
for each row execute function public.touch_updated_at();
create trigger organisation_members_touch_updated_at
before update on public.organisation_members
for each row execute function public.touch_updated_at();
create trigger dealership_settings_touch_updated_at
before update on public.dealership_settings
for each row execute function public.touch_updated_at();

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.organisation_members enable row level security;
alter table public.dealership_settings enable row level security;

create policy organisations_select_member
on public.organisations for select
to authenticated
using (public.is_org_member(id));

create policy organisations_update_owner
on public.organisations for update
to authenticated
using (public.has_org_role(id, array['owner']))
with check (public.has_org_role(id, array['owner']));

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
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and mine.deleted_at is null
      and theirs.user_id = profiles.id
      and theirs.status = 'active'
      and theirs.deleted_at is null
  )
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy roles_select_authenticated
on public.roles for select
to authenticated
using (true);

create policy organisation_members_select_member
on public.organisation_members for select
to authenticated
using (public.is_org_member(organisation_id));

create policy organisation_members_insert_owner
on public.organisation_members for insert
to authenticated
with check (public.has_org_role(organisation_id, array['owner']));

create policy organisation_members_update_owner
on public.organisation_members for update
to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

create policy dealership_settings_select_member
on public.dealership_settings for select
to authenticated
using (public.is_org_member(organisation_id));

create policy dealership_settings_update_management
on public.dealership_settings for update
to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));

revoke all on public.organisations from anon;
revoke all on public.profiles from anon;
revoke all on public.roles from anon;
revoke all on public.organisation_members from anon;
revoke all on public.dealership_settings from anon;

grant select, update on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select, update on public.organisations to authenticated;
grant select, insert, update on public.organisation_members to authenticated;
grant select, update on public.dealership_settings to authenticated;

revoke all on function public.bootstrap_organisation(text, text) from public;
grant execute on function public.bootstrap_organisation(text, text) to authenticated;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
revoke all on function public.has_org_permission(uuid, text) from public;
grant execute on function public.has_org_permission(uuid, text) to authenticated;
revoke all on function public.current_member_role(uuid) from public;
grant execute on function public.current_member_role(uuid) to authenticated;

commit;

-- ===== 202607160002_inventory_customers.sql =====

begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text,
  full_name text,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 80),
  email citext,
  phone text,
  normalised_email text generated always as (
    nullif(lower(trim(email::text)), '')
  ) stored,
  normalised_phone text generated always as (
    public.normalise_phone(phone)
  ) stored,
  email_normalised text generated always as (
    nullif(lower(trim(email::text)), '')
  ) stored,
  phone_normalised text generated always as (
    public.normalise_phone(phone)
  ) stored,
  address jsonb not null default '{}'::jsonb
    check (jsonb_typeof(address) = 'object'),
  preferred_contact_method text not null default 'email'
    check (preferred_contact_method in ('email', 'phone', 'sms', 'either')),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  consent_at timestamptz,
  consent_source text,
  privacy_notice_accepted_at timestamptz,
  do_not_contact boolean not null default false,
  notes text,
  merged_into_customer_id uuid references public.customers(id) on delete set null,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (
    (marketing_consent = false)
    or marketing_consent_at is not null
  )
);

create or replace function public.prepare_customer_name_and_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  clean_name text;
  final_space integer;
begin
  clean_name := nullif(trim(new.full_name), '');
  if clean_name is null then
    clean_name := trim(concat_ws(' ', new.first_name, new.last_name));
  end if;

  if new.first_name is null or new.last_name is null then
    final_space := length(clean_name) - strpos(reverse(clean_name), ' ') + 1;
    if final_space > 0 and final_space < length(clean_name) then
      new.first_name := coalesce(
        nullif(trim(new.first_name), ''),
        trim(substr(clean_name, 1, final_space - 1))
      );
      new.last_name := coalesce(
        nullif(trim(new.last_name), ''),
        trim(substr(clean_name, final_space + 1))
      );
    else
      new.first_name := coalesce(nullif(trim(new.first_name), ''), clean_name);
      new.last_name := coalesce(nullif(trim(new.last_name), ''), 'Customer');
    end if;
  end if;

  new.full_name := trim(concat_ws(' ', new.first_name, new.last_name));
  new.marketing_consent_at := coalesce(new.marketing_consent_at, new.consent_at);
  new.marketing_consent_source := coalesce(
    new.marketing_consent_source,
    new.consent_source
  );
  new.consent_at := coalesce(new.consent_at, new.marketing_consent_at);
  new.consent_source := coalesce(new.consent_source, new.marketing_consent_source);
  return new;
end;
$$;

create trigger customers_prepare_name_and_consent
before insert or update on public.customers
for each row execute function public.prepare_customer_name_and_consent();

create unique index customers_org_email_unique
  on public.customers (organisation_id, normalised_email)
  where normalised_email is not null
    and deleted_at is null
    and anonymised_at is null;
create unique index customers_org_phone_unique
  on public.customers (organisation_id, normalised_phone)
  where normalised_phone is not null
    and deleted_at is null
    and anonymised_at is null;
create index customers_org_name_idx
  on public.customers (organisation_id, last_name, first_name)
  where deleted_at is null;
create index customers_created_at_idx
  on public.customers (organisation_id, created_at desc);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  registration text,
  registration_normalised text,
  vin text,
  stock_number text not null,
  make text not null,
  model text not null,
  derivative text,
  trim text,
  trim_level text,
  body_type text,
  fuel_type text not null,
  transmission text not null,
  colour text,
  doors smallint check (doors between 1 and 8),
  seats smallint check (seats between 1 and 20),
  engine_size_cc integer check (engine_size_cc between 1 and 20000),
  power_bhp integer check (power_bhp between 1 and 3000),
  co2_emissions_g_km integer check (co2_emissions_g_km between 0 and 2000),
  euro_emissions_standard text,
  euro_status text,
  ulez_status text check (ulez_status in ('compliant', 'non_compliant', 'unknown')),
  year integer not null check (year between 1886 and 2200),
  first_registration_date date,
  registration_year text,
  mot_expiry date,
  mot_status text,
  tax_status text,
  tax_due_date date,
  type_approval text,
  marked_for_export boolean,
  previous_owners smallint check (previous_owners >= 0),
  mileage integer not null check (mileage >= 0),
  service_history text,
  number_of_keys smallint check (number_of_keys between 0 and 20),
  provenance_status text,
  category_status text,
  warranty text,
  inspection_notes text,
  known_faults text,
  preparation_checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(preparation_checklist) = 'array'),
  purchase_price numeric(12,2) check (purchase_price >= 0),
  preparation_costs numeric(12,2) not null default 0
    check (preparation_costs >= 0),
  repair_costs numeric(12,2) not null default 0
    check (repair_costs >= 0),
  other_costs numeric(12,2) not null default 0
    check (other_costs >= 0),
  retail_price numeric(12,2) check (retail_price >= 0),
  minimum_acceptable_price numeric(12,2)
    check (minimum_acceptable_price >= 0),
  deposit_amount numeric(12,2) not null default 0
    check (deposit_amount >= 0),
  estimated_gross_profit numeric(12,2),
  actual_sale_price numeric(12,2) check (actual_sale_price >= 0),
  actual_gross_profit numeric(12,2) generated always as (
    case
      when actual_sale_price is null or purchase_price is null then null
      else actual_sale_price - purchase_price - preparation_costs - repair_costs - other_costs
    end
  ) stored,
  public_title text,
  attention_grabber text,
  description text,
  features text[] not null default '{}',
  standard_equipment text,
  optional_equipment text,
  finance_example_text text,
  warranty_wording text,
  video_url text,
  featured boolean not null default false,
  is_featured boolean not null default false,
  is_public boolean not null default false,
  autotrader_publication_status text not null default 'not_configured'
    check (
      autotrader_publication_status in (
        'not_configured',
        'draft',
        'pending',
        'published',
        'failed',
        'removed'
      )
    ),
  autotrader_stock_id text,
  autotrader_reference text,
  autotrader_url text,
  slug text,
  seo_title text,
  seo_description text,
  lookup_provider text,
  lookup_retrieved_at timestamptz,
  data_reviewed_by uuid references auth.users(id) on delete set null,
  data_reviewed_at timestamptz,
  status text not null default 'appraisal'
    check (
      status in (
        'appraisal',
        'purchased',
        'due_in',
        'preparation',
        'photography_required',
        'ready_for_sale',
        'on_forecourt',
        'reserved',
        'sale_in_progress',
        'sold',
        'returned',
        'archived'
      )
    ),
  status_changed_at timestamptz not null default now(),
  acquired_at date,
  sold_at date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (
    registration is null
    or char_length(registration_normalised) between 2 and 10
  ),
  check (
    vin is null
    or upper(vin) ~ '^[A-HJ-NPR-Z0-9]{17}$'
  ),
  check (
    minimum_acceptable_price is null
    or retail_price is null
    or minimum_acceptable_price <= retail_price
  ),
  check (
    is_public = false
    or (
      slug is not null
      and public_title is not null
      and description is not null
      and retail_price > 0
      and status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
    )
  )
);

create or replace function public.prepare_vehicle_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.registration_normalised := public.normalise_registration(new.registration);

  if tg_op = 'INSERT' then
    new.trim_level := coalesce(nullif(trim(new.trim_level), ''), nullif(trim(new.trim), ''));
    new.trim := coalesce(nullif(trim(new.trim), ''), nullif(trim(new.trim_level), ''));
    new.euro_emissions_standard := coalesce(
      nullif(trim(new.euro_emissions_standard), ''),
      nullif(trim(new.euro_status), '')
    );
    new.euro_status := coalesce(
      nullif(trim(new.euro_status), ''),
      nullif(trim(new.euro_emissions_standard), '')
    );
    new.featured := new.featured or new.is_featured;
    new.is_featured := new.featured;
  else
    if new.trim is distinct from old.trim then
      new.trim_level := new.trim;
    elsif new.trim_level is distinct from old.trim_level then
      new.trim := new.trim_level;
    end if;
    if new.euro_status is distinct from old.euro_status then
      new.euro_emissions_standard := new.euro_status;
    elsif new.euro_emissions_standard is distinct from old.euro_emissions_standard then
      new.euro_status := new.euro_emissions_standard;
    end if;
    if new.is_featured is distinct from old.is_featured then
      new.featured := new.is_featured;
    elsif new.featured is distinct from old.featured then
      new.is_featured := new.featured;
    end if;
  end if;

  if new.purchase_price is not null and new.retail_price is not null then
    new.estimated_gross_profit :=
      new.retail_price
      - new.purchase_price
      - new.preparation_costs
      - new.repair_costs
      - new.other_costs;
  end if;
  return new;
end;
$$;

create trigger vehicles_prepare_compatibility
before insert or update on public.vehicles
for each row execute function public.prepare_vehicle_compatibility();

create unique index vehicles_org_registration_unique
  on public.vehicles (organisation_id, registration_normalised)
  where registration_normalised is not null and deleted_at is null;
create unique index vehicles_org_stock_number_unique
  on public.vehicles (organisation_id, lower(stock_number))
  where deleted_at is null;
create unique index vehicles_org_vin_unique
  on public.vehicles (organisation_id, upper(vin))
  where vin is not null and deleted_at is null;
create unique index vehicles_slug_unique
  on public.vehicles (slug)
  where slug is not null and deleted_at is null;
create index vehicles_org_status_idx
  on public.vehicles (organisation_id, status)
  where deleted_at is null;
create index vehicles_public_inventory_idx
  on public.vehicles (
    organisation_id,
    featured desc,
    created_at desc,
    retail_price
  )
  where is_public = true and deleted_at is null;
create index vehicles_make_model_idx
  on public.vehicles (organisation_id, make, model)
  where deleted_at is null;

create table public.customer_vehicles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  stock_vehicle_id uuid references public.vehicles(id) on delete set null,
  registration text,
  registration_normalised text generated always as (
    public.normalise_registration(registration)
  ) stored,
  make text,
  model text,
  year integer check (year between 1886 and 2200),
  colour text,
  vin text,
  current_mileage integer check (current_mileage >= 0),
  relationship text not null default 'owned'
    check (relationship in ('owned', 'part_exchange', 'previously_owned', 'prospect')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (registration is null or char_length(registration_normalised) between 2 and 10)
);

create unique index customer_vehicles_customer_registration_unique
  on public.customer_vehicles (customer_id, registration_normalised)
  where registration_normalised is not null and deleted_at is null;
create index customer_vehicles_org_customer_idx
  on public.customer_vehicles (organisation_id, customer_id)
  where deleted_at is null;
create index customer_vehicles_registration_idx
  on public.customer_vehicles (organisation_id, registration_normalised)
  where deleted_at is null;

create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  external_url text,
  media_type text not null default 'image'
    check (media_type in ('image', 'video_thumbnail')),
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size between 1 and 20971520),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  is_public boolean not null default true,
  alt_text text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (
    (storage_path is not null and external_url is null and storage_bucket is not null)
    or (storage_path is null and external_url is not null)
  )
);

create unique index vehicle_images_vehicle_sort_unique
  on public.vehicle_images (vehicle_id, sort_order)
  where deleted_at is null;
create unique index vehicle_images_single_cover_unique
  on public.vehicle_images (vehicle_id)
  where is_cover = true and deleted_at is null;
create unique index vehicle_images_storage_path_unique
  on public.vehicle_images (storage_bucket, storage_path)
  where storage_path is not null and deleted_at is null;
create index vehicle_images_org_vehicle_idx
  on public.vehicle_images (organisation_id, vehicle_id, sort_order)
  where deleted_at is null;

create table public.vehicle_features (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  category text not null default 'feature',
  name text not null check (char_length(trim(name)) between 1 and 160),
  is_highlight boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (vehicle_id, category, name)
);

create index vehicle_features_org_vehicle_idx
  on public.vehicle_features (organisation_id, vehicle_id, sort_order);

create table public.vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  cost_type text
    check (
      cost_type in (
        'purchase',
        'preparation',
        'repair',
        'transport',
        'advertising',
        'warranty',
        'other'
      )
  ),
  supplier_name text,
  description text,
  amount_net numeric(12,2) check (amount_net >= 0),
  vat_amount numeric(12,2) not null default 0 check (vat_amount >= 0),
  purchase_price numeric(12,2) check (purchase_price >= 0),
  preparation_costs numeric(12,2) check (preparation_costs >= 0),
  repair_costs numeric(12,2) check (repair_costs >= 0),
  other_costs numeric(12,2) check (other_costs >= 0),
  minimum_acceptable_price numeric(12,2)
    check (minimum_acceptable_price >= 0),
  incurred_on date not null default current_date,
  invoice_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (
    (
      cost_type is not null
      and description is not null
      and amount_net is not null
    )
    or (
      cost_type is null
      and purchase_price is not null
    )
  )
);

create index vehicle_costs_org_vehicle_idx
  on public.vehicle_costs (organisation_id, vehicle_id, incurred_on desc)
  where deleted_at is null;
create unique index vehicle_costs_summary_unique
  on public.vehicle_costs (vehicle_id)
  where cost_type is null and deleted_at is null;

create table public.vehicle_status_history (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index vehicle_status_history_vehicle_idx
  on public.vehicle_status_history (vehicle_id, changed_at desc);
create index vehicle_status_history_org_status_idx
  on public.vehicle_status_history (organisation_id, to_status, changed_at desc);

create table public.vehicle_lookup_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null,
  requested_by uuid references auth.users(id) on delete set null,
  registration_hash text not null,
  registration_last_four text,
  outcome text not null default 'error'
    check (
      outcome in (
        'success',
        'partial',
        'invalid',
        'not_found',
        'rate_limited',
        'timeout',
        'unavailable',
        'credentials_missing',
        'duplicate',
        'error'
      )
    ),
  http_status integer check (http_status between 100 and 599),
  duration_ms integer check (duration_ms >= 0),
  error_code text,
  response_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_summary) = 'object'),
  result_status text check (result_status in ('success', 'failed')),
  response_fields text[] not null default '{}',
  looked_up_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create or replace function public.prepare_vehicle_lookup_log()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, new.requested_by);
  if new.result_status = 'success' then
    new.outcome := 'success';
  elsif new.result_status = 'failed' then
    new.outcome := case
      when new.error_code in (
        'not_found',
        'rate_limited',
        'timeout',
        'invalid_registration'
      ) then case
        when new.error_code = 'invalid_registration' then 'invalid'
        else new.error_code
      end
      else 'error'
    end;
  end if;
  return new;
end;
$$;

create trigger vehicle_lookup_logs_prepare
before insert or update on public.vehicle_lookup_logs
for each row execute function public.prepare_vehicle_lookup_log();

create index vehicle_lookup_logs_org_time_idx
  on public.vehicle_lookup_logs (organisation_id, looked_up_at desc);
create index vehicle_lookup_logs_hash_idx
  on public.vehicle_lookup_logs (organisation_id, registration_hash, looked_up_at desc);

create table public.vehicle_sync_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  provider text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  operation text not null,
  status text not null
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'skipped')),
  external_id text,
  idempotency_key text,
  request_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_summary) = 'object'),
  response_summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(response_summary) = 'object'),
  error_code text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index vehicle_sync_idempotency_unique
  on public.vehicle_sync_records (organisation_id, provider, idempotency_key)
  where idempotency_key is not null;
create index vehicle_sync_records_vehicle_idx
  on public.vehicle_sync_records (organisation_id, vehicle_id, created_at desc);
create index vehicle_sync_records_failed_idx
  on public.vehicle_sync_records (organisation_id, created_at desc)
  where status = 'failed';

create or replace function public.prepare_vehicle_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.capture_vehicle_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.vehicle_status_history (
      organisation_id,
      vehicle_id,
      from_status,
      to_status,
      changed_by
    )
    values (
      new.organisation_id,
      new.id,
      null,
      new.status,
      auth.uid()
    );
  elsif new.status is distinct from old.status then
    insert into public.vehicle_status_history (
      organisation_id,
      vehicle_id,
      from_status,
      to_status,
      changed_by
    )
    values (
      new.organisation_id,
      new.id,
      old.status,
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger vehicles_prepare_status
before update of status on public.vehicles
for each row execute function public.prepare_vehicle_status();

create trigger vehicles_capture_status
after insert or update of status on public.vehicles
for each row execute function public.capture_vehicle_status();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'customer_vehicles',
    'vehicles',
    'vehicle_images',
    'vehicle_features',
    'vehicle_costs',
    'vehicle_sync_records'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create view public.public_dealerships
with (security_barrier = true)
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

create view public.public_safe_vehicles
with (security_barrier = true)
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
  v.published_at,
  v.created_at,
  v.updated_at
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

create view public.public_vehicle_images
with (security_barrier = true)
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

create view public.public_vehicle_features
with (security_barrier = true)
as
select
  vf.id,
  vf.vehicle_id,
  vf.category,
  vf.name,
  vf.is_highlight,
  vf.sort_order
from public.vehicle_features vf
join public.vehicles v on v.id = vf.vehicle_id
join public.organisations o on o.id = vf.organisation_id
where v.is_public = true
  and v.deleted_at is null
  and v.status in ('ready_for_sale', 'on_forecourt', 'reserved', 'sold')
  and o.status = 'active'
  and o.deleted_at is null;

alter table public.customers enable row level security;
alter table public.customer_vehicles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.vehicle_features enable row level security;
alter table public.vehicle_costs enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.vehicle_lookup_logs enable row level security;
alter table public.vehicle_sync_records enable row level security;

create policy customers_read_operational
on public.customers for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy customers_write_operational
on public.customers for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy customers_update_operational
on public.customers for update to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy customer_vehicles_read_operational
on public.customer_vehicles for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy customer_vehicles_write_operational
on public.customer_vehicles for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy vehicles_read_operational
on public.vehicles for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy vehicles_insert_stock
on public.vehicles for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);
create policy vehicles_update_stock
on public.vehicles for update to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy vehicle_images_read_staff
on public.vehicle_images for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array[
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'website_editor'
    ]
  )
);
create policy vehicle_images_write_presentation
on public.vehicle_images for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy vehicle_features_read_staff
on public.vehicle_features for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array[
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'website_editor'
    ]
  )
);
create policy vehicle_features_write_presentation
on public.vehicle_features for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy vehicle_costs_management
on public.vehicle_costs for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy vehicle_status_history_read
on public.vehicle_status_history for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy vehicle_lookup_logs_operational
on public.vehicle_lookup_logs for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy vehicle_sync_records_management
on public.vehicle_sync_records for all to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
)
with check (
  public.has_org_role(organisation_id, array['owner', 'manager'])
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'customer_vehicles',
    'vehicles',
    'vehicle_images',
    'vehicle_features',
    'vehicle_costs',
    'vehicle_status_history',
    'vehicle_lookup_logs',
    'vehicle_sync_records'
  ]
  loop
    execute format('revoke all on public.%I from anon', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
  end loop;
end;
$$;

revoke all on public.public_dealerships from public;
revoke all on public.public_safe_vehicles from public;
revoke all on public.public_vehicle_images from public;
revoke all on public.public_vehicle_features from public;
grant select on public.public_dealerships to anon, authenticated;
grant select on public.public_safe_vehicles to anon, authenticated;
grant select on public.public_vehicle_images to anon, authenticated;
grant select on public.public_vehicle_features to anon, authenticated;

commit;

-- ===== 202607160003_operations.sql =====

begin;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'LEAD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  lead_type text not null
    check (
      lead_type in (
        'vehicle_enquiry',
        'callback_request',
        'test_drive',
        'part_exchange',
        'car_sourcing',
        'repair_call',
        'general_enquiry'
      )
    ),
  status text not null default 'new'
    check (
      status in (
        'new',
        'assigned',
        'contact_attempted',
        'contacted',
        'appointment_booked',
        'qualified',
        'negotiation',
        'deposit_taken',
        'won',
        'lost',
        'spam'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  title text,
  subject text,
  message text,
  source text not null default 'website',
  source_detail text,
  preferred_contact_method text
    check (
      preferred_contact_method is null
      or preferred_contact_method in ('email', 'phone', 'sms', 'either')
    ),
  next_action text,
  due_at timestamptz,
  consent_status boolean not null default false,
  consent_scope text not null default 'not_recorded'
    check (
      consent_scope in (
        'not_recorded',
        'transactional_only',
        'marketing_granted',
        'marketing_withdrawn'
      )
    ),
  consent_recorded_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  lost_reason text,
  utm jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  last_activity_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create or replace function public.prepare_lead_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), nullif(trim(new.subject), ''));
  new.subject := coalesce(nullif(trim(new.subject), ''), nullif(trim(new.title), ''));
  if new.title is null then
    raise exception 'Lead title is required'
      using errcode = '23502';
  end if;
  new.utm := coalesce(new.utm, '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'source',
        new.utm_source,
        'medium',
        new.utm_medium,
        'campaign',
        new.utm_campaign
      )
    );
  if new.consent_scope = 'not_recorded' and new.consent_status then
    new.consent_scope := 'transactional_only';
  end if;
  return new;
end;
$$;

create trigger leads_prepare_compatibility
before insert or update on public.leads
for each row execute function public.prepare_lead_compatibility();

create unique index leads_org_reference_unique
  on public.leads (organisation_id, reference);
create index leads_org_status_idx
  on public.leads (organisation_id, status, created_at desc)
  where deleted_at is null;
create index leads_assigned_due_idx
  on public.leads (organisation_id, assigned_user_id, due_at)
  where deleted_at is null
    and status not in ('won', 'lost', 'spam');
create index leads_customer_idx
  on public.leads (organisation_id, customer_id, created_at desc)
  where deleted_at is null;
create index leads_vehicle_idx
  on public.leads (organisation_id, vehicle_id, created_at desc)
  where deleted_at is null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null
    check (
      activity_type in (
        'note',
        'email',
        'sms',
        'phone_call',
        'status_change',
        'assignment',
        'appointment',
        'task',
        'system'
      )
    ),
  direction text
    check (direction is null or direction in ('inbound', 'outbound', 'internal')),
  summary text not null,
  body text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index lead_activities_lead_idx
  on public.lead_activities (lead_id, occurred_at desc);
create index lead_activities_org_time_idx
  on public.lead_activities (organisation_id, occurred_at desc);

create table public.sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'SRC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new'
    check (
      status in (
        'new',
        'contact_attempted',
        'requirements_confirmed',
        'search_active',
        'options_found',
        'option_sent_to_customer',
        'inspection_required',
        'negotiation',
        'deposit_requested',
        'vehicle_secured',
        'preparing_vehicle',
        'completed',
        'paused',
        'lost'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  preferred_make text,
  preferred_model text,
  alternative_models text,
  alternative_vehicles text,
  minimum_year integer check (minimum_year between 1886 and 2200),
  maximum_mileage integer check (maximum_mileage >= 0),
  fuel_preference text,
  transmission_preference text,
  colour_preferences text,
  required_features text,
  budget numeric(12,2) not null check (budget > 0),
  deposit_available numeric(12,2) check (deposit_available >= 0),
  finance_required boolean not null default false,
  part_exchange boolean not null default false,
  desired_timescale text,
  requirements text,
  sourcing_fee numeric(12,2) check (sourcing_fee >= 0),
  next_action_at timestamptz,
  closed_at timestamptz,
  lost_reason text,
  converted_vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

alter table public.leads
  add column sourcing_request_id uuid
    references public.sourcing_requests(id) on delete set null;

create unique index sourcing_requests_org_reference_unique
  on public.sourcing_requests (organisation_id, reference);
create index sourcing_requests_status_idx
  on public.sourcing_requests (organisation_id, status, created_at desc)
  where deleted_at is null;
create index sourcing_requests_assigned_idx
  on public.sourcing_requests (organisation_id, assigned_user_id, next_action_at)
  where deleted_at is null
    and status not in ('completed', 'lost');
create index sourcing_requests_customer_idx
  on public.sourcing_requests (organisation_id, customer_id, created_at desc);

create table public.sourcing_candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sourcing_request_id uuid not null
    references public.sourcing_requests(id) on delete cascade,
  stock_vehicle_id uuid references public.vehicles(id) on delete set null,
  supplier_name text,
  supplier_contact text,
  source_url text,
  registration text,
  make text not null,
  model text not null,
  derivative text,
  year integer check (year between 1886 and 2200),
  mileage integer check (mileage >= 0),
  colour text,
  expected_purchase_price numeric(12,2)
    check (expected_purchase_price >= 0),
  expected_preparation_cost numeric(12,2) not null default 0
    check (expected_preparation_cost >= 0),
  proposed_customer_price numeric(12,2)
    check (proposed_customer_price >= 0),
  expected_margin numeric(12,2) generated always as (
    case
      when proposed_customer_price is null or expected_purchase_price is null then null
      else proposed_customer_price
        - expected_purchase_price
        - expected_preparation_cost
    end
  ) stored,
  inspection_status text not null default 'not_requested'
    check (
      inspection_status in (
        'not_requested',
        'required',
        'booked',
        'passed',
        'failed'
      )
    ),
  customer_decision text not null default 'pending'
    check (
      customer_decision in (
        'pending',
        'interested',
        'declined',
        'approved',
        'unavailable'
      )
    ),
  notes text,
  sent_to_customer_at timestamptz,
  customer_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index sourcing_candidates_request_idx
  on public.sourcing_candidates (sourcing_request_id, created_at desc)
  where deleted_at is null;
create index sourcing_candidates_decision_idx
  on public.sourcing_candidates (
    organisation_id,
    customer_decision,
    inspection_status
  )
  where deleted_at is null;

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  category text not null default 'repair_call'
    check (
      category in (
        'repair_call',
        'viewing',
        'test_drive',
        'sales_call',
        'handover',
        'internal'
      )
    ),
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240),
  default_capacity integer not null default 1
    check (default_capacity between 1 and 20),
  colour text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  is_public_bookable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, slug)
);

create index appointment_types_public_idx
  on public.appointment_types (organisation_id, category)
  where is_public_bookable = true and active = true;

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_type_id uuid not null
    references public.appointment_types(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time_local time not null,
  end_time_local time not null,
  slot_duration_minutes integer not null
    check (slot_duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240),
  minimum_notice_minutes integer not null default 120
    check (minimum_notice_minutes between 0 and 10080),
  maximum_advance_days integer not null default 60
    check (maximum_advance_days between 1 and 365),
  maximum_simultaneous integer not null default 1
    check (maximum_simultaneous between 1 and 20),
  timezone text not null default 'Europe/London',
  valid_from date,
  valid_until date,
  active boolean not null default true,
  appointment_type text not null default 'repair_call',
  day_of_week smallint generated always as (weekday) stored,
  start_time time generated always as (start_time_local) stored,
  end_time time generated always as (end_time_local) stored,
  minimum_notice_hours numeric(8,2) generated always as (
    minimum_notice_minutes / 60.0
  ) stored,
  is_active boolean generated always as (active) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (end_time_local > start_time_local),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index availability_rules_lookup_idx
  on public.availability_rules (
    organisation_id,
    appointment_type_id,
    weekday,
    active
  );
create index availability_rules_staff_idx
  on public.availability_rules (organisation_id, staff_user_id, weekday)
  where active = true;

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_type_id uuid references public.appointment_types(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete cascade,
  exception_date date not null,
  exception_type text not null
    check (exception_type in ('closed', 'open', 'capacity_override')),
  start_time_local time,
  end_time_local time,
  maximum_simultaneous integer
    check (maximum_simultaneous between 0 and 20),
  reason text,
  is_closed boolean generated always as (
    exception_type = 'closed'
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (
    (start_time_local is null and end_time_local is null)
    or (
      start_time_local is not null
      and end_time_local is not null
      and end_time_local > start_time_local
    )
  ),
  check (
    exception_type <> 'capacity_override'
    or maximum_simultaneous is not null
  )
);

create index availability_exceptions_lookup_idx
  on public.availability_exceptions (
    organisation_id,
    exception_date,
    appointment_type_id
  );

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'APT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  appointment_type_id uuid not null
    references public.appointment_types(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_vehicle_id uuid references public.customer_vehicles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_period tstzrange generated always as (
    tstzrange(starts_at, ends_at, '[)')
  ) stored,
  booking_resource smallint not null default 1
    check (booking_resource between 1 and 20),
  status text not null default 'requested'
    check (
      status in (
        'requested',
        'confirmed',
        'assigned',
        'call_completed',
        'repair_estimate_required',
        'workshop_appointment_required',
        'customer_unavailable',
        'cancelled',
        'no_show',
        'closed'
      )
    ),
  reason_for_call text,
  registration text,
  vehicle_make_model text,
  fault_description text,
  warning_lights text,
  is_driveable boolean,
  preferred_contact_method text
    check (
      preferred_contact_method is null
      or preferred_contact_method in ('email', 'phone', 'sms', 'either')
    ),
  customer_notes text,
  internal_notes text,
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (ends_at > starts_at),
  constraint appointments_no_resource_overlap
    exclude using gist (
      organisation_id with =,
      appointment_type_id with =,
      booking_resource with =,
      booking_period with &&
    )
    where (
      deleted_at is null
      and status in ('requested', 'confirmed', 'assigned')
    )
);

create unique index appointments_org_reference_unique
  on public.appointments (organisation_id, reference);
create index appointments_org_start_idx
  on public.appointments (organisation_id, starts_at, status)
  where deleted_at is null;
create index appointments_assigned_start_idx
  on public.appointments (organisation_id, assigned_user_id, starts_at)
  where deleted_at is null;
create index appointments_customer_idx
  on public.appointments (organisation_id, customer_id, starts_at desc)
  where deleted_at is null;

create table public.repair_services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  slug text not null,
  short_description text,
  full_description text,
  icon_name text,
  display_order integer not null default 0,
  indicative_price_from numeric(12,2)
    check (indicative_price_from >= 0),
  is_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, slug)
);

create index repair_services_public_idx
  on public.repair_services (organisation_id, display_order)
  where is_public = true and active = true;

create table public.repair_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'JOB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_vehicle_id uuid references public.customer_vehicles(id) on delete set null,
  assigned_technician_id uuid references auth.users(id) on delete set null,
  status text not null default 'awaiting_inspection'
    check (
      status in (
        'awaiting_inspection',
        'diagnosing',
        'estimate_preparing',
        'awaiting_customer_approval',
        'approved',
        'parts_ordered',
        'parts_received',
        'work_in_progress',
        'quality_check',
        'ready_for_collection',
        'collected',
        'cancelled'
      )
    ),
  registration text,
  vehicle_make_model text,
  mileage integer check (mileage >= 0),
  reported_fault text not null,
  diagnosis text,
  labour_rate numeric(12,2) not null default 0 check (labour_rate >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  estimate_net numeric(12,2) not null default 0 check (estimate_net >= 0),
  estimate_vat numeric(12,2) not null default 0 check (estimate_vat >= 0),
  estimate_total numeric(12,2) not null default 0 check (estimate_total >= 0),
  approval_status text not null default 'not_requested'
    check (
      approval_status in (
        'not_requested',
        'requested',
        'approved',
        'partially_approved',
        'declined'
      )
    ),
  approval_recorded_at timestamptz,
  work_completed text,
  technician_notes text,
  internal_notes text,
  customer_facing_notes text,
  start_date date,
  due_date date,
  collection_date date,
  payment_status text not null default 'not_invoiced'
    check (
      payment_status in (
        'not_invoiced',
        'invoice_due',
        'part_paid',
        'paid',
        'refunded',
        'written_off'
      )
    ),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (due_date is null or start_date is null or due_date >= start_date),
  check (
    collection_date is null
    or start_date is null
    or collection_date >= start_date
  )
);

create unique index repair_jobs_org_reference_unique
  on public.repair_jobs (organisation_id, reference);
create index repair_jobs_status_idx
  on public.repair_jobs (organisation_id, status, due_date)
  where deleted_at is null;
create index repair_jobs_technician_idx
  on public.repair_jobs (organisation_id, assigned_technician_id, status, due_date)
  where deleted_at is null;
create index repair_jobs_customer_idx
  on public.repair_jobs (organisation_id, customer_id, created_at desc)
  where deleted_at is null;

create table public.repair_job_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  repair_job_id uuid not null references public.repair_jobs(id) on delete cascade,
  item_type text not null
    check (
      item_type in ('labour', 'part', 'fee', 'discount', 'inspection', 'note')
    ),
  description text not null,
  supplier text,
  part_number text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  line_total numeric(12,2) generated always as (
    round(quantity * unit_price, 2)
  ) stored,
  status text not null default 'planned'
    check (
      status in (
        'planned',
        'ordered',
        'received',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  customer_approved boolean,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index repair_job_items_job_idx
  on public.repair_job_items (repair_job_id, sort_order)
  where deleted_at is null;
create index repair_job_items_status_idx
  on public.repair_job_items (organisation_id, status)
  where deleted_at is null;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'SALE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  salesperson_id uuid references auth.users(id) on delete set null,
  status text not null default 'enquiry'
    check (
      status in (
        'enquiry',
        'viewing',
        'test_drive',
        'negotiation',
        'deposit_taken',
        'reserved',
        'sale_agreed',
        'handover_scheduled',
        'completed',
        'cancelled'
      )
    ),
  sale_price numeric(12,2) check (sale_price >= 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  part_exchange_allowance numeric(12,2) not null default 0
    check (part_exchange_allowance >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  warranty text,
  additional_products jsonb not null default '[]'::jsonb
    check (jsonb_typeof(additional_products) = 'array'),
  payment_method text,
  finance_referral_provider text,
  finance_referral_status text,
  sale_date date,
  handover_date date,
  gross_profit numeric(12,2),
  internal_notes text,
  completion_checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completion_checklist) = 'array'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (handover_date is null or sale_date is null or handover_date >= sale_date)
);

create unique index sales_org_reference_unique
  on public.sales (organisation_id, reference);
create index sales_status_idx
  on public.sales (organisation_id, status, created_at desc)
  where deleted_at is null;
create index sales_vehicle_idx
  on public.sales (organisation_id, vehicle_id, created_at desc)
  where deleted_at is null;
create index sales_salesperson_idx
  on public.sales (organisation_id, salesperson_id, sale_date desc)
  where deleted_at is null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  reminder_at timestamptz,
  recurrence_rule text,
  customer_id uuid references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  repair_job_id uuid references public.repair_jobs(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index tasks_assigned_due_idx
  on public.tasks (organisation_id, assigned_user_id, due_at, priority)
  where deleted_at is null
    and status in ('open', 'in_progress', 'blocked');
create index tasks_overdue_idx
  on public.tasks (organisation_id, due_at)
  where deleted_at is null
    and status in ('open', 'in_progress', 'blocked');
create index tasks_customer_idx
  on public.tasks (organisation_id, customer_id)
  where deleted_at is null and customer_id is not null;
create index tasks_vehicle_idx
  on public.tasks (organisation_id, vehicle_id)
  where deleted_at is null and vehicle_id is not null;

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index task_comments_task_idx
  on public.task_comments (task_id, created_at);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text,
  file_name text,
  document_type text not null default 'other',
  storage_bucket text not null default 'private-documents',
  storage_path text not null,
  mime_type text not null,
  byte_size bigint check (byte_size between 1 and 52428800),
  size_bytes bigint check (size_bytes between 1 and 52428800),
  checksum_sha256 text,
  visibility text not null default 'private'
    check (visibility in ('private', 'customer', 'public')),
  entity_type text,
  entity_id uuid,
  customer_id uuid references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  repair_job_id uuid references public.repair_jobs(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  unique (storage_bucket, storage_path),
  check (coalesce(title, file_name) is not null),
  check (coalesce(byte_size, size_bytes) is not null)
);

create or replace function public.prepare_document_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), nullif(trim(new.file_name), ''));
  new.file_name := coalesce(nullif(trim(new.file_name), ''), nullif(trim(new.title), ''));
  new.byte_size := coalesce(new.byte_size, new.size_bytes);
  new.size_bytes := coalesce(new.size_bytes, new.byte_size);
  return new;
end;
$$;

create trigger documents_prepare_compatibility
before insert or update on public.documents
for each row execute function public.prepare_document_compatibility();

create index documents_org_created_idx
  on public.documents (organisation_id, created_at desc)
  where deleted_at is null;
create index documents_customer_idx
  on public.documents (organisation_id, customer_id)
  where deleted_at is null and customer_id is not null;
create index documents_repair_idx
  on public.documents (organisation_id, repair_job_id)
  where deleted_at is null and repair_job_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  notification_type text not null
    check (
      notification_type in (
        'new_lead',
        'new_repair_booking',
        'new_sourcing_request',
        'appointment_cancelled',
        'task_overdue',
        'vehicle_reserved',
        'vehicle_sold',
        'sync_failed',
        'lookup_failed',
        'repair_awaiting_approval',
        'system'
      )
    ),
  title text not null,
  body text,
  action_url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index notifications_recipient_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);
create index notifications_org_type_idx
  on public.notifications (organisation_id, notification_type, created_at desc);

create table public.website_pages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  page_type text not null
    check (
      page_type in (
        'homepage',
        'about',
        'repairs',
        'contact',
        'faq',
        'testimonials',
        'privacy',
        'cookies',
        'terms',
        'custom'
      )
    ),
  slug text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  seo_title text,
  seo_description text,
  requires_legal_review boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  unique (organisation_id, slug)
);

create index website_pages_status_idx
  on public.website_pages (organisation_id, status, updated_at desc)
  where deleted_at is null;

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null,
  status text not null default 'not_configured'
    check (
      status in (
        'not_configured',
        'connected',
        'authentication_failed',
        'permission_missing',
        'syncing',
        'error',
        'disabled'
      )
    ),
  public_configuration jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_configuration) = 'object'),
  secret_reference text,
  last_connected_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, provider)
);

create index integration_settings_status_idx
  on public.integration_settings (organisation_id, status);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  occurred_at timestamptz,
  status text not null default 'received'
    check (
      status in ('received', 'processing', 'processed', 'ignored', 'failed')
    ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  processed_at timestamptz,
  error_code text,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index webhook_events_pending_idx
  on public.webhook_events (status, next_retry_at, received_at)
  where status in ('received', 'failed');
create index webhook_events_org_idx
  on public.webhook_events (organisation_id, received_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id text,
  table_name text not null default 'application',
  record_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text,
  entity_id uuid,
  change_reason text,
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now(),
  source text not null default 'database'
);

create index audit_logs_org_time_idx
  on public.audit_logs (organisation_id, occurred_at desc);
create index audit_logs_record_idx
  on public.audit_logs (table_name, record_id, occurred_at desc);
create index audit_logs_actor_idx
  on public.audit_logs (organisation_id, actor_user_id, occurred_at desc);

create view public.public_repair_services
with (security_barrier = true)
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
with (security_barrier = true)
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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads',
    'sourcing_requests',
    'sourcing_candidates',
    'appointment_types',
    'availability_rules',
    'availability_exceptions',
    'appointments',
    'repair_services',
    'repair_jobs',
    'repair_job_items',
    'sales',
    'tasks',
    'documents',
    'website_pages',
    'integration_settings',
    'webhook_events'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads',
    'lead_activities',
    'sourcing_requests',
    'sourcing_candidates',
    'appointment_types',
    'availability_rules',
    'availability_exceptions',
    'appointments',
    'repair_services',
    'repair_jobs',
    'repair_job_items',
    'sales',
    'tasks',
    'task_comments',
    'documents',
    'notifications',
    'website_pages',
    'integration_settings',
    'webhook_events',
    'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

revoke all on public.public_repair_services from public;
revoke all on public.public_website_pages from public;
grant select on public.public_repair_services to anon, authenticated;
grant select on public.public_website_pages to anon, authenticated;

commit;

-- ===== 202607160004_security_workflows.sql =====

begin;

create table public.public_submission_counters (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  action text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, action, key_hash, window_started_at)
);

alter table public.public_submission_counters enable row level security;
revoke all on public.public_submission_counters from anon, authenticated;

create or replace function public.consume_public_rate_limit(
  target_organisation_id uuid,
  target_action text,
  client_token text,
  maximum_attempts integer default 5,
  window_minutes integer default 15
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  recorded_attempts integer;
begin
  if client_token is null or char_length(client_token) < 16 then
    raise exception 'A valid submission token is required'
      using errcode = '22023';
  end if;

  if maximum_attempts not between 1 and 100
    or window_minutes not between 1 and 1440 then
    raise exception 'Invalid rate-limit configuration'
      using errcode = '22023';
  end if;

  bucket_start := date_bin(
    make_interval(mins => window_minutes),
    now(),
    timestamptz '2000-01-01 00:00:00+00'
  );

  insert into public.public_submission_counters (
    organisation_id,
    action,
    key_hash,
    window_started_at,
    attempts
  )
  values (
    target_organisation_id,
    target_action,
    encode(digest(client_token, 'sha256'), 'hex'),
    bucket_start,
    1
  )
  on conflict (organisation_id, action, key_hash, window_started_at)
  do update
  set
    attempts = public.public_submission_counters.attempts + 1,
    updated_at = now()
  where public.public_submission_counters.attempts < maximum_attempts
  returning attempts into recorded_attempts;

  if recorded_attempts is null then
    raise exception 'Too many submissions. Please try again later.'
      using errcode = 'P0001';
  end if;

  if random() < 0.01 then
    delete from public.public_submission_counters
    where window_started_at < now() - interval '2 days';
  end if;
end;
$$;

create or replace function public.assert_same_organisation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  foreign_column text := tg_argv[0];
  foreign_table text := tg_argv[1];
  foreign_id uuid;
  referenced_organisation_id uuid;
begin
  foreign_id := nullif(to_jsonb(new) ->> foreign_column, '')::uuid;
  if foreign_id is null then
    return new;
  end if;

  execute format(
    'select organisation_id from public.%I where id = $1',
    foreign_table
  )
  into referenced_organisation_id
  using foreign_id;

  if referenced_organisation_id is distinct from new.organisation_id then
    raise exception
      'Cross-organisation reference from %.% to % is not allowed',
      tg_table_name,
      foreign_column,
      foreign_table
      using errcode = '23514';
  end if;

  return new;
end;
$$;

do $$
declare
  relation record;
begin
  for relation in
    select *
    from (
      values
        ('customer_vehicles', 'customer_id', 'customers'),
        ('customer_vehicles', 'stock_vehicle_id', 'vehicles'),
        ('vehicle_images', 'vehicle_id', 'vehicles'),
        ('vehicle_features', 'vehicle_id', 'vehicles'),
        ('vehicle_costs', 'vehicle_id', 'vehicles'),
        ('vehicle_status_history', 'vehicle_id', 'vehicles'),
        ('vehicle_sync_records', 'vehicle_id', 'vehicles'),
        ('leads', 'customer_id', 'customers'),
        ('leads', 'vehicle_id', 'vehicles'),
        ('leads', 'sourcing_request_id', 'sourcing_requests'),
        ('lead_activities', 'lead_id', 'leads'),
        ('sourcing_requests', 'customer_id', 'customers'),
        ('sourcing_requests', 'lead_id', 'leads'),
        ('sourcing_requests', 'converted_vehicle_id', 'vehicles'),
        ('sourcing_candidates', 'sourcing_request_id', 'sourcing_requests'),
        ('sourcing_candidates', 'stock_vehicle_id', 'vehicles'),
        ('availability_rules', 'appointment_type_id', 'appointment_types'),
        ('availability_exceptions', 'appointment_type_id', 'appointment_types'),
        ('appointments', 'appointment_type_id', 'appointment_types'),
        ('appointments', 'customer_id', 'customers'),
        ('appointments', 'customer_vehicle_id', 'customer_vehicles'),
        ('appointments', 'lead_id', 'leads'),
        ('repair_jobs', 'appointment_id', 'appointments'),
        ('repair_jobs', 'customer_id', 'customers'),
        ('repair_jobs', 'customer_vehicle_id', 'customer_vehicles'),
        ('repair_job_items', 'repair_job_id', 'repair_jobs'),
        ('sales', 'vehicle_id', 'vehicles'),
        ('sales', 'customer_id', 'customers'),
        ('sales', 'lead_id', 'leads'),
        ('tasks', 'customer_id', 'customers'),
        ('tasks', 'vehicle_id', 'vehicles'),
        ('tasks', 'lead_id', 'leads'),
        ('tasks', 'sourcing_request_id', 'sourcing_requests'),
        ('tasks', 'appointment_id', 'appointments'),
        ('tasks', 'repair_job_id', 'repair_jobs'),
        ('tasks', 'sale_id', 'sales'),
        ('task_comments', 'task_id', 'tasks'),
        ('documents', 'customer_id', 'customers'),
        ('documents', 'vehicle_id', 'vehicles'),
        ('documents', 'lead_id', 'leads'),
        ('documents', 'sourcing_request_id', 'sourcing_requests'),
        ('documents', 'appointment_id', 'appointments'),
        ('documents', 'repair_job_id', 'repair_jobs'),
        ('documents', 'sale_id', 'sales')
    ) as links(table_name, column_name, referenced_table)
  loop
    execute format(
      'create trigger %I_assert_org before insert or update on public.%I for each row execute function public.assert_same_organisation(%L, %L)',
      relation.table_name || '_' || relation.column_name,
      relation.table_name,
      relation.column_name,
      relation.referenced_table
    );
  end loop;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  tenant_id uuid;
  target_id uuid;
  changed text[];
begin
  if tg_op <> 'INSERT' then
    old_row := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_row := to_jsonb(new);
  end if;

  tenant_id := nullif(
    coalesce(new_row ->> 'organisation_id', old_row ->> 'organisation_id'),
    ''
  )::uuid;
  target_id := nullif(coalesce(new_row ->> 'id', old_row ->> 'id'), '')::uuid;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}'::text[])
    into changed
    from (
      select key
      from jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) key
      where old_row -> key is distinct from new_row -> key
        and key not in ('updated_at')
    ) differences;

    if cardinality(changed) = 0 then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    changed := array['created'];
  else
    changed := array['deleted'];
  end if;

  old_row := old_row - 'secret_reference';
  new_row := new_row - 'secret_reference';

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    request_id,
    table_name,
    record_id,
    action,
    changed_fields,
    old_values,
    new_values
  )
  values (
    tenant_id,
    auth.uid(),
    nullif(current_setting('request.id', true), ''),
    tg_table_name,
    target_id,
    tg_op,
    changed,
    old_row,
    new_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vehicles',
    'customers',
    'appointments',
    'repair_jobs',
    'sales',
    'organisation_members',
    'integration_settings'
  ]
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create policy leads_read_management
on public.leads for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy leads_read_sales_assigned
on public.leads for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);
create policy leads_read_service
on public.leads for select to authenticated
using (
  public.has_org_role(organisation_id, array['service_advisor'])
  and lead_type = 'repair_call'
);
create policy leads_insert_operational
on public.leads for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy leads_update_management
on public.leads for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy leads_update_assigned
on public.leads for update to authenticated
using (
  (
    public.has_org_role(organisation_id, array['salesperson'])
    and (assigned_user_id is null or assigned_user_id = auth.uid())
  )
  or (
    public.has_org_role(organisation_id, array['service_advisor'])
    and lead_type = 'repair_call'
  )
)
with check (
  (
    public.has_org_role(organisation_id, array['salesperson'])
    and (assigned_user_id is null or assigned_user_id = auth.uid())
  )
  or (
    public.has_org_role(organisation_id, array['service_advisor'])
    and lead_type = 'repair_call'
  )
);

create policy lead_activities_read_visible_lead
on public.lead_activities for select to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_activities.lead_id
  )
);
create policy lead_activities_insert_visible_lead
on public.lead_activities for insert to authenticated
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_activities.lead_id
  )
);

create policy sourcing_read_management
on public.sourcing_requests for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sourcing_read_assigned_sales
on public.sourcing_requests for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);
create policy sourcing_write_management
on public.sourcing_requests for all to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sourcing_write_assigned_sales
on public.sourcing_requests for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);

create policy sourcing_candidates_visible_request
on public.sourcing_candidates for select to authenticated
using (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
);
create policy sourcing_candidates_write_request
on public.sourcing_candidates for all to authenticated
using (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
)
with check (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
);

create policy appointment_types_read_staff
on public.appointment_types for select to authenticated
using (public.is_org_member(organisation_id));
create policy appointment_types_write_management
on public.appointment_types for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy availability_rules_read_staff
on public.availability_rules for select to authenticated
using (public.is_org_member(organisation_id));
create policy availability_rules_write_management
on public.availability_rules for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy availability_exceptions_read_staff
on public.availability_exceptions for select to authenticated
using (public.is_org_member(organisation_id));
create policy availability_exceptions_write_management
on public.availability_exceptions for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy appointments_read_management
on public.appointments for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy appointments_read_assigned_sales
on public.appointments for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
);
create policy appointments_write_management
on public.appointments for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy appointments_write_assigned_sales
on public.appointments for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
);

create policy repair_services_read_staff
on public.repair_services for select to authenticated
using (public.is_org_member(organisation_id));
create policy repair_services_write_content
on public.repair_services for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor', 'website_editor']
  )
);

create policy repair_jobs_read_operational
on public.repair_jobs for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy repair_jobs_write_operational
on public.repair_jobs for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy repair_items_read_operational
on public.repair_job_items for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);
create policy repair_items_write_operational
on public.repair_job_items for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);

create policy sales_read_management
on public.sales for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sales_read_assigned
on public.sales for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
);
create policy sales_write_management
on public.sales for all to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sales_write_assigned
on public.sales for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
);

create policy tasks_read_management_or_assigned
on public.tasks for select to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
);
create policy tasks_insert_member
on public.tasks for insert to authenticated
with check (public.is_org_member(organisation_id));
create policy tasks_update_management_or_assigned
on public.tasks for update to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
)
with check (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
);

create policy task_comments_visible_task
on public.task_comments for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));
create policy task_comments_create_visible_task
on public.task_comments for insert to authenticated
with check (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy documents_read_operational
on public.documents for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and repair_job_id is not null
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = documents.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);
create policy documents_write_operational
on public.documents for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy notifications_read_own
on public.notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
);
create policy notifications_read_broadcast_management
on public.notifications for select to authenticated
using (
  recipient_user_id is null
  and public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy notifications_update_own
on public.notifications for update to authenticated
using (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
)
with check (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
);
create policy notifications_insert_management
on public.notifications for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy website_pages_read_staff
on public.website_pages for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);
create policy website_pages_write_content
on public.website_pages for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);

create policy integration_settings_read_management
on public.integration_settings for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy integration_settings_write_owner
on public.integration_settings for all to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

create policy webhook_events_read_management
on public.webhook_events for select to authenticated
using (
  organisation_id is not null
  and public.has_org_role(organisation_id, array['owner', 'manager'])
);

create policy audit_logs_read_owner
on public.audit_logs for select to authenticated
using (
  organisation_id is not null
  and public.has_org_role(organisation_id, array['owner'])
);

create view public.public_vehicle_inventory
with (security_barrier = true)
as
select * from public.public_safe_vehicles;

create view public.public_appointment_types
with (security_barrier = true)
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

create view public.vehicle_presentation_records
with (security_barrier = true)
as
select
  v.id,
  v.organisation_id,
  v.stock_number,
  v.make,
  v.model,
  v.derivative,
  v.year,
  v.mileage,
  v.fuel_type,
  v.transmission,
  v.body_type,
  v.colour,
  v.status,
  v.public_title,
  v.attention_grabber,
  v.description,
  v.standard_equipment,
  v.optional_equipment,
  v.finance_example_text,
  v.warranty_wording,
  v.video_url,
  v.featured,
  v.is_public,
  v.slug,
  v.seo_title,
  v.seo_description,
  v.published_at,
  v.updated_at
from public.vehicles v
where v.deleted_at is null
  and public.has_org_role(
    v.organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  );

create view public.technician_repair_jobs
with (security_barrier = true)
as
select
  rj.id,
  rj.organisation_id,
  rj.reference,
  rj.appointment_id,
  rj.customer_vehicle_id,
  rj.assigned_technician_id,
  rj.status,
  rj.registration,
  rj.vehicle_make_model,
  rj.mileage,
  rj.reported_fault,
  rj.diagnosis,
  rj.work_completed,
  rj.technician_notes,
  rj.customer_facing_notes,
  rj.start_date,
  rj.due_date,
  rj.collection_date,
  rj.updated_at
from public.repair_jobs rj
where rj.deleted_at is null
  and rj.assigned_technician_id = auth.uid()
  and public.has_org_role(rj.organisation_id, array['technician']);

create or replace function public.public_available_appointment_slots(
  organisation_slug text,
  appointment_type_slug text,
  first_date date default current_date,
  number_of_days integer default 14
)
returns table (
  appointment_type_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  remaining_capacity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select
      o.id as organisation_id,
      at.id as appointment_type_id
    from public.organisations o
    join public.appointment_types at on at.organisation_id = o.id
    where o.slug = organisation_slug
      and o.status = 'active'
      and o.deleted_at is null
      and at.slug = appointment_type_slug
      and at.is_public_bookable = true
      and at.active = true
      and number_of_days between 1 and 90
  ),
  calendar as (
    select
      ar.*,
      day_value::date as local_date
    from target t
    join public.availability_rules ar
      on ar.organisation_id = t.organisation_id
      and ar.appointment_type_id = t.appointment_type_id
      and ar.active = true
    cross join lateral generate_series(
      greatest(first_date, (now() at time zone ar.timezone)::date)::timestamp,
      least(
        first_date + (number_of_days - 1),
        (now() at time zone ar.timezone)::date + ar.maximum_advance_days
      )::timestamp,
      interval '1 day'
    ) day_value
    where extract(dow from day_value)::smallint = ar.weekday
      and (ar.valid_from is null or day_value::date >= ar.valid_from)
      and (ar.valid_until is null or day_value::date <= ar.valid_until)
  ),
  raw_slots as (
    select
      c.organisation_id,
      c.appointment_type_id,
      c.timezone,
      c.local_date,
      c.maximum_simultaneous,
      c.slot_duration_minutes,
      local_start at time zone c.timezone as slot_start,
      (
        local_start
        + make_interval(mins => c.slot_duration_minutes)
      ) at time zone c.timezone as slot_end
    from calendar c
    cross join lateral generate_series(
      c.local_date + c.start_time_local,
      c.local_date + c.end_time_local
        - make_interval(mins => c.slot_duration_minutes),
      make_interval(mins => c.slot_duration_minutes + c.buffer_minutes)
    ) local_start
    where
      (local_start at time zone c.timezone)
        >= now() + make_interval(mins => c.minimum_notice_minutes)
      and not exists (
        select 1
        from public.availability_exceptions ae
        where ae.organisation_id = c.organisation_id
          and (
            ae.appointment_type_id is null
            or ae.appointment_type_id = c.appointment_type_id
          )
          and ae.exception_date = c.local_date
          and ae.exception_type = 'closed'
          and (
            ae.start_time_local is null
            or (
              local_start::time < ae.end_time_local
              and (
                local_start
                + make_interval(mins => c.slot_duration_minutes)
              )::time > ae.start_time_local
            )
          )
      )
  ),
  capacities as (
    select
      rs.*,
      coalesce(
        (
          select ae.maximum_simultaneous
          from public.availability_exceptions ae
          where ae.organisation_id = rs.organisation_id
            and (
              ae.appointment_type_id is null
              or ae.appointment_type_id = rs.appointment_type_id
            )
            and ae.exception_date = rs.local_date
            and ae.exception_type = 'capacity_override'
            and (
              ae.start_time_local is null
              or (
                (rs.slot_start at time zone rs.timezone)::time < ae.end_time_local
                and (rs.slot_end at time zone rs.timezone)::time > ae.start_time_local
              )
            )
          order by ae.appointment_type_id nulls last
          limit 1
        ),
        rs.maximum_simultaneous
      ) as slot_capacity
    from raw_slots rs
  ),
  available as (
    select
      c.appointment_type_id,
      c.slot_start,
      c.slot_end,
      c.slot_capacity - (
        select count(*)::integer
        from public.appointments a
        where a.organisation_id = c.organisation_id
          and a.appointment_type_id = c.appointment_type_id
          and a.deleted_at is null
          and a.status in ('requested', 'confirmed', 'assigned')
          and a.booking_period && tstzrange(c.slot_start, c.slot_end, '[)')
      ) as remaining_capacity
    from capacities c
  )
  select distinct on (a.slot_start)
    a.appointment_type_id,
    a.slot_start as starts_at,
    a.slot_end as ends_at,
    a.remaining_capacity
  from available a
  where a.remaining_capacity > 0
  order by a.slot_start, a.remaining_capacity desc;
$$;

create or replace function public.book_repair_call(
  p_organisation_slug text,
  p_appointment_type_slug text,
  p_starts_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_reason_for_call text,
  p_fault_description text,
  p_registration text,
  p_vehicle_make_model text,
  p_consent boolean,
  p_privacy_accepted boolean,
  p_rate_limit_token text,
  p_warning_lights text default null,
  p_is_driveable boolean default null,
  p_preferred_contact_method text default 'phone',
  p_honeypot text default ''
)
returns table (
  appointment_id uuid,
  appointment_reference text,
  lead_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organisation public.organisations%rowtype;
  target_type public.appointment_types%rowtype;
  matched_customer_ids uuid[];
  target_customer_id uuid;
  target_customer_vehicle_id uuid;
  target_lead_id uuid;
  target_appointment_id uuid;
  target_appointment_reference text;
  target_ends_at timestamptz;
  available_remaining integer;
  existing_bookings integer;
  slot_capacity integer;
  selected_resource integer;
  resource_number integer;
  local_booking_date date;
  normalised_customer_phone text;
begin
  if nullif(trim(p_honeypot), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;

  if not coalesce(p_consent, false) or not coalesce(p_privacy_accepted, false) then
    raise exception 'Contact consent and privacy acknowledgement are required'
      using errcode = '22023';
  end if;

  if char_length(trim(p_first_name)) not between 1 and 80
    or char_length(trim(p_last_name)) not between 1 and 80
    or char_length(trim(p_reason_for_call)) not between 2 and 200
    or char_length(trim(p_fault_description)) not between 3 and 4000 then
    raise exception 'Required booking details are invalid'
      using errcode = '22023';
  end if;

  if p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid email address is required'
      using errcode = '22023';
  end if;

  normalised_customer_phone := public.normalise_phone(p_phone);
  if normalised_customer_phone is null
    or char_length(normalised_customer_phone) not between 10 and 15 then
    raise exception 'A valid telephone number is required'
      using errcode = '22023';
  end if;

  if p_preferred_contact_method not in ('email', 'phone', 'sms', 'either') then
    raise exception 'Preferred contact method is invalid'
      using errcode = '22023';
  end if;

  select o.*
  into strict target_organisation
  from public.organisations o
  where o.slug = p_organisation_slug
    and o.status = 'active'
    and o.deleted_at is null;

  select at.*
  into strict target_type
  from public.appointment_types at
  where at.organisation_id = target_organisation.id
    and at.slug = p_appointment_type_slug
    and at.category = 'repair_call'
    and at.is_public_bookable = true
    and at.active = true;

  perform public.consume_public_rate_limit(
    target_organisation.id,
    'book_repair_call',
    p_rate_limit_token,
    5,
    15
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_organisation.id::text
        || ':'
        || target_type.id::text
        || ':'
        || p_starts_at::text,
      0
    )
  );

  local_booking_date := (
    p_starts_at at time zone target_organisation.default_timezone
  )::date;

  select slots.ends_at, slots.remaining_capacity
  into target_ends_at, available_remaining
  from public.public_available_appointment_slots(
    p_organisation_slug,
    p_appointment_type_slug,
    local_booking_date,
    1
  ) slots
  where slots.starts_at = p_starts_at
  limit 1;

  if target_ends_at is null or available_remaining is null then
    raise exception 'That appointment slot is no longer available'
      using errcode = '23P01';
  end if;

  select count(*)::integer
  into existing_bookings
  from public.appointments a
  where a.organisation_id = target_organisation.id
    and a.appointment_type_id = target_type.id
    and a.deleted_at is null
    and a.status in ('requested', 'confirmed', 'assigned')
    and a.booking_period && tstzrange(p_starts_at, target_ends_at, '[)');

  slot_capacity := existing_bookings + available_remaining;

  select array_agg(c.id order by c.created_at)
  into matched_customer_ids
  from public.customers c
  where c.organisation_id = target_organisation.id
    and c.deleted_at is null
    and c.anonymised_at is null
    and (
      c.normalised_email = lower(trim(p_email))
      or c.normalised_phone = normalised_customer_phone
    );

  if coalesce(cardinality(matched_customer_ids), 0) > 1 then
    raise exception 'The supplied contact details match different customer records'
      using errcode = '23505';
  elsif coalesce(cardinality(matched_customer_ids), 0) = 1 then
    target_customer_id := matched_customer_ids[1];
    update public.customers
    set
      preferred_contact_method = p_preferred_contact_method,
      privacy_notice_accepted_at = coalesce(privacy_notice_accepted_at, now())
    where id = target_customer_id;
  else
    insert into public.customers (
      organisation_id,
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method,
      privacy_notice_accepted_at,
      marketing_consent,
      marketing_consent_source
    )
    values (
      target_organisation.id,
      trim(p_first_name),
      trim(p_last_name),
      lower(trim(p_email)),
      trim(p_phone),
      p_preferred_contact_method,
      now(),
      false,
      'repair-call booking'
    )
    returning id into target_customer_id;
  end if;

  if nullif(public.normalise_registration(p_registration), '') is not null then
    select cv.id
    into target_customer_vehicle_id
    from public.customer_vehicles cv
    where cv.customer_id = target_customer_id
      and cv.registration_normalised = public.normalise_registration(p_registration)
      and cv.deleted_at is null
    limit 1;

    if target_customer_vehicle_id is null then
      insert into public.customer_vehicles (
        organisation_id,
        customer_id,
        registration,
        make,
        model,
        relationship
      )
      values (
        target_organisation.id,
        target_customer_id,
        public.normalise_registration(p_registration),
        nullif(split_part(trim(p_vehicle_make_model), ' ', 1), ''),
        nullif(
          trim(substr(
            trim(p_vehicle_make_model),
            char_length(split_part(trim(p_vehicle_make_model), ' ', 1)) + 1
          )),
          ''
        ),
        'owned'
      )
      returning id into target_customer_vehicle_id;
    end if;
  end if;

  insert into public.leads (
    organisation_id,
    lead_type,
    status,
    priority,
    customer_id,
    subject,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at,
    last_activity_at,
    metadata
  )
  values (
    target_organisation.id,
    'repair_call',
    'appointment_booked',
    'normal',
    target_customer_id,
    'Repair call: ' || trim(p_reason_for_call),
    trim(p_fault_description),
    'website',
    p_preferred_contact_method,
    true,
    'transactional_only',
    now(),
    now(),
    jsonb_build_object(
      'registration_last_four',
      right(public.normalise_registration(p_registration), 4)
    )
  )
  returning id into target_lead_id;

  for resource_number in 1..least(slot_capacity, 20)
  loop
    if not exists (
      select 1
      from public.appointments a
      where a.organisation_id = target_organisation.id
        and a.appointment_type_id = target_type.id
        and a.booking_resource = resource_number
        and a.deleted_at is null
        and a.status in ('requested', 'confirmed', 'assigned')
        and a.booking_period && tstzrange(p_starts_at, target_ends_at, '[)')
    ) then
      selected_resource := resource_number;
      exit;
    end if;
  end loop;

  if selected_resource is null then
    raise exception 'That appointment slot is no longer available'
      using errcode = '23P01';
  end if;

  begin
    insert into public.appointments (
      organisation_id,
      appointment_type_id,
      customer_id,
      customer_vehicle_id,
      lead_id,
      starts_at,
      ends_at,
      booking_resource,
      status,
      reason_for_call,
      registration,
      vehicle_make_model,
      fault_description,
      warning_lights,
      is_driveable,
      preferred_contact_method
    )
    values (
      target_organisation.id,
      target_type.id,
      target_customer_id,
      target_customer_vehicle_id,
      target_lead_id,
      p_starts_at,
      target_ends_at,
      selected_resource,
      'requested',
      trim(p_reason_for_call),
      nullif(public.normalise_registration(p_registration), ''),
      nullif(trim(p_vehicle_make_model), ''),
      trim(p_fault_description),
      nullif(trim(p_warning_lights), ''),
      p_is_driveable,
      p_preferred_contact_method
    )
    returning id, reference
    into target_appointment_id, target_appointment_reference;
  exception
    when exclusion_violation then
      raise exception 'That appointment slot is no longer available'
        using errcode = '23P01';
  end;

  insert into public.lead_activities (
    organisation_id,
    lead_id,
    activity_type,
    direction,
    summary,
    metadata
  )
  values (
    target_organisation.id,
    target_lead_id,
    'appointment',
    'inbound',
    'Repair-call appointment requested online',
    jsonb_build_object('appointment_id', target_appointment_id)
  );

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  select
    target_organisation.id,
    om.user_id,
    'new_repair_booking',
    'New repair-call booking',
    trim(p_first_name) || ' ' || trim(p_last_name)
      || ' booked '
      || to_char(p_starts_at at time zone target_organisation.default_timezone, 'DD Mon YYYY HH24:MI'),
    '/admin/diary',
    'appointment',
    target_appointment_id
  from public.organisation_members om
  join public.roles r on r.id = om.role_id
  where om.organisation_id = target_organisation.id
    and om.status = 'active'
    and om.deleted_at is null
    and r.code in ('owner', 'manager', 'service_advisor');

  return query
  select
    target_appointment_id,
    target_appointment_reference,
    target_lead_id,
    p_starts_at,
    target_ends_at;
end;
$$;

create or replace function public.match_or_create_public_customer(
  p_organisation_id uuid,
  p_payload jsonb,
  p_consent_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_ids uuid[];
  customer_id uuid;
  customer_name text := nullif(trim(p_payload ->> 'name'), '');
  customer_email text := lower(nullif(trim(p_payload ->> 'email'), ''));
  customer_phone text := nullif(trim(p_payload ->> 'phone'), '');
  customer_phone_normalised text := public.normalise_phone(p_payload ->> 'phone');
  preferred_contact text := coalesce(
    nullif(p_payload ->> 'preferredContact', ''),
    'email'
  );
  marketing_allowed boolean := coalesce(
    (p_payload ->> 'marketingConsent')::boolean,
    false
  );
begin
  if customer_name is null or char_length(customer_name) > 120 then
    raise exception 'A valid customer name is required'
      using errcode = '22023';
  end if;
  if customer_email is null
    or customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid customer email is required'
      using errcode = '22023';
  end if;
  if preferred_contact not in ('email', 'phone', 'sms', 'either') then
    raise exception 'Preferred contact method is invalid'
      using errcode = '22023';
  end if;

  select array_agg(c.id order by c.created_at)
  into customer_ids
  from public.customers c
  where c.organisation_id = p_organisation_id
    and c.deleted_at is null
    and c.anonymised_at is null
    and (
      c.normalised_email = customer_email
      or (
        customer_phone_normalised is not null
        and c.normalised_phone = customer_phone_normalised
      )
    );

  if coalesce(cardinality(customer_ids), 0) > 1 then
    raise exception 'The supplied contact details match different customer records'
      using errcode = '23505';
  elsif coalesce(cardinality(customer_ids), 0) = 1 then
    customer_id := customer_ids[1];
    update public.customers
    set
      preferred_contact_method = preferred_contact,
      privacy_notice_accepted_at = coalesce(
        privacy_notice_accepted_at,
        now()
      ),
      marketing_consent = marketing_consent or marketing_allowed,
      marketing_consent_at = case
        when marketing_allowed then coalesce(marketing_consent_at, now())
        else marketing_consent_at
      end,
      marketing_consent_source = case
        when marketing_allowed then coalesce(
          marketing_consent_source,
          p_consent_source
        )
        else marketing_consent_source
      end
    where id = customer_id;
  else
    insert into public.customers (
      organisation_id,
      full_name,
      email,
      phone,
      preferred_contact_method,
      marketing_consent,
      marketing_consent_at,
      marketing_consent_source,
      privacy_notice_accepted_at,
      consent_at,
      consent_source
    )
    values (
      p_organisation_id,
      customer_name,
      customer_email,
      customer_phone,
      preferred_contact,
      marketing_allowed,
      case when marketing_allowed then now() else null end,
      p_consent_source,
      now(),
      now(),
      p_consent_source
    )
    returning id into customer_id;
  end if;

  return customer_id;
end;
$$;

create or replace function public.submit_public_enquiry(
  p_organisation_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid;
  lead_id uuid;
  vehicle_id uuid;
  lead_kind text := coalesce(p_payload ->> 'enquiryType', 'general_enquiry');
  marketing_allowed boolean := coalesce(
    (p_payload ->> 'marketingConsent')::boolean,
    false
  );
begin
  if not exists (
    select 1 from public.organisations o
    where o.id = p_organisation_id
      and o.status = 'active'
      and o.deleted_at is null
  ) then
    raise exception 'Dealership is unavailable'
      using errcode = '22023';
  end if;
  if nullif(trim(p_payload ->> 'website'), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;
  if not coalesce((p_payload ->> 'consent')::boolean, false) then
    raise exception 'Contact consent is required'
      using errcode = '22023';
  end if;
  if lead_kind not in (
    'vehicle_enquiry',
    'callback_request',
    'test_drive',
    'part_exchange',
    'general_enquiry'
  ) then
    raise exception 'Enquiry type is invalid'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_payload ->> 'message', ''))) not between 1 and 3000 then
    raise exception 'A message is required'
      using errcode = '22023';
  end if;

  perform public.consume_public_rate_limit(
    p_organisation_id,
    'public_enquiry',
    coalesce(
      nullif(p_payload ->> 'rateLimitToken', ''),
      encode(
        digest(
          lower(coalesce(p_payload ->> 'email', ''))
            || ':'
            || coalesce(public.normalise_phone(p_payload ->> 'phone'), '')
            || ':'
            || current_date::text,
          'sha256'
        ),
        'hex'
      )
    ),
    6,
    15
  );

  customer_id := public.match_or_create_public_customer(
    p_organisation_id,
    p_payload,
    'public_website_enquiry'
  );

  vehicle_id := nullif(p_payload ->> 'vehicleId', '')::uuid;
  if vehicle_id is not null and not exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.organisation_id = p_organisation_id
      and v.deleted_at is null
  ) then
    raise exception 'Vehicle does not belong to this dealership'
      using errcode = '23514';
  end if;

  insert into public.leads (
    organisation_id,
    customer_id,
    vehicle_id,
    lead_type,
    status,
    priority,
    title,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at,
    utm_source,
    utm_medium,
    utm_campaign
  )
  values (
    p_organisation_id,
    customer_id,
    vehicle_id,
    lead_kind,
    'new',
    'normal',
    trim(p_payload ->> 'name') || ' — ' || replace(lead_kind, '_', ' '),
    trim(p_payload ->> 'message'),
    coalesce(nullif(p_payload ->> 'source', ''), 'website'),
    coalesce(nullif(p_payload ->> 'preferredContact', ''), 'email'),
    true,
    case
      when marketing_allowed then 'marketing_granted'
      else 'transactional_only'
    end,
    now(),
    nullif(p_payload ->> 'utmSource', ''),
    nullif(p_payload ->> 'utmMedium', ''),
    nullif(p_payload ->> 'utmCampaign', '')
  )
  returning id into lead_id;

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  values (
    p_organisation_id,
    null,
    'new_lead',
    'New website enquiry',
    trim(p_payload ->> 'name') || ' submitted a ' || replace(lead_kind, '_', ' '),
    '/admin/leads',
    'lead',
    lead_id
  );

  return jsonb_build_object(
    'customer_id', customer_id,
    'lead_id', lead_id
  );
end;
$$;

create or replace function public.submit_public_sourcing_request(
  p_organisation_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid;
  request_id uuid;
  lead_id uuid;
  requested_make text := nullif(trim(p_payload ->> 'make'), '');
  requested_model text := nullif(trim(p_payload ->> 'model'), '');
begin
  if not exists (
    select 1 from public.organisations o
    where o.id = p_organisation_id
      and o.status = 'active'
      and o.deleted_at is null
  ) then
    raise exception 'Dealership is unavailable'
      using errcode = '22023';
  end if;
  if nullif(trim(p_payload ->> 'website'), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;
  if not coalesce((p_payload ->> 'consent')::boolean, false)
    or not coalesce((p_payload ->> 'privacyAcknowledged')::boolean, false) then
    raise exception 'Consent and privacy acknowledgement are required'
      using errcode = '22023';
  end if;
  if requested_make is null or requested_model is null then
    raise exception 'Vehicle make and model are required'
      using errcode = '22023';
  end if;

  perform public.consume_public_rate_limit(
    p_organisation_id,
    'public_sourcing',
    coalesce(
      nullif(p_payload ->> 'rateLimitToken', ''),
      encode(
        digest(
          lower(coalesce(p_payload ->> 'email', ''))
            || ':'
            || coalesce(public.normalise_phone(p_payload ->> 'phone'), '')
            || ':'
            || current_date::text,
          'sha256'
        ),
        'hex'
      )
    ),
    4,
    30
  );

  customer_id := public.match_or_create_public_customer(
    p_organisation_id,
    p_payload,
    'public_sourcing_request'
  );

  insert into public.sourcing_requests (
    organisation_id,
    customer_id,
    status,
    priority,
    preferred_make,
    preferred_model,
    alternative_models,
    alternative_vehicles,
    minimum_year,
    maximum_mileage,
    fuel_preference,
    transmission_preference,
    colour_preferences,
    required_features,
    budget,
    deposit_available,
    finance_required,
    part_exchange,
    desired_timescale,
    requirements
  )
  values (
    p_organisation_id,
    customer_id,
    'new',
    'normal',
    requested_make,
    requested_model,
    nullif(p_payload ->> 'alternatives', ''),
    nullif(p_payload ->> 'alternatives', ''),
    nullif(p_payload ->> 'minimumYear', '')::integer,
    nullif(p_payload ->> 'maximumMileage', '')::integer,
    nullif(p_payload ->> 'fuelPreference', ''),
    nullif(p_payload ->> 'transmission', ''),
    nullif(p_payload ->> 'colourPreferences', ''),
    nullif(p_payload ->> 'requiredFeatures', ''),
    (p_payload ->> 'budget')::numeric,
    coalesce(nullif(p_payload ->> 'depositAvailable', '')::numeric, 0),
    coalesce((p_payload ->> 'financeRequired')::boolean, false),
    coalesce((p_payload ->> 'partExchange')::boolean, false),
    nullif(p_payload ->> 'desiredTimescale', ''),
    nullif(p_payload ->> 'requirements', '')
  )
  returning id into request_id;

  insert into public.leads (
    organisation_id,
    customer_id,
    sourcing_request_id,
    lead_type,
    status,
    priority,
    title,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at
  )
  values (
    p_organisation_id,
    customer_id,
    request_id,
    'car_sourcing',
    'new',
    'normal',
    trim(p_payload ->> 'name') || ' — ' || requested_make || ' ' || requested_model,
    nullif(p_payload ->> 'requirements', ''),
    'website',
    coalesce(nullif(p_payload ->> 'preferredContact', ''), 'email'),
    true,
    'transactional_only',
    now()
  )
  returning id into lead_id;

  update public.sourcing_requests
  set lead_id = submit_public_sourcing_request.lead_id
  where id = request_id;

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  values (
    p_organisation_id,
    null,
    'new_sourcing_request',
    'New sourcing request',
    trim(p_payload ->> 'name') || ' is looking for a ' || requested_make || ' ' || requested_model,
    '/admin/sourcing',
    'sourcing_request',
    request_id
  );

  return jsonb_build_object(
    'customer_id', customer_id,
    'sourcing_request_id', request_id,
    'lead_id', lead_id
  );
end;
$$;

create or replace function public.book_repair_call(
  p_organisation_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_email text,
  p_phone text,
  p_preferred_contact text,
  p_reason text,
  p_registration text,
  p_make_model text,
  p_fault_description text,
  p_warning_lights text,
  p_driveable text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organisation_slug text;
  appointment_type_slug text;
  clean_name text := trim(p_name);
  final_space integer;
  first_name text;
  last_name text;
  booked record;
  customer_id uuid;
begin
  select o.slug
  into strict organisation_slug
  from public.organisations o
  where o.id = p_organisation_id
    and o.status = 'active'
    and o.deleted_at is null;

  select at.slug
  into strict appointment_type_slug
  from public.appointment_types at
  where at.organisation_id = p_organisation_id
    and at.category = 'repair_call'
    and at.is_public_bookable = true
    and at.active = true
  order by at.created_at
  limit 1;

  final_space := length(clean_name) - strpos(reverse(clean_name), ' ') + 1;
  if final_space > 0 and final_space < length(clean_name) then
    first_name := trim(substr(clean_name, 1, final_space - 1));
    last_name := trim(substr(clean_name, final_space + 1));
  else
    first_name := clean_name;
    last_name := 'Customer';
  end if;

  select *
  into strict booked
  from public.book_repair_call(
    p_organisation_slug => organisation_slug,
    p_appointment_type_slug => appointment_type_slug,
    p_starts_at => p_starts_at,
    p_first_name => first_name,
    p_last_name => last_name,
    p_email => p_email,
    p_phone => p_phone,
    p_reason_for_call => p_reason,
    p_fault_description => p_fault_description,
    p_registration => p_registration,
    p_vehicle_make_model => p_make_model,
    p_consent => true,
    p_privacy_accepted => true,
    p_rate_limit_token => encode(
      digest(
        lower(trim(p_email))
          || ':'
          || coalesce(public.normalise_phone(p_phone), '')
          || ':'
          || current_date::text,
        'sha256'
      ),
      'hex'
    ),
    p_warning_lights => p_warning_lights,
    p_is_driveable => case p_driveable
      when 'yes' then true
      when 'no' then false
      else null
    end,
    p_preferred_contact_method => p_preferred_contact,
    p_honeypot => ''
  );

  select a.customer_id
  into strict customer_id
  from public.appointments a
  where a.id = booked.appointment_id;

  return jsonb_build_object(
    'appointment_id', booked.appointment_id,
    'lead_id', booked.lead_id,
    'customer_id', customer_id,
    'starts_at', booked.starts_at,
    'ends_at', booked.ends_at
  );
end;
$$;

create or replace function public.update_vehicle_presentation(
  p_vehicle_id uuid,
  p_public_title text,
  p_attention_grabber text,
  p_description text,
  p_standard_equipment text,
  p_optional_equipment text,
  p_finance_example_text text,
  p_warranty_wording text,
  p_video_url text,
  p_featured boolean,
  p_is_public boolean,
  p_slug text,
  p_seo_title text,
  p_seo_description text
)
returns public.vehicle_presentation_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organisation_id uuid;
  result public.vehicle_presentation_records;
begin
  select organisation_id
  into strict target_organisation_id
  from public.vehicles
  where id = p_vehicle_id
    and deleted_at is null;

  if not public.has_org_role(
    target_organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  ) then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  update public.vehicles
  set
    public_title = nullif(trim(p_public_title), ''),
    attention_grabber = nullif(trim(p_attention_grabber), ''),
    description = nullif(trim(p_description), ''),
    standard_equipment = nullif(trim(p_standard_equipment), ''),
    optional_equipment = nullif(trim(p_optional_equipment), ''),
    finance_example_text = nullif(trim(p_finance_example_text), ''),
    warranty_wording = nullif(trim(p_warranty_wording), ''),
    video_url = nullif(trim(p_video_url), ''),
    featured = p_featured,
    is_public = p_is_public,
    slug = nullif(trim(p_slug), ''),
    seo_title = nullif(trim(p_seo_title), ''),
    seo_description = nullif(trim(p_seo_description), ''),
    published_at = case
      when p_is_public and published_at is null then now()
      when not p_is_public then null
      else published_at
    end
  where id = p_vehicle_id;

  select *
  into strict result
  from public.vehicle_presentation_records
  where id = p_vehicle_id;

  return result;
end;
$$;

create or replace function public.update_assigned_repair_job(
  p_repair_job_id uuid,
  p_status text,
  p_diagnosis text,
  p_technician_notes text,
  p_work_completed text
)
returns public.technician_repair_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.repair_jobs%rowtype;
  result public.technician_repair_jobs;
begin
  select *
  into strict target_job
  from public.repair_jobs
  where id = p_repair_job_id
    and deleted_at is null;

  if not (
    public.has_org_role(
      target_job.organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
    or (
      target_job.assigned_technician_id = auth.uid()
      and public.has_org_role(
        target_job.organisation_id,
        array['technician']
      )
    )
  ) then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  if p_status not in (
    'awaiting_inspection',
    'diagnosing',
    'estimate_preparing',
    'approved',
    'parts_ordered',
    'parts_received',
    'work_in_progress',
    'quality_check',
    'ready_for_collection'
  ) then
    raise exception 'Technicians cannot set that repair status'
      using errcode = '22023';
  end if;

  update public.repair_jobs
  set
    status = p_status,
    diagnosis = nullif(trim(p_diagnosis), ''),
    technician_notes = nullif(trim(p_technician_notes), ''),
    work_completed = nullif(trim(p_work_completed), '')
  where id = p_repair_job_id;

  select *
  into strict result
  from public.technician_repair_jobs
  where id = p_repair_job_id;

  return result;
end;
$$;

create or replace function public.storage_object_org_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  if first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return first_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vehicle-public',
    'vehicle-public',
    true,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'branding-public',
    'branding-public',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'repair-uploads',
    'repair-uploads',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_public_media_read
on storage.objects for select
to anon, authenticated
using (bucket_id in ('vehicle-public', 'branding-public'));

create policy storage_public_media_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_public_media_update
on storage.objects for update
to authenticated
using (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
)
with check (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_public_media_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_private_read
on storage.objects for select
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_write
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_update
on storage.objects for update
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads',
    'lead_activities',
    'sourcing_requests',
    'sourcing_candidates',
    'appointment_types',
    'availability_rules',
    'availability_exceptions',
    'appointments',
    'repair_services',
    'repair_jobs',
    'repair_job_items',
    'sales',
    'tasks',
    'task_comments',
    'documents',
    'notifications',
    'website_pages',
    'integration_settings',
    'webhook_events',
    'audit_logs'
  ]
  loop
    execute format('revoke all on public.%I from anon', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
  end loop;
end;
$$;

revoke all on public.public_vehicle_inventory from public;
revoke all on public.public_appointment_types from public;
revoke all on public.vehicle_presentation_records from public;
revoke all on public.technician_repair_jobs from public;
grant select on public.public_vehicle_inventory to anon, authenticated;
grant select on public.public_appointment_types to anon, authenticated;
grant select on public.vehicle_presentation_records to authenticated;
grant select on public.technician_repair_jobs to authenticated;

revoke all on function public.consume_public_rate_limit(uuid, text, text, integer, integer) from public;
revoke all on function public.assert_same_organisation() from public;
revoke all on function public.audit_row_change() from public;
revoke all on function public.match_or_create_public_customer(uuid, jsonb, text) from public;
revoke all on function public.submit_public_enquiry(uuid, jsonb) from public;
revoke all on function public.submit_public_sourcing_request(uuid, jsonb) from public;
revoke all on function public.public_available_appointment_slots(text, text, date, integer) from public;
revoke all on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) from public;
revoke all on function public.book_repair_call(
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.update_vehicle_presentation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  text
) from public;
revoke all on function public.update_assigned_repair_job(
  uuid,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.storage_object_org_id(text) from public;

grant execute on function public.public_available_appointment_slots(text, text, date, integer)
  to anon, authenticated;
grant execute on function public.submit_public_enquiry(uuid, jsonb)
  to service_role;
grant execute on function public.submit_public_sourcing_request(uuid, jsonb)
  to service_role;
grant execute on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) to anon, authenticated;
grant execute on function public.book_repair_call(
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
grant execute on function public.update_vehicle_presentation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  text
) to authenticated;
grant execute on function public.update_assigned_repair_job(
  uuid,
  text,
  text,
  text,
  text
) to authenticated;

commit;

-- ===== 202607160005_transactional_admin_workflows.sql =====

begin;

drop policy if exists storage_public_media_insert on storage.objects;
drop policy if exists storage_public_media_update on storage.objects;
drop policy if exists storage_public_media_delete on storage.objects;
drop policy if exists storage_private_write on storage.objects;
drop policy if exists storage_private_update on storage.objects;
drop policy if exists storage_private_delete on storage.objects;

drop policy if exists sourcing_write_assigned_sales
  on public.sourcing_requests;
drop policy if exists sourcing_candidates_write_request
  on public.sourcing_candidates;
drop policy if exists sourcing_candidates_write_management
  on public.sourcing_candidates;
create policy sourcing_candidates_write_management
on public.sourcing_candidates for all to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
)
with check (
  public.has_org_role(organisation_id, array['owner', 'manager'])
);

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'branding-public';

alter table public.sourcing_requests
  add column if not exists expected_margin numeric(12,2)
    check (expected_margin between -1000000 and 1000000);

revoke execute on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) from anon, authenticated;
grant execute on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) to service_role;

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email citext not null,
  role text not null
    check (
      role in (
        'manager',
        'salesperson',
        'service_advisor',
        'technician',
        'website_editor'
      )
    ),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email),
  check (expires_at > created_at)
);

create index team_invitations_pending_idx
  on public.team_invitations (organisation_id, expires_at)
  where accepted_at is null;

create trigger team_invitations_touch_updated_at
before update on public.team_invitations
for each row execute function public.touch_updated_at();

alter table public.team_invitations enable row level security;

create policy team_invitations_owner_read
on public.team_invitations for select
to authenticated
using (public.has_org_role(organisation_id, array['owner']));

create policy team_invitations_owner_write
on public.team_invitations for all
to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

revoke all on public.team_invitations from anon;
grant select, insert, update, delete on public.team_invitations to authenticated;
grant all on public.team_invitations to service_role;

create table public.sourcing_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sourcing_request_id uuid not null
    references public.sourcing_requests(id) on delete cascade,
  activity_type text not null default 'note'
    check (
      activity_type in (
        'note',
        'status_change',
        'assignment',
        'candidate_added',
        'candidate_sent',
        'customer_decision',
        'task',
        'system'
      )
    ),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index sourcing_activities_request_idx
  on public.sourcing_activities (sourcing_request_id, created_at desc);

create or replace function public.check_sourcing_activity_organisation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = new.sourcing_request_id
      and sr.organisation_id = new.organisation_id
  ) then
    raise exception 'Sourcing activity organisation mismatch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger sourcing_activities_check_organisation
before insert or update on public.sourcing_activities
for each row execute function public.check_sourcing_activity_organisation();

alter table public.sourcing_activities enable row level security;

create policy sourcing_activities_operational_read
on public.sourcing_activities for select
to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy sourcing_activities_operational_write
on public.sourcing_activities for insert
to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

revoke all on public.sourcing_activities from anon;
grant select, insert on public.sourcing_activities to authenticated;
grant all on public.sourcing_activities to service_role;

create or replace function public.accept_team_invitation(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  invitation public.team_invitations%rowtype;
  invited_role_id uuid;
  invited_email text;
  user_metadata jsonb;
  user_confirmed_at timestamptz;
begin
  select
    u.email,
    u.raw_user_meta_data,
    u.email_confirmed_at
  into strict
    invited_email,
    user_metadata,
    user_confirmed_at
  from auth.users u
  where u.id = p_user_id;

  if user_confirmed_at is null then
    raise exception 'Invitation email has not been confirmed'
      using errcode = '42501';
  end if;

  begin
    invitation_id := nullif(
      user_metadata ->> 'invitation_id',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      invitation_id := null;
  end;

  if invitation_id is null then
    raise exception 'Invitation metadata is missing'
      using errcode = '22023';
  end if;

  select *
  into strict invitation
  from public.team_invitations ti
  where ti.id = invitation_id
    and ti.accepted_at is null
    and ti.expires_at > now()
    and lower(ti.email::text) = lower(invited_email)
  for update;

  select r.id
  into strict invited_role_id
  from public.roles r
  where r.code = invitation.role;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role_id,
    role,
    status,
    invited_email,
    invited_at,
    joined_at,
    created_by
  )
  values (
    invitation.organisation_id,
    p_user_id,
    invited_role_id,
    invitation.role,
    'active',
    invitation.email,
    invitation.created_at,
    now(),
    invitation.invited_by
  )
  on conflict (organisation_id, user_id) do update
  set
    role_id = excluded.role_id,
    role = excluded.role,
    status = 'active',
    joined_at = now(),
    deleted_at = null;

  update public.team_invitations
  set
    accepted_at = now(),
    accepted_by = p_user_id
  where id = invitation.id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    invitation.organisation_id,
    p_user_id,
    'organisation_members',
    p_user_id,
    'team.invitation_accepted',
    'organisation_member',
    p_user_id,
    jsonb_build_object('role', invitation.role),
    'database'
  );

  return jsonb_build_object(
    'organisation_id', invitation.organisation_id,
    'user_id', p_user_id,
    'role', invitation.role
  );
end;
$$;

create or replace function public.merge_customers(
  p_organisation_id uuid,
  p_source_customer_id uuid,
  p_target_customer_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_customer jsonb;
  target_customer jsonb;
  source_vehicle record;
  target_vehicle_id uuid;
begin
  if p_source_customer_id = p_target_customer_id then
    raise exception 'Source and target customer must be different'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Customer merge is not permitted'
      using errcode = '42501';
  end if;

  select to_jsonb(c)
  into strict source_customer
  from public.customers c
  where c.id = p_source_customer_id
    and c.organisation_id = p_organisation_id
    and c.deleted_at is null
  for update;

  select to_jsonb(c)
  into strict target_customer
  from public.customers c
  where c.id = p_target_customer_id
    and c.organisation_id = p_organisation_id
    and c.deleted_at is null
  for update;

  for source_vehicle in
    select cv.*
    from public.customer_vehicles cv
    where cv.organisation_id = p_organisation_id
      and cv.customer_id = p_source_customer_id
      and cv.deleted_at is null
    for update
  loop
    target_vehicle_id := null;
    if source_vehicle.registration_normalised is not null then
      select cv.id
      into target_vehicle_id
      from public.customer_vehicles cv
      where cv.organisation_id = p_organisation_id
        and cv.customer_id = p_target_customer_id
        and cv.registration_normalised = source_vehicle.registration_normalised
        and cv.deleted_at is null
      limit 1;
    end if;

    if target_vehicle_id is not null then
      update public.appointments
      set customer_vehicle_id = target_vehicle_id
      where organisation_id = p_organisation_id
        and customer_vehicle_id = source_vehicle.id;

      update public.repair_jobs
      set customer_vehicle_id = target_vehicle_id
      where organisation_id = p_organisation_id
        and customer_vehicle_id = source_vehicle.id;

      update public.customer_vehicles
      set deleted_at = now()
      where id = source_vehicle.id;
    else
      update public.customer_vehicles
      set customer_id = p_target_customer_id
      where id = source_vehicle.id;
    end if;
  end loop;

  update public.leads
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.sourcing_requests
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.appointments
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.repair_jobs
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.sales
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.tasks
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.documents
  set
    customer_id = case
      when customer_id = p_source_customer_id then p_target_customer_id
      else customer_id
    end,
    entity_id = case
      when entity_type = 'customer' and entity_id = p_source_customer_id
        then p_target_customer_id
      else entity_id
    end
  where organisation_id = p_organisation_id
    and (
      customer_id = p_source_customer_id
      or (entity_type = 'customer' and entity_id = p_source_customer_id)
    );

  update public.customers
  set
    merged_into_customer_id = p_target_customer_id,
    marketing_consent = false,
    do_not_contact = true,
    deleted_at = now()
  where id = p_source_customer_id
    and organisation_id = p_organisation_id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'customers',
    p_source_customer_id,
    'customer.merged',
    'customer',
    p_target_customer_id,
    jsonb_build_object(
      'source', source_customer,
      'target', target_customer
    ),
    jsonb_build_object(
      'source_customer_id', p_source_customer_id,
      'target_customer_id', p_target_customer_id
    ),
    'application'
  );

  return jsonb_build_object(
    'source_customer_id', p_source_customer_id,
    'target_customer_id', p_target_customer_id,
    'merged', true
  );
end;
$$;

create or replace function public.record_vehicle_sale(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_customer_id uuid,
  p_salesperson_id uuid,
  p_sale_price numeric,
  p_deposit numeric,
  p_part_exchange_allowance numeric,
  p_discount numeric,
  p_warranty text,
  p_payment_method text,
  p_sale_date date,
  p_handover_date date,
  p_internal_notes text,
  p_additional_products text[],
  p_completion_checklist jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle public.vehicles%rowtype;
  sale_id uuid;
  realised_gross numeric(12,2);
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Recording a completed sale is not permitted'
      using errcode = '42501';
  end if;

  if p_sale_price <= 0
    or p_deposit < 0
    or p_part_exchange_allowance < 0
    or p_discount < 0
    or p_deposit > p_sale_price then
    raise exception 'Sale amounts are invalid'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_completion_checklist, '[]'::jsonb)) <> 'array' then
    raise exception 'Completion checklist must be a JSON array'
      using errcode = '22023';
  end if;

  select *
  into strict vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;

  if vehicle.status in ('sold', 'returned', 'archived') then
    raise exception 'Vehicle is already closed or sold'
      using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.organisation_id = p_organisation_id
      and c.deleted_at is null
  ) then
    raise exception 'Customer does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_salesperson_id is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_salesperson_id
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Salesperson does not belong to this dealership'
      using errcode = '23514';
  end if;

  realised_gross := p_sale_price
    - coalesce(vehicle.purchase_price, 0)
    - coalesce(vehicle.preparation_costs, 0)
    - coalesce(vehicle.repair_costs, 0)
    - coalesce(vehicle.other_costs, 0);

  insert into public.sales (
    organisation_id,
    vehicle_id,
    customer_id,
    salesperson_id,
    status,
    sale_price,
    deposit,
    part_exchange_allowance,
    discount,
    warranty,
    additional_products,
    payment_method,
    sale_date,
    handover_date,
    gross_profit,
    internal_notes,
    completion_checklist,
    completed_at,
    created_by
  )
  values (
    p_organisation_id,
    p_vehicle_id,
    p_customer_id,
    p_salesperson_id,
    'completed',
    p_sale_price,
    p_deposit,
    p_part_exchange_allowance,
    p_discount,
    nullif(trim(p_warranty), ''),
    to_jsonb(coalesce(p_additional_products, array[]::text[])),
    p_payment_method,
    p_sale_date,
    p_handover_date,
    realised_gross,
    nullif(trim(p_internal_notes), ''),
    coalesce(p_completion_checklist, '[]'::jsonb),
    now(),
    p_actor_user_id
  )
  returning id into sale_id;

  update public.vehicles
  set
    status = 'sold',
    actual_sale_price = p_sale_price,
    sold_at = p_sale_date,
    updated_by = p_actor_user_id
  where id = p_vehicle_id;

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  values (
    p_organisation_id,
    null,
    'vehicle_sold',
    'Vehicle sold',
    vehicle.make || ' ' || vehicle.model || ' has been recorded as sold.',
    '/admin/sales',
    'sale',
    sale_id
  );

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'sales',
    sale_id,
    'sale.completed',
    'sale',
    sale_id,
    jsonb_build_object(
      'vehicle_status', vehicle.status,
      'vehicle_actual_sale_price', vehicle.actual_sale_price
    ),
    jsonb_build_object(
      'vehicle_id', p_vehicle_id,
      'customer_id', p_customer_id,
      'sale_price', p_sale_price,
      'gross_profit', realised_gross
    ),
    'application'
  );

  return jsonb_build_object(
    'sale_id', sale_id,
    'vehicle_id', p_vehicle_id,
    'gross_profit', realised_gross,
    'status', 'completed'
  );
end;
$$;

create or replace function public.reorder_vehicle_images(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_image_ids uuid[],
  p_cover_image_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_id uuid;
  image_position integer := 0;
  active_count integer;
  distinct_count integer;
  old_order jsonb;
  new_order jsonb;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Image reordering is not permitted'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_image_ids), 0) = 0 then
    raise exception 'At least one image is required'
      using errcode = '22023';
  end if;

  perform vi.id
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null
  for update;

  select count(*)
  into active_count
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  select count(distinct candidate)
  into distinct_count
  from unnest(p_image_ids) as candidate;

  if active_count <> cardinality(p_image_ids)
    or distinct_count <> cardinality(p_image_ids)
    or exists (
      select 1
      from unnest(p_image_ids) as candidate
      where not exists (
        select 1
        from public.vehicle_images vi
        where vi.id = candidate
          and vi.organisation_id = p_organisation_id
          and vi.vehicle_id = p_vehicle_id
          and vi.deleted_at is null
      )
    ) then
    raise exception 'Image order must contain every active vehicle image exactly once'
      using errcode = '23514';
  end if;

  if not p_cover_image_id = any(p_image_ids) then
    raise exception 'Cover image must be part of the image order'
      using errcode = '23514';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', vi.id,
      'sort_order', vi.sort_order,
      'is_cover', vi.is_cover
    )
    order by vi.sort_order
  )
  into old_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  update public.vehicle_images
  set
    is_cover = false,
    sort_order = sort_order + 1000000
  where organisation_id = p_organisation_id
    and vehicle_id = p_vehicle_id
    and deleted_at is null;

  foreach image_id in array p_image_ids
  loop
    update public.vehicle_images
    set
      sort_order = image_position,
      is_cover = image_id = p_cover_image_id,
      updated_at = now()
    where id = image_id
      and organisation_id = p_organisation_id
      and vehicle_id = p_vehicle_id
      and deleted_at is null;
    image_position := image_position + 1;
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'id', vi.id,
      'sort_order', vi.sort_order,
      'is_cover', vi.is_cover
    )
    order by vi.sort_order
  )
  into new_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicle_images',
    p_vehicle_id,
    'vehicle_images.reordered',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('images', old_order),
    jsonb_build_object('images', new_order),
    'application'
  );

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'images', new_order
  );
end;
$$;

create or replace function public.replace_availability_rules(
  p_organisation_id uuid,
  p_appointment_type_id uuid,
  p_rules jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'service_advisor')
  ) then
    raise exception 'Availability settings are not permitted'
      using errcode = '42501';
  end if;

  perform at.id
  from public.appointment_types at
  where at.id = p_appointment_type_id
    and at.organisation_id = p_organisation_id
    and at.active = true
  for update;
  if not found then
    raise exception 'Appointment type does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_rules is null or jsonb_typeof(p_rules) is distinct from 'array' then
    raise exception 'Availability rules must be a non-empty array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rules) not between 1 and 14 then
    raise exception 'Availability rules must be a non-empty array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rules) as rule
    where (rule ->> 'weekday')::integer not between 0 and 6
      or (rule ->> 'start_time_local')::time
        >= (rule ->> 'end_time_local')::time
      or (rule ->> 'slot_duration_minutes')::integer not between 5 and 480
      or (rule ->> 'buffer_minutes')::integer not between 0 and 240
      or (rule ->> 'minimum_notice_minutes')::integer not between 0 and 10080
      or (rule ->> 'maximum_advance_days')::integer not between 1 and 365
      or (rule ->> 'maximum_simultaneous')::integer not between 1 and 20
  ) then
    raise exception 'One or more availability rules are invalid'
      using errcode = '22023';
  end if;

  delete from public.availability_rules ar
  where ar.organisation_id = p_organisation_id
    and ar.appointment_type_id = p_appointment_type_id
    and ar.staff_user_id is null;

  insert into public.availability_rules (
    organisation_id,
    appointment_type_id,
    staff_user_id,
    weekday,
    start_time_local,
    end_time_local,
    slot_duration_minutes,
    buffer_minutes,
    minimum_notice_minutes,
    maximum_advance_days,
    maximum_simultaneous,
    timezone,
    appointment_type,
    active,
    created_by
  )
  select
    p_organisation_id,
    p_appointment_type_id,
    null,
    (rule ->> 'weekday')::smallint,
    (rule ->> 'start_time_local')::time,
    (rule ->> 'end_time_local')::time,
    (rule ->> 'slot_duration_minutes')::integer,
    (rule ->> 'buffer_minutes')::integer,
    (rule ->> 'minimum_notice_minutes')::integer,
    (rule ->> 'maximum_advance_days')::integer,
    (rule ->> 'maximum_simultaneous')::integer,
    coalesce(nullif(rule ->> 'timezone', ''), 'Europe/London'),
    coalesce(nullif(rule ->> 'appointment_type', ''), 'repair_call'),
    coalesce((rule ->> 'active')::boolean, true),
    p_actor_user_id
  from jsonb_array_elements(p_rules) as rule;

  get diagnostics inserted_count = row_count;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'availability_rules',
    p_appointment_type_id,
    'availability_rules.replaced',
    'appointment_type',
    p_appointment_type_id,
    jsonb_build_object('rule_count', inserted_count),
    'application'
  );

  return jsonb_build_object(
    'appointment_type_id', p_appointment_type_id,
    'rule_count', inserted_count
  );
end;
$$;

create or replace function public.publish_homepage(
  p_organisation_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_record public.website_pages%rowtype;
  hero jsonb;
  published_at_value timestamptz := now();
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'website_editor')
  ) then
    raise exception 'Homepage publishing is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict page_record
  from public.website_pages wp
  where wp.organisation_id = p_organisation_id
    and wp.slug = 'home'
    and wp.deleted_at is null
  for update;

  if page_record.requires_legal_review then
    raise exception 'Legal review must be completed before publishing'
      using errcode = '42501';
  end if;

  hero := page_record.content -> 'hero';
  if jsonb_typeof(hero) is distinct from 'object'
    or nullif(trim(hero ->> 'eyebrow'), '') is null
    or nullif(trim(hero ->> 'heading'), '') is null
    or nullif(trim(hero ->> 'body'), '') is null then
    raise exception 'Homepage draft is incomplete'
      using errcode = '22023';
  end if;

  update public.dealership_settings
  set homepage_wording =
    coalesce(homepage_wording, '{}'::jsonb) ||
    jsonb_build_object(
      'eyebrow', hero ->> 'eyebrow',
      'headline', hero ->> 'heading',
      'title', hero ->> 'heading',
      'summary', hero ->> 'body',
      'body', hero ->> 'body',
      'primaryLabel', hero ->> 'primaryLabel',
      'primaryHref', hero ->> 'primaryHref',
      'imageAlt', hero ->> 'imageAlt',
      'seoTitle', page_record.seo_title,
      'seoDescription', page_record.seo_description
    )
  where organisation_id = p_organisation_id;

  if not found then
    raise exception 'Dealership settings are missing'
      using errcode = 'P0002';
  end if;

  update public.website_pages
  set
    status = 'published',
    published_at = published_at_value,
    published_by = p_actor_user_id
  where id = page_record.id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'website_pages',
    page_record.id,
    'website.homepage_published',
    'website_page',
    page_record.id,
    jsonb_build_object(
      'status', page_record.status,
      'published_at', page_record.published_at
    ),
    jsonb_build_object(
      'status', 'published',
      'published_at', published_at_value
    ),
    'application'
  );

  return jsonb_build_object(
    'page_id', page_record.id,
    'status', 'published',
    'published_at', published_at_value
  );
end;
$$;

create or replace function public.update_sourcing_request(
  p_organisation_id uuid,
  p_sourcing_request_id uuid,
  p_changes jsonb,
  p_note text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.sourcing_requests%rowtype;
  updated_record public.sourcing_requests%rowtype;
  next_status text;
  next_priority text;
  next_assignee uuid;
  next_sourcing_fee numeric;
  next_expected_margin numeric;
  activity_type_value text := 'system';
  activity_body text;
begin
  if jsonb_typeof(coalesce(p_changes, '{}'::jsonb)) <> 'object' then
    raise exception 'Sourcing changes must be a JSON object'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Sourcing updates are not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict request_record
  from public.sourcing_requests sr
  where sr.id = p_sourcing_request_id
    and sr.organisation_id = p_organisation_id
    and sr.deleted_at is null
  for update;

  next_status := case
    when p_changes ? 'status' then p_changes ->> 'status'
    else request_record.status
  end;
  if next_status not in (
    'new',
    'contact_attempted',
    'requirements_confirmed',
    'search_active',
    'options_found',
    'option_sent_to_customer',
    'inspection_required',
    'negotiation',
    'deposit_requested',
    'vehicle_secured',
    'preparing_vehicle',
    'completed',
    'paused',
    'lost'
  ) then
    raise exception 'Invalid sourcing status'
      using errcode = '22023';
  end if;

  next_priority := case
    when p_changes ? 'priority' then p_changes ->> 'priority'
    else request_record.priority
  end;
  if next_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid sourcing priority'
      using errcode = '22023';
  end if;

  if p_changes ? 'assignedUserId' then
    begin
      next_assignee := nullif(p_changes ->> 'assignedUserId', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Invalid sourcing assignee'
          using errcode = '22023';
    end;
  else
    next_assignee := request_record.assigned_user_id;
  end if;

  if next_assignee is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = next_assignee
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Sourcing assignee does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_changes ? 'sourcingFee' then
    begin
      next_sourcing_fee := (p_changes ->> 'sourcingFee')::numeric;
    exception
      when invalid_text_representation then
        raise exception 'Invalid sourcing fee'
          using errcode = '22023';
    end;
    if next_sourcing_fee < 0 then
      raise exception 'Sourcing fee cannot be negative'
        using errcode = '22023';
    end if;
  else
    next_sourcing_fee := request_record.sourcing_fee;
  end if;

  if p_changes ? 'expectedMargin' then
    begin
      next_expected_margin := (p_changes ->> 'expectedMargin')::numeric;
    exception
      when invalid_text_representation then
        raise exception 'Invalid expected margin'
          using errcode = '22023';
    end;
    if next_expected_margin < -1000000 or next_expected_margin > 1000000 then
      raise exception 'Expected margin is outside the permitted range'
        using errcode = '22023';
    end if;
  else
    next_expected_margin := request_record.expected_margin;
  end if;

  update public.sourcing_requests
  set
    status = next_status,
    assigned_user_id = next_assignee,
    priority = next_priority,
    sourcing_fee = next_sourcing_fee,
    expected_margin = next_expected_margin,
    closed_at = case
      when next_status in ('completed', 'lost') then coalesce(closed_at, now())
      when next_status not in ('completed', 'lost') then null
      else closed_at
    end
  where id = request_record.id
  returning * into updated_record;

  if nullif(trim(coalesce(p_note, '')), '') is not null then
    activity_type_value := 'note';
    activity_body := trim(p_note);
  elsif p_changes ? 'status' then
    activity_type_value := 'status_change';
    activity_body := 'Status changed to ' || replace(next_status, '_', ' ') || '.';
  elsif p_changes ? 'assignedUserId' then
    activity_type_value := 'assignment';
    activity_body := case
      when next_assignee is null then 'Sourcing request unassigned.'
      else 'Sourcing request assigned.'
    end;
  else
    activity_body := 'Sourcing request details updated.';
  end if;

  insert into public.sourcing_activities (
    organisation_id,
    sourcing_request_id,
    activity_type,
    body,
    metadata,
    created_by
  )
  values (
    p_organisation_id,
    p_sourcing_request_id,
    activity_type_value,
    activity_body,
    coalesce(p_changes, '{}'::jsonb),
    p_actor_user_id
  );

  return jsonb_build_object(
    'id', updated_record.id,
    'status', updated_record.status,
    'assigned_user_id', updated_record.assigned_user_id,
    'priority', updated_record.priority,
    'sourcing_fee', updated_record.sourcing_fee,
    'expected_margin', updated_record.expected_margin
  );
end;
$$;

create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bucket_id, object_path)
);

create trigger storage_cleanup_jobs_touch_updated_at
before update on public.storage_cleanup_jobs
for each row execute function public.touch_updated_at();

alter table public.storage_cleanup_jobs enable row level security;

create policy storage_cleanup_jobs_owner_read
on public.storage_cleanup_jobs for select
to authenticated
using (public.has_org_role(organisation_id, array['owner']));

revoke all on public.storage_cleanup_jobs from anon, authenticated;
grant select on public.storage_cleanup_jobs to authenticated;
grant all on public.storage_cleanup_jobs to service_role;

create or replace function public.attach_vehicle_image(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_alt_text text,
  p_caption text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_sort_order integer;
  image_id uuid;
  cover_value boolean;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Vehicle image upload is not permitted'
      using errcode = '42501';
  end if;

  perform v.id
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;
  if not found then
    raise exception 'Vehicle was not found'
      using errcode = 'P0002';
  end if;

  select coalesce(max(vi.sort_order), -1) + 1
  into next_sort_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  cover_value := not exists (
    select 1
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = p_vehicle_id
      and vi.deleted_at is null
      and vi.is_cover = true
  );

  insert into public.vehicle_images (
    organisation_id,
    vehicle_id,
    storage_bucket,
    storage_path,
    mime_type,
    byte_size,
    sort_order,
    is_cover,
    alt_text,
    caption,
    created_by
  )
  values (
    p_organisation_id,
    p_vehicle_id,
    p_storage_bucket,
    p_storage_path,
    p_mime_type,
    p_byte_size,
    next_sort_order,
    cover_value,
    nullif(trim(p_alt_text), ''),
    nullif(trim(p_caption), ''),
    p_actor_user_id
  )
  returning id into image_id;

  return jsonb_build_object(
    'id', image_id,
    'storage_path', p_storage_path,
    'sort_order', next_sort_order,
    'is_cover', cover_value,
    'alt_text', nullif(trim(p_alt_text), ''),
    'caption', nullif(trim(p_caption), '')
  );
end;
$$;

create or replace function public.soft_delete_vehicle_image(
  p_organisation_id uuid,
  p_image_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_record public.vehicle_images%rowtype;
  next_cover_id uuid;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Vehicle image deletion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.deleted_at is null
  for update;

  perform v.id
  from public.vehicles v
  where v.id = image_record.vehicle_id
    and v.organisation_id = p_organisation_id
  for update;

  update public.vehicle_images
  set
    deleted_at = now(),
    is_cover = false
  where id = image_record.id;

  if image_record.is_cover then
    select vi.id
    into next_cover_id
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = image_record.vehicle_id
      and vi.deleted_at is null
    order by vi.sort_order
    limit 1
    for update;

    if next_cover_id is not null then
      update public.vehicle_images
      set is_cover = true
      where id = next_cover_id;
    end if;
  end if;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicle_images',
    image_record.id,
    'vehicle_image.deleted',
    'vehicle',
    image_record.vehicle_id,
    jsonb_build_object(
      'storage_bucket', image_record.storage_bucket,
      'storage_path', image_record.storage_path,
      'is_cover', image_record.is_cover
    ),
    jsonb_build_object('next_cover_id', next_cover_id),
    'application'
  );

  return jsonb_build_object(
    'image_id', image_record.id,
    'vehicle_id', image_record.vehicle_id,
    'storage_bucket', image_record.storage_bucket,
    'storage_path', image_record.storage_path,
    'next_cover_id', next_cover_id
  );
end;
$$;

-- An Auto Trader advertiser and stock record must resolve to one tenant and
-- one vehicle. These constraints make webhook routing deterministic even if
-- integration configuration is edited outside DealerOS.
create unique index if not exists integration_settings_autotrader_advertiser_id_unique
  on public.integration_settings (
    (btrim(public_configuration ->> 'advertiser_id'))
  )
  where provider = 'autotrader'
    and nullif(btrim(public_configuration ->> 'advertiser_id'), '') is not null;

create unique index if not exists vehicles_org_autotrader_stock_id_unique
  on public.vehicles (organisation_id, autotrader_stock_id)
  where autotrader_stock_id is not null
    and deleted_at is null;

-- Keep the array stored on the public-safe vehicle as a resilient source of
-- presentation features when no normalised vehicle_features rows exist.
create or replace view public.public_vehicle_inventory
with (security_barrier = true)
as
select
  safe_vehicle.*,
  vehicle.features
from public.public_safe_vehicles safe_vehicle
join public.vehicles vehicle
  on vehicle.id = safe_vehicle.id
  and vehicle.organisation_id = safe_vehicle.organisation_id;

revoke all on public.public_vehicle_inventory from public;
grant select on public.public_vehicle_inventory to anon, authenticated;

revoke all on function public.merge_customers(uuid, uuid, uuid, uuid) from public;
revoke all on function public.accept_team_invitation(uuid) from public;
revoke all on function public.publish_homepage(uuid, uuid) from public;
revoke all on function public.update_sourcing_request(
  uuid,
  uuid,
  jsonb,
  text,
  uuid
) from public;
revoke all on function public.attach_vehicle_image(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) from public;
revoke all on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  from public;
revoke all on function public.record_vehicle_sale(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  date,
  date,
  text,
  text[],
  jsonb,
  uuid
) from public;
revoke all on function public.reorder_vehicle_images(
  uuid,
  uuid,
  uuid[],
  uuid,
  uuid
) from public;
revoke all on function public.replace_availability_rules(
  uuid,
  uuid,
  jsonb,
  uuid
) from public;

grant execute on function public.merge_customers(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.accept_team_invitation(uuid)
  to service_role;
grant execute on function public.publish_homepage(uuid, uuid)
  to service_role;
grant execute on function public.update_sourcing_request(
  uuid,
  uuid,
  jsonb,
  text,
  uuid
) to service_role;
grant execute on function public.attach_vehicle_image(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) to service_role;
grant execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  to service_role;
grant execute on function public.record_vehicle_sale(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  date,
  date,
  text,
  text[],
  jsonb,
  uuid
) to service_role;
grant execute on function public.reorder_vehicle_images(
  uuid,
  uuid,
  uuid[],
  uuid,
  uuid
) to service_role;
grant execute on function public.replace_availability_rules(
  uuid,
  uuid,
  jsonb,
  uuid
) to service_role;

commit;

-- ===== 202607160006_transactional_integrity.sql =====

begin;

create or replace function public.can_access_customer(
  target_organisation_id uuid,
  target_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers target
    where target.id = target_customer_id
      and target.organisation_id = target_organisation_id
      and target.deleted_at is null
  )
  and exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = target_organisation_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.deleted_at is null
      and (
        om.role in ('owner', 'manager', 'service_advisor')
        or (
          om.role = 'salesperson'
          and (
            exists (
              select 1
              from public.customers c
              where c.id = target_customer_id
                and c.organisation_id = target_organisation_id
                and c.created_by = (select auth.uid())
                and c.deleted_at is null
            )
            or exists (
              select 1
              from public.leads l
              where l.customer_id = target_customer_id
                and l.organisation_id = target_organisation_id
                and l.assigned_user_id = (select auth.uid())
                and l.deleted_at is null
            )
            or exists (
              select 1
              from public.sourcing_requests sr
              where sr.customer_id = target_customer_id
                and sr.organisation_id = target_organisation_id
                and sr.assigned_user_id = (select auth.uid())
                and sr.deleted_at is null
            )
            or exists (
              select 1
              from public.appointments a
              where a.customer_id = target_customer_id
                and a.organisation_id = target_organisation_id
                and a.assigned_user_id = (select auth.uid())
                and a.deleted_at is null
            )
            or exists (
              select 1
              from public.sales s
              where s.customer_id = target_customer_id
                and s.organisation_id = target_organisation_id
                and s.salesperson_id = (select auth.uid())
                and s.deleted_at is null
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_access_customer(uuid, uuid) from public;
grant execute on function public.can_access_customer(uuid, uuid)
  to authenticated, service_role;

drop policy if exists customers_read_operational on public.customers;
drop policy if exists customers_write_operational on public.customers;
drop policy if exists customers_update_operational on public.customers;
drop policy if exists customer_vehicles_read_operational
  on public.customer_vehicles;
drop policy if exists customer_vehicles_write_operational
  on public.customer_vehicles;

create policy customers_read_scoped
on public.customers for select
to authenticated
using (public.can_access_customer(organisation_id, id));

create policy customers_insert_scoped
on public.customers for insert
to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
  and (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
    or created_by = (select auth.uid())
  )
);

create policy customers_update_scoped
on public.customers for update
to authenticated
using (public.can_access_customer(organisation_id, id))
with check (public.can_access_customer(organisation_id, id));

create policy customer_vehicles_read_scoped
on public.customer_vehicles for select
to authenticated
using (public.can_access_customer(organisation_id, customer_id));

create policy customer_vehicles_write_scoped
on public.customer_vehicles for all
to authenticated
using (public.can_access_customer(organisation_id, customer_id))
with check (public.can_access_customer(organisation_id, customer_id));

create view public.staff_vehicle_records
with (security_barrier = true)
as
select
  v.id,
  v.organisation_id,
  v.registration,
  v.stock_number,
  v.make,
  v.model,
  v.derivative,
  v.year,
  v.mileage,
  v.fuel_type,
  v.transmission,
  v.body_type,
  v.colour,
  v.retail_price,
  v.status,
  v.public_title,
  v.is_public,
  v.slug,
  v.sold_at,
  v.acquired_at,
  v.created_at,
  v.updated_at,
  v.deleted_at
from public.vehicles v
where v.deleted_at is null
  and public.has_org_role(
    v.organisation_id,
    array[
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'website_editor'
    ]
  );

create view public.staff_sales_records
with (security_barrier = true)
as
select
  s.id,
  s.organisation_id,
  s.reference,
  s.vehicle_id,
  s.customer_id,
  s.lead_id,
  s.salesperson_id,
  s.status,
  s.sale_price,
  s.deposit,
  s.part_exchange_allowance,
  s.discount,
  s.warranty,
  s.additional_products,
  s.payment_method,
  s.sale_date,
  s.handover_date,
  s.completed_at,
  s.created_at,
  s.updated_at,
  s.deleted_at
from public.sales s
where s.deleted_at is null
  and (
    public.has_org_role(s.organisation_id, array['owner', 'manager'])
    or (
      public.has_org_role(s.organisation_id, array['salesperson'])
      and s.salesperson_id = (select auth.uid())
    )
  );

revoke all on public.staff_vehicle_records from public;
revoke all on public.staff_sales_records from public;
grant select on public.staff_vehicle_records to authenticated;
grant select on public.staff_sales_records to authenticated;

revoke select on public.vehicles from authenticated;
revoke select on public.vehicle_costs from authenticated;
revoke select on public.sales from authenticated;

revoke insert, update, delete on
  public.organisation_members,
  public.dealership_settings,
  public.customers,
  public.customer_vehicles,
  public.vehicles,
  public.vehicle_images,
  public.vehicle_features,
  public.vehicle_costs,
  public.vehicle_status_history,
  public.vehicle_lookup_logs,
  public.vehicle_sync_records,
  public.leads,
  public.sourcing_requests,
  public.sourcing_candidates,
  public.appointment_types,
  public.availability_rules,
  public.availability_exceptions,
  public.appointments,
  public.repair_services,
  public.repair_jobs,
  public.repair_job_items,
  public.sales,
  public.tasks,
  public.task_comments,
  public.documents,
  public.notifications,
  public.website_pages,
  public.integration_settings,
  public.webhook_events,
  public.audit_logs,
  public.team_invitations,
  public.sourcing_activities,
  public.storage_cleanup_jobs
from authenticated;

revoke all on function public.update_vehicle_presentation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  text
) from authenticated;
revoke all on function public.update_assigned_repair_job(
  uuid,
  text,
  text,
  text,
  text
) from authenticated;

create unique index if not exists notifications_id_organisation_unique
  on public.notifications (id, organisation_id);

create table public.notification_receipts (
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  notification_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (notification_id, user_id),
  foreign key (notification_id, organisation_id)
    references public.notifications(id, organisation_id) on delete cascade
);

create index notification_receipts_user_idx
  on public.notification_receipts (
    organisation_id,
    user_id,
    read_at desc
  );

alter table public.notification_receipts enable row level security;

create policy notification_receipts_read_own
on public.notification_receipts for select
to authenticated
using (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

create policy notification_receipts_write_own
on public.notification_receipts for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

create policy notification_receipts_update_own
on public.notification_receipts for update
to authenticated
using (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
)
with check (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

revoke all on public.notification_receipts from anon;
grant select, insert, update on public.notification_receipts to authenticated;
grant all on public.notification_receipts to service_role;

create or replace function public.create_vehicle_with_costs(
  p_organisation_id uuid,
  p_actor_user_id uuid,
  p_vehicle jsonb,
  p_costs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle_id uuid;
  gross_profit numeric(12,2);
begin
  if jsonb_typeof(p_vehicle) <> 'object'
    or jsonb_typeof(p_costs) <> 'object' then
    raise exception 'Vehicle and cost details must be JSON objects'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager')
  ) then
    raise exception 'Creating stock is not permitted'
      using errcode = '42501';
  end if;

  gross_profit :=
    coalesce((p_vehicle ->> 'retail_price')::numeric, 0)
    - coalesce((p_costs ->> 'purchase_price')::numeric, 0)
    - coalesce((p_costs ->> 'preparation_costs')::numeric, 0)
    - coalesce((p_costs ->> 'repair_costs')::numeric, 0)
    - coalesce((p_costs ->> 'other_costs')::numeric, 0);

  insert into public.vehicles (
    organisation_id,
    created_by,
    updated_by,
    registration,
    registration_normalised,
    vin,
    stock_number,
    make,
    model,
    derivative,
    trim,
    body_type,
    fuel_type,
    transmission,
    colour,
    doors,
    seats,
    engine_size_cc,
    power_bhp,
    co2_emissions_g_km,
    euro_status,
    year,
    first_registration_date,
    mot_expiry,
    tax_status,
    previous_owners,
    mileage,
    service_history,
    number_of_keys,
    warranty,
    inspection_notes,
    known_faults,
    purchase_price,
    preparation_costs,
    repair_costs,
    other_costs,
    retail_price,
    minimum_acceptable_price,
    deposit_amount,
    estimated_gross_profit,
    public_title,
    attention_grabber,
    description,
    features,
    standard_equipment,
    optional_equipment,
    finance_example_text,
    warranty_wording,
    video_url,
    featured,
    is_featured,
    is_public,
    status,
    slug,
    lookup_provider,
    lookup_retrieved_at,
    data_reviewed_by,
    data_reviewed_at
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    p_actor_user_id,
    nullif(p_vehicle ->> 'registration', ''),
    nullif(p_vehicle ->> 'registration_normalised', ''),
    nullif(p_vehicle ->> 'vin', ''),
    p_vehicle ->> 'stock_number',
    p_vehicle ->> 'make',
    p_vehicle ->> 'model',
    nullif(p_vehicle ->> 'derivative', ''),
    nullif(p_vehicle ->> 'trim', ''),
    nullif(p_vehicle ->> 'body_type', ''),
    p_vehicle ->> 'fuel_type',
    p_vehicle ->> 'transmission',
    nullif(p_vehicle ->> 'colour', ''),
    nullif(p_vehicle ->> 'doors', '')::smallint,
    nullif(p_vehicle ->> 'seats', '')::smallint,
    nullif(p_vehicle ->> 'engine_size_cc', '')::integer,
    nullif(p_vehicle ->> 'power_bhp', '')::integer,
    nullif(p_vehicle ->> 'co2_emissions_g_km', '')::integer,
    nullif(p_vehicle ->> 'euro_status', ''),
    (p_vehicle ->> 'year')::integer,
    nullif(p_vehicle ->> 'first_registration_date', '')::date,
    nullif(p_vehicle ->> 'mot_expiry', '')::date,
    nullif(p_vehicle ->> 'tax_status', ''),
    nullif(p_vehicle ->> 'previous_owners', '')::smallint,
    (p_vehicle ->> 'mileage')::integer,
    nullif(p_vehicle ->> 'service_history', ''),
    nullif(p_vehicle ->> 'number_of_keys', '')::smallint,
    nullif(p_vehicle ->> 'warranty', ''),
    nullif(p_vehicle ->> 'inspection_notes', ''),
    nullif(p_vehicle ->> 'known_faults', ''),
    coalesce((p_costs ->> 'purchase_price')::numeric, 0),
    coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
    coalesce((p_costs ->> 'repair_costs')::numeric, 0),
    coalesce((p_costs ->> 'other_costs')::numeric, 0),
    (p_vehicle ->> 'retail_price')::numeric,
    nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
    coalesce((p_vehicle ->> 'deposit_amount')::numeric, 0),
    gross_profit,
    p_vehicle ->> 'public_title',
    nullif(p_vehicle ->> 'attention_grabber', ''),
    p_vehicle ->> 'description',
    coalesce(
      array(select jsonb_array_elements_text(p_vehicle -> 'features')),
      array[]::text[]
    ),
    nullif(p_vehicle ->> 'standard_equipment', ''),
    nullif(p_vehicle ->> 'optional_equipment', ''),
    nullif(p_vehicle ->> 'finance_example_text', ''),
    nullif(p_vehicle ->> 'warranty_wording', ''),
    nullif(p_vehicle ->> 'video_url', ''),
    coalesce((p_vehicle ->> 'featured')::boolean, false),
    coalesce((p_vehicle ->> 'is_featured')::boolean, false),
    false,
    coalesce(nullif(p_vehicle ->> 'status', ''), 'appraisal'),
    nullif(p_vehicle ->> 'slug', ''),
    nullif(p_vehicle ->> 'lookup_provider', ''),
    nullif(p_vehicle ->> 'lookup_retrieved_at', '')::timestamptz,
    p_actor_user_id,
    now()
  )
  returning id into vehicle_id;

  insert into public.vehicle_costs (
    organisation_id,
    vehicle_id,
    purchase_price,
    preparation_costs,
    repair_costs,
    other_costs,
    minimum_acceptable_price,
    created_by
  )
  values (
    p_organisation_id,
    vehicle_id,
    coalesce((p_costs ->> 'purchase_price')::numeric, 0),
    coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
    coalesce((p_costs ->> 'repair_costs')::numeric, 0),
    coalesce((p_costs ->> 'other_costs')::numeric, 0),
    nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
    p_actor_user_id
  );

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicles',
    vehicle_id,
    'vehicle.created',
    'vehicle',
    vehicle_id,
    jsonb_build_object(
      'vehicle', p_vehicle,
      'costs_recorded', true
    ),
    'application'
  );

  return jsonb_build_object(
    'id', vehicle_id,
    'slug', p_vehicle ->> 'slug',
    'stock_number', p_vehicle ->> 'stock_number',
    'status', p_vehicle ->> 'status',
    'is_public', false
  );
end;
$$;

create or replace function public.update_vehicle_with_costs(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid,
  p_vehicle_changes jsonb,
  p_costs jsonb,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_vehicle public.vehicles%rowtype;
  next_vehicle public.vehicles%rowtype;
  existing_costs public.vehicle_costs%rowtype;
  old_costs public.vehicle_costs%rowtype;
  result_vehicle public.vehicles%rowtype;
  actor_role text;
  costs_found boolean;
begin
  if jsonb_typeof(coalesce(p_vehicle_changes, '{}'::jsonb)) <> 'object'
    or (p_costs is not null and jsonb_typeof(p_costs) <> 'object') then
    raise exception 'Vehicle changes must be JSON objects'
      using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_change_reason, '')), '') is null then
    raise exception 'A change reason is required'
      using errcode = '22023';
  end if;

  select om.role
  into actor_role
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.user_id = p_actor_user_id
    and om.status = 'active'
    and om.deleted_at is null
    and om.role in ('owner', 'manager', 'website_editor')
  limit 1;
  if actor_role is null then
    raise exception 'Updating this vehicle is not permitted'
      using errcode = '42501';
  end if;

  if actor_role = 'website_editor' and exists (
    select 1
    from jsonb_object_keys(
      coalesce(p_vehicle_changes, '{}'::jsonb)
    ) as keys(key_name)
    where key_name not in (
      'public_title',
      'attention_grabber',
      'description',
      'features',
      'standard_equipment',
      'optional_equipment',
      'finance_example_text',
      'warranty_wording',
      'video_url',
      'featured',
      'is_featured',
      'is_public'
    )
  ) then
    raise exception 'Website editors may change presentation fields only'
      using errcode = '42501';
  end if;

  select *
  into strict existing_vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;

  next_vehicle := jsonb_populate_record(
    existing_vehicle,
    coalesce(p_vehicle_changes, '{}'::jsonb)
  );
  next_vehicle.id := existing_vehicle.id;
  next_vehicle.organisation_id := existing_vehicle.organisation_id;
  next_vehicle.created_by := existing_vehicle.created_by;
  next_vehicle.created_at := existing_vehicle.created_at;
  next_vehicle.deleted_at := existing_vehicle.deleted_at;
  next_vehicle.updated_by := p_actor_user_id;

  if p_costs is not null then
    if not exists (
      select 1
      from public.organisation_members om
      where om.organisation_id = p_organisation_id
        and om.user_id = p_actor_user_id
        and om.status = 'active'
        and om.deleted_at is null
        and om.role in ('owner', 'manager')
    ) then
      raise exception 'Commercial changes are not permitted'
        using errcode = '42501';
    end if;

    select *
    into existing_costs
    from public.vehicle_costs vc
    where vc.vehicle_id = p_vehicle_id
      and vc.organisation_id = p_organisation_id
      and vc.cost_type is null
      and vc.deleted_at is null
    limit 1
    for update;
    costs_found := found;
    old_costs := existing_costs;

    if costs_found then
      update public.vehicle_costs
      set
        purchase_price = coalesce(
          nullif(p_costs ->> 'purchase_price', '')::numeric,
          purchase_price
        ),
        preparation_costs = coalesce(
          nullif(p_costs ->> 'preparation_costs', '')::numeric,
          preparation_costs
        ),
        repair_costs = coalesce(
          nullif(p_costs ->> 'repair_costs', '')::numeric,
          repair_costs
        ),
        other_costs = coalesce(
          nullif(p_costs ->> 'other_costs', '')::numeric,
          other_costs
        ),
        minimum_acceptable_price = case
          when p_costs ? 'minimum_acceptable_price'
            then nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric
          else minimum_acceptable_price
        end
      where id = existing_costs.id
      returning * into existing_costs;
    else
      insert into public.vehicle_costs (
        organisation_id,
        vehicle_id,
        purchase_price,
        preparation_costs,
        repair_costs,
        other_costs,
        minimum_acceptable_price,
        created_by
      )
      values (
        p_organisation_id,
        p_vehicle_id,
        coalesce((p_costs ->> 'purchase_price')::numeric, 0),
        coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
        coalesce((p_costs ->> 'repair_costs')::numeric, 0),
        coalesce((p_costs ->> 'other_costs')::numeric, 0),
        nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
        p_actor_user_id
      )
      returning * into existing_costs;
    end if;

    next_vehicle.purchase_price := existing_costs.purchase_price;
    next_vehicle.preparation_costs := existing_costs.preparation_costs;
    next_vehicle.repair_costs := existing_costs.repair_costs;
    next_vehicle.other_costs := existing_costs.other_costs;
    next_vehicle.minimum_acceptable_price :=
      existing_costs.minimum_acceptable_price;
    next_vehicle.estimated_gross_profit :=
      coalesce(next_vehicle.retail_price, 0)
      - coalesce(existing_costs.purchase_price, 0)
      - coalesce(existing_costs.preparation_costs, 0)
      - coalesce(existing_costs.repair_costs, 0)
      - coalesce(existing_costs.other_costs, 0);
  end if;

  next_vehicle.estimated_gross_profit :=
    coalesce(next_vehicle.retail_price, 0)
    - coalesce(next_vehicle.purchase_price, 0)
    - coalesce(next_vehicle.preparation_costs, 0)
    - coalesce(next_vehicle.repair_costs, 0)
    - coalesce(next_vehicle.other_costs, 0);

  if next_vehicle.is_public then
    if next_vehicle.status not in (
      'ready_for_sale',
      'on_forecourt',
      'reserved',
      'sold'
    )
      or nullif(trim(coalesce(next_vehicle.slug, '')), '') is null
      or nullif(trim(coalesce(next_vehicle.public_title, '')), '') is null
      or nullif(trim(coalesce(next_vehicle.description, '')), '') is null
      or coalesce(next_vehicle.retail_price, 0) <= 0 then
      raise exception 'The vehicle is not eligible for public listing'
        using errcode = '23514';
    end if;

    perform vi.id
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = p_vehicle_id
      and vi.is_cover = true
      and vi.deleted_at is null
    limit 1
    for share;
    if not found then
      raise exception 'A live cover image is required before publishing'
        using errcode = '23514';
    end if;
  end if;

  update public.vehicles
  set
    registration = next_vehicle.registration,
    registration_normalised = next_vehicle.registration_normalised,
    stock_number = next_vehicle.stock_number,
    make = next_vehicle.make,
    model = next_vehicle.model,
    derivative = next_vehicle.derivative,
    trim = next_vehicle.trim,
    body_type = next_vehicle.body_type,
    fuel_type = next_vehicle.fuel_type,
    transmission = next_vehicle.transmission,
    colour = next_vehicle.colour,
    doors = next_vehicle.doors,
    seats = next_vehicle.seats,
    engine_size_cc = next_vehicle.engine_size_cc,
    power_bhp = next_vehicle.power_bhp,
    co2_emissions_g_km = next_vehicle.co2_emissions_g_km,
    euro_status = next_vehicle.euro_status,
    year = next_vehicle.year,
    first_registration_date = next_vehicle.first_registration_date,
    mot_expiry = next_vehicle.mot_expiry,
    tax_status = next_vehicle.tax_status,
    previous_owners = next_vehicle.previous_owners,
    mileage = next_vehicle.mileage,
    service_history = next_vehicle.service_history,
    number_of_keys = next_vehicle.number_of_keys,
    warranty = next_vehicle.warranty,
    inspection_notes = next_vehicle.inspection_notes,
    known_faults = next_vehicle.known_faults,
    provenance_status = next_vehicle.provenance_status,
    purchase_price = next_vehicle.purchase_price,
    preparation_costs = next_vehicle.preparation_costs,
    repair_costs = next_vehicle.repair_costs,
    other_costs = next_vehicle.other_costs,
    retail_price = next_vehicle.retail_price,
    minimum_acceptable_price = next_vehicle.minimum_acceptable_price,
    deposit_amount = next_vehicle.deposit_amount,
    estimated_gross_profit = next_vehicle.estimated_gross_profit,
    actual_sale_price = next_vehicle.actual_sale_price,
    public_title = next_vehicle.public_title,
    attention_grabber = next_vehicle.attention_grabber,
    description = next_vehicle.description,
    features = next_vehicle.features,
    standard_equipment = next_vehicle.standard_equipment,
    optional_equipment = next_vehicle.optional_equipment,
    finance_example_text = next_vehicle.finance_example_text,
    warranty_wording = next_vehicle.warranty_wording,
    video_url = next_vehicle.video_url,
    featured = next_vehicle.featured,
    is_featured = next_vehicle.is_featured,
    is_public = next_vehicle.is_public,
    status = next_vehicle.status,
    slug = next_vehicle.slug,
    updated_by = p_actor_user_id
  where id = p_vehicle_id
  returning * into result_vehicle;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    change_reason,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicles',
    p_vehicle_id,
    'vehicle.updated',
    'vehicle',
    p_vehicle_id,
    trim(p_change_reason),
    jsonb_build_object(
      'vehicle', to_jsonb(existing_vehicle),
      'costs', case when p_costs is null then null else to_jsonb(old_costs) end
    ),
    jsonb_build_object(
      'vehicle_changes', p_vehicle_changes,
      'costs', p_costs
    ),
    'application'
  );

  return jsonb_build_object(
    'id', result_vehicle.id,
    'slug', result_vehicle.slug,
    'status', result_vehicle.status,
    'is_public', result_vehicle.is_public
  );
end;
$$;

create or replace function public.soft_delete_vehicle_image(
  p_organisation_id uuid,
  p_image_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_record public.vehicle_images%rowtype;
  locked_vehicle_id uuid;
  next_cover_id uuid;
  vehicle_unpublished boolean := false;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager', 'website_editor')
  ) then
    raise exception 'Vehicle image deletion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.deleted_at is null;
  locked_vehicle_id := image_record.vehicle_id;

  perform v.id
  from public.vehicles v
  where v.id = locked_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;
  if not found then
    raise exception 'Vehicle was not found'
      using errcode = 'P0002';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.vehicle_id = locked_vehicle_id
    and vi.deleted_at is null
  for update;

  update public.vehicle_images
  set
    deleted_at = now(),
    is_cover = false
  where id = image_record.id;

  if image_record.is_cover then
    select vi.id
    into next_cover_id
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = image_record.vehicle_id
      and vi.deleted_at is null
    order by vi.sort_order, vi.id
    limit 1
    for update;

    if next_cover_id is not null then
      update public.vehicle_images
      set is_cover = true
      where id = next_cover_id;
    else
      update public.vehicles
      set
        is_public = false,
        updated_by = p_actor_user_id
      where id = image_record.vehicle_id
        and is_public = true;
      vehicle_unpublished := found;
    end if;
  end if;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicle_images',
    image_record.id,
    'vehicle_image.deleted',
    'vehicle',
    image_record.vehicle_id,
    jsonb_build_object(
      'storage_bucket', image_record.storage_bucket,
      'storage_path', image_record.storage_path,
      'is_cover', image_record.is_cover
    ),
    jsonb_build_object(
      'next_cover_id', next_cover_id,
      'vehicle_unpublished', vehicle_unpublished
    ),
    'application'
  );

  return jsonb_build_object(
    'image_id', image_record.id,
    'vehicle_id', image_record.vehicle_id,
    'storage_bucket', image_record.storage_bucket,
    'storage_path', image_record.storage_path,
    'next_cover_id', next_cover_id,
    'vehicle_unpublished', vehicle_unpublished
  );
end;
$$;

create unique index if not exists repair_jobs_appointment_unique
  on public.repair_jobs (appointment_id)
  where appointment_id is not null and deleted_at is null;

create or replace function public.convert_appointment_to_repair(
  p_organisation_id uuid,
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_mileage integer,
  p_assigned_technician_id uuid,
  p_due_date date,
  p_internal_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_record public.appointments%rowtype;
  repair_record public.repair_jobs%rowtype;
  next_technician_id uuid;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager', 'service_advisor')
  ) then
    raise exception 'Repair conversion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict appointment_record
  from public.appointments a
  where a.id = p_appointment_id
    and a.organisation_id = p_organisation_id
    and a.deleted_at is null
  for update;

  if appointment_record.customer_id is null then
    raise exception 'The appointment must be linked to a customer'
      using errcode = '23514';
  end if;

  select *
  into repair_record
  from public.repair_jobs rj
  where rj.appointment_id = p_appointment_id
    and rj.organisation_id = p_organisation_id
    and rj.deleted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'id', repair_record.id,
      'reference', repair_record.reference,
      'status', repair_record.status,
      'already_exists', true
    );
  end if;

  if not exists (
    select 1
    from public.appointment_types at
    where at.id = appointment_record.appointment_type_id
      and at.organisation_id = p_organisation_id
      and at.category = 'repair_call'
  ) then
    raise exception 'Only a repair-call appointment can become a repair job'
      using errcode = '23514';
  end if;

  next_technician_id := p_assigned_technician_id;
  if next_technician_id is null and exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = appointment_record.assigned_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('technician', 'service_advisor', 'manager', 'owner')
  ) then
    next_technician_id := appointment_record.assigned_user_id;
  end if;

  if next_technician_id is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = next_technician_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('technician', 'service_advisor', 'manager', 'owner')
  ) then
    raise exception 'The selected technician is not an active team member'
      using errcode = '23514';
  end if;

  insert into public.repair_jobs (
    organisation_id,
    appointment_id,
    customer_id,
    customer_vehicle_id,
    assigned_technician_id,
    status,
    registration,
    vehicle_make_model,
    mileage,
    reported_fault,
    internal_notes,
    start_date,
    due_date,
    approval_status,
    payment_status,
    created_by
  )
  values (
    p_organisation_id,
    p_appointment_id,
    appointment_record.customer_id,
    appointment_record.customer_vehicle_id,
    next_technician_id,
    'awaiting_inspection',
    appointment_record.registration,
    appointment_record.vehicle_make_model,
    p_mileage,
    coalesce(
      appointment_record.fault_description,
      appointment_record.reason_for_call,
      'Fault details to be confirmed'
    ),
    nullif(trim(coalesce(p_internal_note, '')), ''),
    appointment_record.starts_at::date,
    p_due_date,
    'not_requested',
    'not_invoiced',
    p_actor_user_id
  )
  returning * into repair_record;

  update public.appointments
  set status = 'workshop_appointment_required'
  where id = p_appointment_id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'repair_jobs',
    repair_record.id,
    'appointment.converted_to_repair',
    'repair_job',
    repair_record.id,
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'repair_reference', repair_record.reference,
      'assigned_technician_id', repair_record.assigned_technician_id
    ),
    'application'
  );

  return jsonb_build_object(
    'id', repair_record.id,
    'reference', repair_record.reference,
    'status', repair_record.status,
    'already_exists', false
  );
end;
$$;

create or replace function public.update_team_member_access(
  p_organisation_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_member public.organisation_members%rowtype;
  role_id_value uuid;
  active_owner_count integer;
begin
  if p_role not in (
    'owner',
    'manager',
    'salesperson',
    'service_advisor',
    'technician',
    'website_editor'
  ) or p_status not in ('active', 'suspended') then
    raise exception 'Invalid team role or status'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Only an active owner can change team access'
      using errcode = '42501';
  end if;

  if p_target_user_id = p_actor_user_id and p_status <> 'active' then
    raise exception 'You cannot suspend your own owner account'
      using errcode = '23514';
  end if;

  perform om.id
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.role = 'owner'
    and om.status = 'active'
    and om.deleted_at is null
  order by om.id
  for update;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Only an active owner can change team access'
      using errcode = '42501';
  end if;

  select *
  into strict target_member
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.user_id = p_target_user_id
    and om.deleted_at is null
  for update;

  if target_member.role = 'owner'
    and target_member.status = 'active'
    and (p_role <> 'owner' or p_status <> 'active') then
    select count(*)::integer
    into active_owner_count
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null;
    if active_owner_count <= 1 then
      raise exception 'Add another active owner before changing the final owner account'
        using errcode = '23514';
    end if;
  end if;

  select r.id
  into strict role_id_value
  from public.roles r
  where r.code = p_role;

  update public.organisation_members
  set
    role_id = role_id_value,
    role = p_role,
    status = p_status
  where id = target_member.id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'organisation_members',
    target_member.id,
    'team.member_access_updated',
    'organisation_member',
    target_member.id,
    jsonb_build_object(
      'user_id', target_member.user_id,
      'role', target_member.role,
      'status', target_member.status
    ),
    jsonb_build_object(
      'user_id', p_target_user_id,
      'role', p_role,
      'status', p_status
    ),
    'application'
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'role', p_role,
    'status', p_status
  );
end;
$$;

create or replace function public.claim_storage_cleanup_jobs(
  p_limit integer default 25
)
returns setof public.storage_cleanup_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select scj.id
    from public.storage_cleanup_jobs scj
    where (
        scj.status in ('pending', 'failed')
        or (
          scj.status = 'processing'
          and scj.updated_at < now() - interval '15 minutes'
        )
    )
      and scj.attempt_count < 10
    order by scj.created_at, scj.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    for update skip locked
  )
  update public.storage_cleanup_jobs scj
  set status = 'processing'
  from candidates
  where scj.id = candidates.id
  returning scj.*;
end;
$$;

revoke all on function public.create_vehicle_with_costs(
  uuid,
  uuid,
  jsonb,
  jsonb
) from public;
revoke all on function public.update_vehicle_with_costs(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) from public;
revoke all on function public.convert_appointment_to_repair(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  date,
  text
) from public;
revoke all on function public.update_team_member_access(
  uuid,
  uuid,
  text,
  text,
  uuid
) from public;
revoke all on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  from public;
revoke all on function public.claim_storage_cleanup_jobs(integer)
  from public;

grant execute on function public.create_vehicle_with_costs(
  uuid,
  uuid,
  jsonb,
  jsonb
) to service_role;
grant execute on function public.update_vehicle_with_costs(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) to service_role;
grant execute on function public.convert_appointment_to_repair(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  date,
  text
) to service_role;
grant execute on function public.update_team_member_access(
  uuid,
  uuid,
  text,
  text,
  uuid
) to service_role;
grant execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_storage_cleanup_jobs(integer)
  to service_role;

commit;
