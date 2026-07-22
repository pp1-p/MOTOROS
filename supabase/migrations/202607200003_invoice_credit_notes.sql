begin;

-- =============================================================================
-- MOTOR.OS invoicing Phase 3 — credit notes, refunds, void
--
-- A credit note is a separate document that offsets an invoice: it tells the
-- customer "you no longer owe this £X" (or "we owe you £X back if you have
-- already paid"). Following standard UK bookkeeping (Xero / FreeAgent /
-- QuickBooks): credit notes live in their own table with their own numbers;
-- their amount is subtracted from the invoice's effective balance; a
-- follow-up refund payment records money leaving the dealership.
--
-- Void is separate again: it terminates an invoice that was issued in error.
-- Refused if any payment has been recorded — those must be credited and
-- refunded first, preserving the audit trail.
-- =============================================================================

alter table public.invoices
  add column if not exists credited_total numeric(12,2) not null default 0;

create table public.invoice_credit_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  credit_note_number text not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name_snapshot text not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 2 and 4000),
  notes text,
  status text not null default 'issued'
    check (status in ('issued', 'refunded', 'cancelled')),
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  refunded_payment_id uuid references public.invoice_payments(id) on delete set null,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint credit_notes_number_org_unique unique (organisation_id, credit_note_number)
);

create index invoice_credit_notes_invoice_idx
  on public.invoice_credit_notes (invoice_id, issued_at desc)
  where deleted_at is null;
create index invoice_credit_notes_org_idx
  on public.invoice_credit_notes (organisation_id, issued_at desc)
  where deleted_at is null;
create index invoice_credit_notes_status_idx
  on public.invoice_credit_notes (organisation_id, status)
  where deleted_at is null;

create trigger invoice_credit_notes_touch_updated_at
before update on public.invoice_credit_notes
for each row execute function public.touch_updated_at();

alter table public.invoice_credit_notes enable row level security;

create policy invoice_credit_notes_read
on public.invoice_credit_notes for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

revoke insert, update, delete on public.invoice_credit_notes from anon, authenticated;

-- Extend the totals recompute to subtract active credit notes from balance,
-- and treat status="credited" as a terminal state.
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
  new_credited numeric(12,2);
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

  select coalesce(sum(amount), 0)
  into new_credited
  from public.invoice_credit_notes
  where invoice_id = p_invoice_id
    and deleted_at is null
    and status <> 'cancelled';

  new_balance := greatest(new_total - new_paid - new_credited, 0);

  new_status := inv.status;
  -- Terminal states are not automatically recomputed away.
  if new_status not in ('draft', 'cancelled', 'void') then
    if new_credited >= new_total then
      new_status := 'credited';
    elsif new_paid <= 0 and new_credited <= 0 then
      new_status := case
        when inv.due_at is not null and inv.due_at < now() then 'overdue'
        when new_status = 'viewed' then 'viewed'
        when new_status = 'credited' then 'credited'
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
      credited_total = new_credited,
      balance = new_balance,
      status = new_status
  where id = p_invoice_id;
end;
$$;

revoke all on function public.recompute_invoice_totals(uuid) from public;
grant execute on function public.recompute_invoice_totals(uuid) to authenticated;

-- Issue a credit note against an existing invoice. Refuses if the invoice is
-- void/cancelled/draft, or if the new credit would exceed what remains
-- creditable (invoice.total minus active credits).
create or replace function public.issue_credit_note(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_reason text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  cust public.customers%rowtype;
  cn_id uuid := gen_random_uuid();
  cn_number text;
  active_credits numeric(12,2);
  creditable numeric(12,2);
  rounded_amount numeric(12,2);
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit note amount must be greater than zero'
      using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 then
    raise exception 'A reason is required for every credit note'
      using errcode = '22023';
  end if;

  select * into inv from public.invoices
    where id = p_invoice_id and deleted_at is null for update;
  if not found then
    raise exception 'Invoice % not found', p_invoice_id using errcode = 'P0002';
  end if;

  if not public.has_org_role(inv.organisation_id, array['owner', 'manager']) then
    raise exception 'Not authorised to issue credit notes' using errcode = '42501';
  end if;

  if inv.status in ('draft', 'cancelled', 'void') then
    raise exception 'Cannot credit a % invoice', inv.status using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into active_credits
  from public.invoice_credit_notes
  where invoice_id = inv.id and deleted_at is null and status <> 'cancelled';

  rounded_amount := round(p_amount, 2);
  creditable := inv.total - active_credits;
  if rounded_amount > creditable + 0.005 then
    raise exception 'Credit note amount % exceeds remaining creditable %',
      rounded_amount, creditable using errcode = '22023';
  end if;

  cn_number := public.allocate_invoice_number(inv.organisation_id);
  cn_number := 'CN-' || cn_number;

  select * into cust from public.customers where id = inv.customer_id;

  insert into public.invoice_credit_notes (
    id, organisation_id, credit_note_number, invoice_id, customer_id,
    customer_name_snapshot, amount, reason, notes, issued_by
  ) values (
    cn_id,
    inv.organisation_id,
    cn_number,
    inv.id,
    inv.customer_id,
    coalesce(cust.full_name, inv.customer_name_snapshot),
    rounded_amount,
    trim(p_reason),
    p_notes,
    p_actor_user_id
  );

  perform public.recompute_invoice_totals(inv.id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail, payload
  ) values (
    inv.organisation_id, inv.id, p_actor_user_id, 'credit_note.issued',
    cn_number || ' issued for £' || rounded_amount::text,
    jsonb_build_object('credit_note_id', cn_id, 'amount', rounded_amount)
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    inv.organisation_id, p_actor_user_id, 'credit_note.issued',
    'invoice_credit_note', cn_id,
    'Credit note ' || cn_number || ' issued against invoice ' || inv.invoice_number,
    jsonb_build_object('amount', rounded_amount, 'invoice_id', inv.id)
  );

  return cn_id;
end;
$$;

revoke all on function public.issue_credit_note(uuid, uuid, numeric, text, text) from public;
grant execute on function public.issue_credit_note(uuid, uuid, numeric, text, text) to authenticated;

-- Record a refund against a credit note. Adds a matching is_refund payment
-- to the parent invoice (so the money side lines up in the invoice's own
-- payments timeline) and marks the credit note as refunded.
create or replace function public.refund_credit_note(
  p_actor_user_id uuid,
  p_credit_note_id uuid,
  p_method text,
  p_reference text default null,
  p_notes text default null,
  p_paid_at timestamptz default now(),
  p_client_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cn public.invoice_credit_notes%rowtype;
  payment_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if p_method is null or p_method not in (
    'cash', 'card', 'bank_transfer', 'finance_provider',
    'payment_link', 'cheque', 'other'
  ) then
    raise exception 'Unsupported refund method: %', p_method using errcode = '22023';
  end if;

  select * into cn from public.invoice_credit_notes
    where id = p_credit_note_id and deleted_at is null for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id using errcode = 'P0002';
  end if;
  if not public.has_org_role(cn.organisation_id, array['owner', 'manager']) then
    raise exception 'Not authorised to refund credit notes' using errcode = '42501';
  end if;
  if cn.status <> 'issued' then
    raise exception 'Credit note is already %', cn.status using errcode = '22023';
  end if;

  -- Reuse the payment RPC's idempotency via client_reference — falling back
  -- to a stable per-credit-note reference so a double-click cannot double-pay.
  insert into public.invoice_payments (
    organisation_id, invoice_id, amount, method, paid_at, reference,
    notes, is_refund, client_reference, recorded_by
  ) values (
    cn.organisation_id, cn.invoice_id, -cn.amount, p_method, p_paid_at,
    coalesce(p_reference, cn.credit_note_number),
    coalesce(p_notes, 'Refund of ' || cn.credit_note_number),
    true,
    coalesce(p_client_reference, 'credit-note-refund:' || cn.id::text),
    p_actor_user_id
  ) on conflict (organisation_id, invoice_id, client_reference)
    do update set updated_at = now()
    returning id into payment_id;

  update public.invoice_credit_notes
  set status = 'refunded',
      refunded_at = now(),
      refunded_payment_id = payment_id
  where id = cn.id;

  perform public.recompute_invoice_totals(cn.invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail, payload
  ) values (
    cn.organisation_id, cn.invoice_id, p_actor_user_id, 'credit_note.refunded',
    cn.credit_note_number || ' refunded via ' || p_method,
    jsonb_build_object('credit_note_id', cn.id, 'payment_id', payment_id)
  );

  return payment_id;
end;
$$;

revoke all on function public.refund_credit_note(uuid, uuid, text, text, text, timestamptz, text) from public;
grant execute on function public.refund_credit_note(uuid, uuid, text, text, text, timestamptz, text) to authenticated;

-- Cancel a credit note that has not been refunded. This restores the
-- invoice balance to what it was before the credit was issued.
create or replace function public.cancel_credit_note(
  p_actor_user_id uuid,
  p_credit_note_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cn public.invoice_credit_notes%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into cn from public.invoice_credit_notes
    where id = p_credit_note_id and deleted_at is null for update;
  if not found then
    raise exception 'Credit note % not found', p_credit_note_id using errcode = 'P0002';
  end if;
  if not public.has_org_role(cn.organisation_id, array['owner', 'manager']) then
    raise exception 'Not authorised to cancel credit notes' using errcode = '42501';
  end if;
  if cn.status <> 'issued' then
    raise exception 'Cannot cancel a % credit note (only issued credit notes can be cancelled; refunds must be reversed separately)',
      cn.status using errcode = '22023';
  end if;

  update public.invoice_credit_notes
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_actor_user_id,
      cancelled_reason = nullif(trim(p_reason), '')
  where id = cn.id;

  perform public.recompute_invoice_totals(cn.invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    cn.organisation_id, cn.invoice_id, p_actor_user_id, 'credit_note.cancelled',
    cn.credit_note_number || ' cancelled' ||
      case when p_reason is not null then ' — ' || p_reason else '' end
  );
end;
$$;

revoke all on function public.cancel_credit_note(uuid, uuid, text) from public;
grant execute on function public.cancel_credit_note(uuid, uuid, text) to authenticated;

-- Void an issued invoice. Only allowed when no payments and no credit notes
-- have been recorded — otherwise the correct flow is to credit + refund.
create or replace function public.void_invoice(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  active_credits integer;
  positive_payments numeric;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 2 then
    raise exception 'A reason is required to void an invoice'
      using errcode = '22023';
  end if;

  select * into inv from public.invoices
    where id = p_invoice_id and deleted_at is null for update;
  if not found then
    raise exception 'Invoice % not found', p_invoice_id using errcode = 'P0002';
  end if;
  if not public.has_org_role(inv.organisation_id, array['owner', 'manager']) then
    raise exception 'Not authorised to void invoices' using errcode = '42501';
  end if;
  if inv.status in ('cancelled', 'void') then
    raise exception 'Invoice is already %', inv.status using errcode = '22023';
  end if;

  select count(*) into active_credits from public.invoice_credit_notes
  where invoice_id = inv.id and deleted_at is null and status <> 'cancelled';
  if active_credits > 0 then
    raise exception 'Cancel active credit notes before voiding the invoice'
      using errcode = '22023';
  end if;

  select coalesce(sum(amount) filter (where amount > 0), 0)
  into positive_payments
  from public.invoice_payments
  where invoice_id = inv.id and deleted_at is null;
  if positive_payments > 0 then
    raise exception 'Refund payments received before voiding — issue a credit note instead'
      using errcode = '22023';
  end if;

  update public.invoices
  set status = 'void',
      cancelled_at = now(),
      cancelled_by = p_actor_user_id,
      cancelled_reason = trim(p_reason)
  where id = inv.id;

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    inv.organisation_id, inv.id, p_actor_user_id, 'invoice.voided',
    'Voided — ' || trim(p_reason)
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    inv.organisation_id, p_actor_user_id, 'invoice.voided', 'invoice', inv.id,
    'Invoice ' || inv.invoice_number || ' voided',
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

revoke all on function public.void_invoice(uuid, uuid, text) from public;
grant execute on function public.void_invoice(uuid, uuid, text) to authenticated;

commit;
