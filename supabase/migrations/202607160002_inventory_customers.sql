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
