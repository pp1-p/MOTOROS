begin;

-- =============================================================================
-- MOTOR.OS repair codes catalogue
--
-- A reusable per-organisation catalogue of common repair, labour, parts and
-- diagnostic codes. Repair invoices reference these by code so a technician
-- can type or scan a code and have the default description, price, labour
-- time, tax rate and category pre-filled.
--
-- Codes are soft-deleted (deleted_at) so historical invoice line items keep
-- their reference intact. `active` toggles visibility in the picker without
-- affecting historical rows.
-- =============================================================================

create table if not exists public.repair_codes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  code text not null,
  description text not null,
  default_price numeric(12, 2) not null default 0 check (default_price >= 0),
  labour_hours numeric(6, 2) not null default 0 check (labour_hours >= 0),
  tax_rate numeric(5, 2) not null default 20 check (tax_rate >= 0 and tax_rate <= 100),
  category text not null default 'other'
    check (category in ('labour', 'parts', 'diagnostic', 'consumable', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  constraint repair_codes_code_unique_per_org
    unique (organisation_id, code) deferrable initially deferred
);

create index if not exists repair_codes_organisation_idx
  on public.repair_codes (organisation_id)
  where deleted_at is null;

create index if not exists repair_codes_code_search_idx
  on public.repair_codes using gin (to_tsvector('simple', code || ' ' || description))
  where deleted_at is null;

alter table public.repair_codes enable row level security;

create policy repair_codes_read on public.repair_codes
  for select
  using (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'service_advisor', 'sales_advisor', 'technician', 'accountant']
    )
  );

create policy repair_codes_insert on public.repair_codes
  for insert
  with check (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
  );

create policy repair_codes_update on public.repair_codes
  for update
  using (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
  );

create policy repair_codes_delete on public.repair_codes
  for delete
  using (
    public.has_org_role(organisation_id, array['owner', 'manager'])
  );

-- Trigger to keep updated_at fresh.
create or replace function public.repair_codes_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists repair_codes_updated_at on public.repair_codes;
create trigger repair_codes_updated_at
  before update on public.repair_codes
  for each row
  execute function public.repair_codes_touch_updated_at();

commit;
