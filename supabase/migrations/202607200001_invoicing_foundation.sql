begin;

-- =============================================================================
-- MOTOR.OS invoicing foundation (Phase 1)
--
-- Adds invoices, line items, payments, activity log and per-tenant numbering
-- sequences. Two SECURITY DEFINER RPCs drive the flows staff use every day:
--   create_sale_invoice(sale_id, options) — build an invoice atomically from a
--     completed or in-progress vehicle sale, pulling customer + vehicle + line
--     items (vehicle, warranty, delivery/admin fees, additional products,
--     part-exchange as a discount line), and recording the sale's deposit as
--     the first payment against it.
--   record_invoice_payment(invoice_id, ...) — add a payment (or refund) and
--     recompute amount_paid, balance and status atomically. Idempotent via a
--     nullable client_reference used to deduplicate double-submits.
--
-- All monetary values use numeric(12,2). Line totals are computed by
-- generated columns; invoice-level totals (amount_paid, balance) are
-- maintained by the RPCs inside a transaction, so the balance is always
-- consistent with the payments.
--
-- Row Level Security follows the pattern already used in the operational
-- tables (has_org_role gate scoped to organisation_id). Anonymous access is
-- never granted.
-- =============================================================================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_number text not null,
  type text not null default 'general'
    check (
      type in (
        'vehicle_sale',
        'repair',
        'sourcing',
        'deposit',
        'general',
        'credit_note',
        'pro_forma',
        'vat'
      )
    ),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'sent',
        'viewed',
        'partially_paid',
        'paid',
        'overdue',
        'cancelled',
        'refunded',
        'credited',
        'void'
      )
    ),
  currency char(3) not null default 'GBP'
    check (currency ~ '^[A-Z]{3}$'),
  customer_id uuid references public.customers(id) on delete restrict,
  customer_name_snapshot text not null,
  customer_email_snapshot text,
  customer_phone_snapshot text,
  billing_address_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(billing_address_snapshot) = 'object'),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_registration_snapshot text,
  vehicle_description_snapshot text,
  sale_id uuid references public.sales(id) on delete set null,
  repair_job_id uuid references public.repair_jobs(id) on delete set null,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete set null,
  issued_at timestamptz,
  due_at timestamptz,
  vat_treatment text not null default 'standard'
    check (vat_treatment in ('standard', 'margin', 'zero', 'exempt', 'not_registered')),
  vat_registration_snapshot text,
  subtotal_net numeric(12,2) not null default 0 check (subtotal_net >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  vat_total numeric(12,2) not null default 0 check (vat_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  amount_paid numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  notes text,
  terms text,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoices_number_org_unique unique (organisation_id, invoice_number),
  constraint invoices_issued_when_not_draft check (
    status = 'draft' or issued_at is not null
  )
);

create index invoices_org_status_idx
  on public.invoices (organisation_id, status, created_at desc)
  where deleted_at is null;
create index invoices_org_type_idx
  on public.invoices (organisation_id, type, created_at desc)
  where deleted_at is null;
create index invoices_org_customer_idx
  on public.invoices (organisation_id, customer_id, created_at desc)
  where deleted_at is null and customer_id is not null;
create index invoices_org_vehicle_idx
  on public.invoices (organisation_id, vehicle_id, created_at desc)
  where deleted_at is null and vehicle_id is not null;
create index invoices_sale_idx
  on public.invoices (sale_id)
  where deleted_at is null and sale_id is not null;
create index invoices_repair_idx
  on public.invoices (repair_job_id)
  where deleted_at is null and repair_job_id is not null;
create index invoices_due_idx
  on public.invoices (organisation_id, due_at)
  where deleted_at is null and status in ('sent', 'partially_paid', 'overdue');

create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function public.touch_updated_at();

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sort_order integer not null default 0,
  item_type text not null default 'charge'
    check (item_type in ('charge', 'labour', 'part', 'fee', 'discount', 'note')),
  description text not null check (char_length(description) between 1 and 500),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  vat_treatment text not null default 'standard'
    check (vat_treatment in ('standard', 'margin', 'zero', 'exempt')),
  source_type text
    check (source_type is null or source_type in (
      'vehicle', 'warranty', 'delivery', 'admin_fee', 'preparation',
      'part_exchange', 'deposit_transfer', 'additional_product',
      'repair_labour', 'repair_part', 'sourcing_fee', 'other'
    )),
  source_id uuid,
  line_net numeric(12,2) generated always as (
    greatest(round(quantity * unit_price, 2) - discount_amount, 0)
  ) stored,
  line_vat numeric(12,2) generated always as (
    round(
      greatest(round(quantity * unit_price, 2) - discount_amount, 0)
      * (vat_rate / 100),
      2
    )
  ) stored,
  line_total numeric(12,2) generated always as (
    round(
      greatest(round(quantity * unit_price, 2) - discount_amount, 0)
      * (1 + vat_rate / 100),
      2
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index invoice_line_items_invoice_idx
  on public.invoice_line_items (invoice_id, sort_order)
  where deleted_at is null;
create index invoice_line_items_org_idx
  on public.invoice_line_items (organisation_id)
  where deleted_at is null;

create trigger invoice_line_items_touch_updated_at
before update on public.invoice_line_items
for each row execute function public.touch_updated_at();

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0),
  method text not null default 'other'
    check (method in (
      'cash', 'card', 'bank_transfer', 'finance_provider',
      'payment_link', 'cheque', 'deposit_transfer', 'other'
    )),
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  is_refund boolean not null default false,
  client_reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoice_payments_refund_sign_ck check (
    (is_refund = false and amount > 0) or (is_refund = true and amount < 0)
  ),
  constraint invoice_payments_client_reference_unique
    unique (organisation_id, invoice_id, client_reference)
);

create index invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id, paid_at desc)
  where deleted_at is null;
create index invoice_payments_org_idx
  on public.invoice_payments (organisation_id, paid_at desc)
  where deleted_at is null;

create trigger invoice_payments_touch_updated_at
before update on public.invoice_payments
for each row execute function public.touch_updated_at();

create table public.invoice_activity (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  detail text,
  payload jsonb,
  occurred_at timestamptz not null default now()
);

create index invoice_activity_invoice_idx
  on public.invoice_activity (invoice_id, occurred_at desc);
create index invoice_activity_org_idx
  on public.invoice_activity (organisation_id, occurred_at desc);

create table public.invoice_sequences (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  prefix text not null default 'INV',
  padding smallint not null default 4 check (padding between 1 and 10),
  include_year boolean not null default true,
  year_reset boolean not null default true,
  last_year_used smallint,
  next_number integer not null default 1 check (next_number > 0),
  updated_at timestamptz not null default now()
);

create trigger invoice_sequences_touch_updated_at
before update on public.invoice_sequences
for each row execute function public.touch_updated_at();

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_activity enable row level security;
alter table public.invoice_sequences enable row level security;

create policy invoices_read
on public.invoices for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy invoice_line_items_read
on public.invoice_line_items for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy invoice_payments_read
on public.invoice_payments for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy invoice_activity_read
on public.invoice_activity for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));

create policy invoice_sequences_read
on public.invoice_sequences for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));

create policy invoice_sequences_write
on public.invoice_sequences for update to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

-- Writes to invoice tables happen exclusively through SECURITY DEFINER RPCs
-- below. The base tables therefore have no INSERT/UPDATE policies for
-- authenticated users — a browser session cannot mutate them directly.

revoke insert, update, delete on public.invoices from anon, authenticated;
revoke insert, update, delete on public.invoice_line_items from anon, authenticated;
revoke insert, update, delete on public.invoice_payments from anon, authenticated;
revoke insert, update, delete on public.invoice_activity from anon, authenticated;
revoke insert, delete on public.invoice_sequences from anon, authenticated;

-- Atomically advance the per-tenant invoice sequence and format the number.
-- Creates the sequence row on first call for a dealership.
create or replace function public.allocate_invoice_number(p_organisation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq public.invoice_sequences%rowtype;
  current_year smallint := extract(year from now())::smallint;
  effective_number integer;
  formatted text;
begin
  insert into public.invoice_sequences (organisation_id)
  values (p_organisation_id)
  on conflict (organisation_id) do nothing;

  select * into seq
  from public.invoice_sequences
  where organisation_id = p_organisation_id
  for update;

  if seq.year_reset and seq.last_year_used is distinct from current_year then
    update public.invoice_sequences
    set next_number = 1,
        last_year_used = current_year
    where organisation_id = p_organisation_id
    returning * into seq;
  end if;

  effective_number := seq.next_number;

  update public.invoice_sequences
  set next_number = seq.next_number + 1,
      last_year_used = current_year
  where organisation_id = p_organisation_id;

  formatted := seq.prefix
    || case when seq.include_year then '-' || current_year::text else '' end
    || '-'
    || lpad(effective_number::text, seq.padding, '0');

  return formatted;
end;
$$;

revoke all on function public.allocate_invoice_number(uuid) from public;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;

-- Recompute an invoice's totals from its line items + payments and update
-- amount_paid, balance and status. Called by the payment and invoice RPCs.
create or replace function public.recompute_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  new_subtotal numeric(12,2);
  new_discount numeric(12,2);
  new_vat numeric(12,2);
  new_total numeric(12,2);
  new_paid numeric(12,2);
  new_balance numeric(12,2);
  new_status text;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then return; end if;

  select
    coalesce(sum(case when item_type = 'discount' then 0 else greatest(round(quantity * unit_price, 2), 0) end), 0),
    coalesce(sum(case when item_type = 'discount' then greatest(round(quantity * unit_price, 2), 0) + discount_amount else discount_amount end), 0),
    coalesce(sum(line_vat), 0)
  into new_subtotal, new_discount, new_vat
  from public.invoice_line_items
  where invoice_id = p_invoice_id and deleted_at is null;

  new_total := greatest(new_subtotal - new_discount + new_vat, 0);

  select coalesce(sum(amount), 0)
  into new_paid
  from public.invoice_payments
  where invoice_id = p_invoice_id and deleted_at is null;

  new_balance := new_total - new_paid;

  new_status := inv.status;
  if new_status not in ('draft', 'cancelled', 'void', 'credited') then
    if new_paid <= 0 then
      new_status := case
        when inv.due_at is not null and inv.due_at < now() then 'overdue'
        when new_status = 'viewed' then 'viewed'
        else 'sent'
      end;
    elsif new_balance <= 0.005 then
      new_status := 'paid';
    else
      new_status := 'partially_paid';
    end if;
  end if;

  update public.invoices
  set subtotal_net = new_subtotal,
      discount_total = new_discount,
      vat_total = new_vat,
      total = new_total,
      amount_paid = new_paid,
      balance = greatest(new_balance, 0),
      status = new_status
  where id = p_invoice_id;
end;
$$;

revoke all on function public.recompute_invoice_totals(uuid) from public;
grant execute on function public.recompute_invoice_totals(uuid) to authenticated;

-- Create a vehicle-sale invoice from a sale record. Options let staff pick
-- issue behaviour, due date, and extra optional charges (warranty, delivery,
-- admin, additional products) without changing the sale itself.
--
-- The sale's deposit is recorded as the first payment on the invoice, using
-- a stable client_reference so replaying the RPC never doubles up.
create or replace function public.create_sale_invoice(
  p_actor_user_id uuid,
  p_sale_id uuid,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale public.sales%rowtype;
  cust public.customers%rowtype;
  vehicle public.vehicles%rowtype;
  settings public.dealership_settings%rowtype;
  invoice_id uuid := gen_random_uuid();
  invoice_number text;
  should_issue boolean := coalesce((p_options ->> 'issue')::boolean, true);
  due_at timestamptz;
  vat_rate numeric := coalesce((p_options ->> 'vat_rate')::numeric, 20);
  vat_treatment text := coalesce(p_options ->> 'vat_treatment', 'standard');
  warranty_price numeric := coalesce((p_options ->> 'warranty_price')::numeric, 0);
  delivery_fee numeric := coalesce((p_options ->> 'delivery_fee')::numeric, 0);
  admin_fee numeric := coalesce((p_options ->> 'admin_fee')::numeric, 0);
  preparation_fee numeric := coalesce((p_options ->> 'preparation_fee')::numeric, 0);
  extra_products jsonb;
  extra_row jsonb;
  sort_position integer := 0;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into sale from public.sales where id = p_sale_id and deleted_at is null;
  if not found then
    raise exception 'Sale % not found', p_sale_id using errcode = 'P0002';
  end if;

  if not public.has_org_role(
    sale.organisation_id,
    array['owner', 'manager', 'salesperson']
  ) then
    raise exception 'Not authorised to invoice this sale' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.invoices
    where sale_id = p_sale_id
      and organisation_id = sale.organisation_id
      and deleted_at is null
      and status not in ('cancelled', 'void')
  ) then
    raise exception 'Sale already has an active invoice' using errcode = '23505';
  end if;

  select * into cust from public.customers where id = sale.customer_id;
  select * into vehicle from public.vehicles where id = sale.vehicle_id;
  select * into settings from public.dealership_settings where organisation_id = sale.organisation_id;
  extra_products := coalesce(p_options -> 'additional_products', sale.additional_products);

  invoice_number := public.allocate_invoice_number(sale.organisation_id);
  due_at := coalesce(
    (p_options ->> 'due_at')::timestamptz,
    now() + interval '14 days'
  );

  insert into public.invoices (
    id, organisation_id, invoice_number, type, status,
    customer_id, customer_name_snapshot, customer_email_snapshot,
    customer_phone_snapshot, billing_address_snapshot,
    vehicle_id, vehicle_registration_snapshot, vehicle_description_snapshot,
    sale_id, issued_at, due_at, vat_treatment, vat_registration_snapshot,
    notes, terms, created_by, issued_by
  )
  values (
    invoice_id,
    sale.organisation_id,
    invoice_number,
    'vehicle_sale',
    case when should_issue then 'sent' else 'draft' end,
    sale.customer_id,
    coalesce(cust.full_name, trim(concat(cust.first_name, ' ', cust.last_name))),
    cust.email,
    cust.phone,
    coalesce(cust.address, '{}'::jsonb),
    sale.vehicle_id,
    vehicle.registration,
    concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model, vehicle.derivative),
    sale.id,
    case when should_issue then now() else null end,
    due_at,
    vat_treatment,
    settings.vat_number,
    p_options ->> 'notes',
    p_options ->> 'terms',
    p_actor_user_id,
    case when should_issue then p_actor_user_id else null end
  );

  sort_position := sort_position + 1;
  insert into public.invoice_line_items (
    organisation_id, invoice_id, sort_order, item_type, description,
    quantity, unit_price, vat_rate, vat_treatment, source_type, source_id
  )
  values (
    sale.organisation_id, invoice_id, sort_position, 'charge',
    concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model, vehicle.derivative)
      || ' (' || coalesce(vehicle.registration, 'no reg') || ')',
    1, coalesce(sale.sale_price, 0),
    case when vat_treatment in ('margin', 'zero', 'exempt', 'not_registered') then 0 else vat_rate end,
    vat_treatment, 'vehicle', vehicle.id
  );

  if warranty_price > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'charge',
      'Extended warranty', 1, warranty_price, vat_rate, 'standard', 'warranty'
    );
  end if;

  if preparation_fee > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'charge',
      'Vehicle preparation', 1, preparation_fee, vat_rate, 'standard', 'preparation'
    );
  end if;

  if delivery_fee > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'fee',
      'Delivery', 1, delivery_fee, vat_rate, 'standard', 'delivery'
    );
  end if;

  if admin_fee > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'fee',
      'Administration fee', 1, admin_fee, vat_rate, 'standard', 'admin_fee'
    );
  end if;

  if jsonb_typeof(extra_products) = 'array' then
    for extra_row in select * from jsonb_array_elements(extra_products) loop
      sort_position := sort_position + 1;
      insert into public.invoice_line_items (
        organisation_id, invoice_id, sort_order, item_type, description,
        quantity, unit_price, vat_rate, vat_treatment, source_type
      ) values (
        sale.organisation_id, invoice_id, sort_position, 'charge',
        coalesce(extra_row ->> 'name', 'Additional product'),
        coalesce((extra_row ->> 'quantity')::numeric, 1),
        coalesce((extra_row ->> 'price')::numeric, 0),
        coalesce((extra_row ->> 'vat_rate')::numeric, vat_rate),
        'standard', 'additional_product'
      );
    end loop;
  end if;

  if coalesce(sale.part_exchange_allowance, 0) > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'discount',
      'Part-exchange allowance', 1, sale.part_exchange_allowance, 0,
      'standard', 'part_exchange'
    );
  end if;

  if coalesce(sale.discount, 0) > 0 then
    sort_position := sort_position + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    ) values (
      sale.organisation_id, invoice_id, sort_position, 'discount',
      'Discount', 1, sale.discount, 0, 'standard', 'other'
    );
  end if;

  if coalesce(sale.deposit, 0) > 0 then
    insert into public.invoice_payments (
      organisation_id, invoice_id, amount, method, paid_at, reference,
      notes, is_refund, client_reference, recorded_by
    ) values (
      sale.organisation_id, invoice_id, sale.deposit, 'deposit_transfer', now(),
      sale.reference, 'Deposit taken with the sale ' || sale.reference,
      false, 'sale-deposit:' || sale.id::text, p_actor_user_id
    ) on conflict do nothing;
  end if;

  perform public.recompute_invoice_totals(invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    sale.organisation_id, invoice_id, p_actor_user_id, 'invoice.created',
    'Created from sale ' || sale.reference
  );

  if should_issue then
    insert into public.invoice_activity (
      organisation_id, invoice_id, actor_user_id, action, detail
    ) values (
      sale.organisation_id, invoice_id, p_actor_user_id, 'invoice.issued',
      'Issued with number ' || invoice_number
    );
  end if;

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    sale.organisation_id, p_actor_user_id, 'invoice.created', 'invoice', invoice_id,
    'Invoice ' || invoice_number || ' created from sale ' || sale.reference,
    jsonb_build_object(
      'invoice_number', invoice_number,
      'sale_id', sale.id,
      'issued', should_issue
    )
  );

  return invoice_id;
end;
$$;

revoke all on function public.create_sale_invoice(uuid, uuid, jsonb) from public;
grant execute on function public.create_sale_invoice(uuid, uuid, jsonb) to authenticated;

-- Record a payment (or refund) against an invoice. Idempotent via
-- (invoice_id, client_reference); the caller can pass a stable UUID for the
-- form submission to make double-click safe.
create or replace function public.record_invoice_payment(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_paid_at timestamptz default now(),
  p_reference text default null,
  p_notes text default null,
  p_is_refund boolean default false,
  p_client_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  payment_id uuid;
  effective_amount numeric(12,2);
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;
  if p_method is null or p_method not in (
    'cash', 'card', 'bank_transfer', 'finance_provider',
    'payment_link', 'cheque', 'deposit_transfer', 'other'
  ) then
    raise exception 'Unsupported payment method: %', p_method using errcode = '22023';
  end if;

  select * into inv from public.invoices where id = p_invoice_id and deleted_at is null;
  if not found then
    raise exception 'Invoice % not found', p_invoice_id using errcode = 'P0002';
  end if;

  if not public.has_org_role(
    inv.organisation_id, array['owner', 'manager']
  ) then
    raise exception 'Not authorised to record payments' using errcode = '42501';
  end if;

  if inv.status in ('cancelled', 'void', 'credited') then
    raise exception 'Cannot record a payment on a % invoice', inv.status
      using errcode = '22023';
  end if;

  effective_amount := round(p_amount, 2);
  if p_is_refund then effective_amount := -effective_amount; end if;

  if p_client_reference is not null then
    select id into payment_id from public.invoice_payments
    where invoice_id = inv.id and client_reference = p_client_reference;
    if payment_id is not null then
      return payment_id;
    end if;
  end if;

  insert into public.invoice_payments (
    organisation_id, invoice_id, amount, method, paid_at, reference,
    notes, is_refund, client_reference, recorded_by
  ) values (
    inv.organisation_id, inv.id, effective_amount, p_method, p_paid_at,
    p_reference, p_notes, p_is_refund, p_client_reference, p_actor_user_id
  ) returning id into payment_id;

  perform public.recompute_invoice_totals(inv.id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail, payload
  ) values (
    inv.organisation_id, inv.id, p_actor_user_id,
    case when p_is_refund then 'payment.refunded' else 'payment.recorded' end,
    coalesce(p_reference, 'Payment recorded'),
    jsonb_build_object('amount', effective_amount, 'method', p_method, 'payment_id', payment_id)
  );

  return payment_id;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, uuid, numeric, text, timestamptz, text, text, boolean, text) from public;
grant execute on function public.record_invoice_payment(uuid, uuid, numeric, text, timestamptz, text, text, boolean, text) to authenticated;

commit;
