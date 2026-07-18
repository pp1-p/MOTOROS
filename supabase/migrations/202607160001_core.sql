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
