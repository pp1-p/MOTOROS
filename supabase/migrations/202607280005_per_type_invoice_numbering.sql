begin;

-- =============================================================================
-- MOTOR.OS per-type invoice numbering
--
-- Each invoice type gets its own numbering sequence (prefix + counter),
-- scoped to the organisation. The sequences live in a new table so staff
-- can edit prefixes or reset counters from an admin UI. A BEFORE-INSERT
-- trigger on public.invoices reassigns invoice_number using the correct
-- sequence, so the existing invoice-creation RPCs (create_general_invoice,
-- create_sale_invoice, create_repair_invoice, create_standalone_repair_invoice,
-- create_standalone_sale_invoice, duplicate_invoice, credit-note flows) all
-- pick this up without any code changes.
--
-- Types without a sequence row fall through to whatever number the RPC set
-- (via allocate_invoice_number), so nothing breaks.
-- =============================================================================

create table if not exists public.invoice_number_sequences (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type text not null,
  prefix text not null,
  next_number bigint not null default 1 check (next_number >= 1),
  digits smallint not null default 4 check (digits between 1 and 9),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, type)
);

alter table public.invoice_number_sequences enable row level security;

create policy invoice_number_sequences_read on public.invoice_number_sequences
  for select
  using (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'salesperson', 'service_advisor', 'accountant']
    )
  );

create policy invoice_number_sequences_write on public.invoice_number_sequences
  for all
  using (public.has_org_role(organisation_id, array['owner', 'manager']))
  with check (public.has_org_role(organisation_id, array['owner', 'manager']));

-- Reasonable UK-dealership defaults.
create or replace function public.seed_invoice_number_sequences(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.invoice_number_sequences (organisation_id, type, prefix, next_number, digits)
  values
    (p_org, 'repair',       'REP', 1, 4),
    (p_org, 'vehicle_sale', 'SLE', 1, 4),
    (p_org, 'general',      'GEN', 1, 4),
    (p_org, 'pro_forma',    'PRO', 1, 4),
    (p_org, 'vat',          'VAT', 1, 4),
    (p_org, 'credit_note',  'CRN', 1, 4),
    (p_org, 'sourcing',     'SRC', 1, 4),
    (p_org, 'deposit',      'DEP', 1, 4)
  on conflict (organisation_id, type) do nothing;
end;
$$;

-- Seed sequences for every organisation that already exists.
do $$
declare
  org record;
begin
  for org in select id from public.organisations loop
    perform public.seed_invoice_number_sequences(org.id);
  end loop;
end;
$$;

-- Auto-seed when a new organisation is created.
create or replace function public.on_organisation_created_seed_invoice_sequences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_invoice_number_sequences(new.id);
  return new;
end;
$$;

drop trigger if exists organisations_seed_invoice_sequences on public.organisations;
create trigger organisations_seed_invoice_sequences
  after insert on public.organisations
  for each row
  execute function public.on_organisation_created_seed_invoice_sequences();

-- Reassign invoice_number using the correct per-type sequence.
-- Runs BEFORE INSERT so the row is stored with the final number.
create or replace function public.assign_typed_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq_prefix text;
  seq_next bigint;
  seq_digits smallint;
begin
  -- Fetch and lock the sequence row so concurrent inserts don't collide.
  select prefix, next_number, digits
    into seq_prefix, seq_next, seq_digits
    from public.invoice_number_sequences
   where organisation_id = new.organisation_id
     and type = new.type
   for update;

  -- No sequence configured for this type: keep whatever the RPC set.
  if seq_prefix is null then
    return new;
  end if;

  new.invoice_number := seq_prefix || '-' || lpad(seq_next::text, seq_digits, '0');

  update public.invoice_number_sequences
     set next_number = seq_next + 1,
         updated_at = now()
   where organisation_id = new.organisation_id
     and type = new.type;

  return new;
end;
$$;

drop trigger if exists invoices_typed_number on public.invoices;
create trigger invoices_typed_number
  before insert on public.invoices
  for each row
  execute function public.assign_typed_invoice_number();

commit;
