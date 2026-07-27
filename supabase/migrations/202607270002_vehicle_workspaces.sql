begin;

-- Every stock vehicle acts as a complete dealership workspace. These fields
-- extend the core DVLA/advert record with verified specification, condition,
-- sales-channel and sales-assistant content.
alter table public.vehicles
  add column if not exists vat_status text not null default 'no_vat'
    check (vat_status in ('excluding_vat', 'including_vat', 'margin_scheme', 'no_vat')),
  add column if not exists cap_id text,
  add column if not exists plate text,
  add column if not exists interior_colour text,
  add column if not exists interior_material text,
  add column if not exists fuel_consumption_urban_mpg numeric(7,2)
    check (fuel_consumption_urban_mpg >= 0),
  add column if not exists fuel_consumption_extra_urban_mpg numeric(7,2)
    check (fuel_consumption_extra_urban_mpg >= 0),
  add column if not exists fuel_consumption_combined_mpg numeric(7,2)
    check (fuel_consumption_combined_mpg >= 0),
  add column if not exists insurance_group text,
  add column if not exists road_tax_annual numeric(10,2)
    check (road_tax_annual >= 0),
  add column if not exists wheelchair_accessible boolean,
  add column if not exists acceleration_0_60_seconds numeric(6,2)
    check (acceleration_0_60_seconds >= 0),
  add column if not exists top_speed_mph integer
    check (top_speed_mph >= 0),
  add column if not exists torque_lb_ft integer
    check (torque_lb_ft >= 0),
  add column if not exists aspiration text,
  add column if not exists engine_location text,
  add column if not exists engine_number text,
  add column if not exists chassis_number text,
  add column if not exists cylinder_count smallint
    check (cylinder_count between 1 and 32),
  add column if not exists gear_count smallint
    check (gear_count between 1 and 20),
  add column if not exists drive_type text,
  add column if not exists gross_weight_kg integer
    check (gross_weight_kg >= 0),
  add column if not exists length_mm integer
    check (length_mm >= 0),
  add column if not exists width_mm integer
    check (width_mm >= 0),
  add column if not exists keeper_start_date date,
  add column if not exists advertised_condition text not null default 'used'
    check (advertised_condition in ('new', 'used', 'demonstrator', 'pre_registered')),
  add column if not exists insurance_write_off_category text,
  add column if not exists service_history_visible boolean not null default true,
  add column if not exists service_history_summary text,
  add column if not exists silent_salesman_headline text,
  add column if not exists silent_salesman_summary text,
  add column if not exists silent_salesman_call_to_action text;

create table if not exists public.vehicle_service_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_date date not null,
  mileage integer check (mileage >= 0),
  dealership_name text,
  work_completed text,
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index if not exists vehicle_service_records_vehicle_idx
  on public.vehicle_service_records (organisation_id, vehicle_id, service_date desc)
  where deleted_at is null;

create table if not exists public.vehicle_sales_channels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  channel text not null
    check (channel in ('website', 'autotrader', 'ebay', 'carwow', 'other')),
  status text not null default 'not_configured'
    check (
      status in (
        'not_configured', 'draft', 'ready', 'pending', 'published',
        'paused', 'failed', 'removed', 'over_contracted'
      )
    ),
  external_stock_id text,
  external_derivative_id text,
  listing_title text,
  listing_subtitle text,
  category text,
  listing_url text,
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (vehicle_id, channel)
);

create index if not exists vehicle_sales_channels_vehicle_idx
  on public.vehicle_sales_channels (organisation_id, vehicle_id, channel);

create table if not exists public.vehicle_videos (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  video_url text not null check (video_url ~ '^https://'),
  is_public boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index if not exists vehicle_videos_vehicle_idx
  on public.vehicle_videos (organisation_id, vehicle_id, sort_order)
  where deleted_at is null;

create table if not exists public.vehicle_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  note text not null check (char_length(trim(note)) between 1 and 5000),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index if not exists vehicle_notes_vehicle_idx
  on public.vehicle_notes (organisation_id, vehicle_id, is_pinned desc, created_at desc)
  where deleted_at is null;

drop trigger if exists vehicle_service_records_touch_updated_at
  on public.vehicle_service_records;
create trigger vehicle_service_records_touch_updated_at
before update on public.vehicle_service_records
for each row execute function public.touch_updated_at();

drop trigger if exists vehicle_sales_channels_touch_updated_at
  on public.vehicle_sales_channels;
create trigger vehicle_sales_channels_touch_updated_at
before update on public.vehicle_sales_channels
for each row execute function public.touch_updated_at();

drop trigger if exists vehicle_videos_touch_updated_at on public.vehicle_videos;
create trigger vehicle_videos_touch_updated_at
before update on public.vehicle_videos
for each row execute function public.touch_updated_at();

drop trigger if exists vehicle_notes_touch_updated_at on public.vehicle_notes;
create trigger vehicle_notes_touch_updated_at
before update on public.vehicle_notes
for each row execute function public.touch_updated_at();

alter table public.vehicle_service_records enable row level security;
alter table public.vehicle_sales_channels enable row level security;
alter table public.vehicle_videos enable row level security;
alter table public.vehicle_notes enable row level security;

drop policy if exists vehicle_service_records_read
  on public.vehicle_service_records;
drop policy if exists vehicle_service_records_write
  on public.vehicle_service_records;
create policy vehicle_service_records_read
on public.vehicle_service_records for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy vehicle_service_records_write
on public.vehicle_service_records for all to authenticated
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

drop policy if exists vehicle_sales_channels_read
  on public.vehicle_sales_channels;
drop policy if exists vehicle_sales_channels_write
  on public.vehicle_sales_channels;
create policy vehicle_sales_channels_read
on public.vehicle_sales_channels for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);
create policy vehicle_sales_channels_write
on public.vehicle_sales_channels for all to authenticated
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

drop policy if exists vehicle_videos_read on public.vehicle_videos;
drop policy if exists vehicle_videos_write on public.vehicle_videos;
create policy vehicle_videos_read
on public.vehicle_videos for select to authenticated
using (public.is_org_member(organisation_id));
create policy vehicle_videos_write
on public.vehicle_videos for all to authenticated
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

drop policy if exists vehicle_notes_read on public.vehicle_notes;
drop policy if exists vehicle_notes_write on public.vehicle_notes;
create policy vehicle_notes_read
on public.vehicle_notes for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy vehicle_notes_write
on public.vehicle_notes for all to authenticated
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

revoke all on public.vehicle_service_records from anon;
revoke all on public.vehicle_sales_channels from anon;
revoke all on public.vehicle_videos from anon;
revoke all on public.vehicle_notes from anon;

grant select, insert, update, delete on public.vehicle_service_records to authenticated;
grant select, insert, update, delete on public.vehicle_sales_channels to authenticated;
grant select, insert, update, delete on public.vehicle_videos to authenticated;
grant select, insert, update, delete on public.vehicle_notes to authenticated;

commit;
