begin;

-- General invoices are deliberately implemented as transactional RPCs. Staff
-- never write invoice rows or line items directly, and edits retain an
-- activity/audit trail.

alter table public.invoices
  add column if not exists invoice_title text,
  add column if not exists show_vat boolean not null default true,
  add column if not exists show_payment_details boolean not null default true;

alter table public.invoice_line_items
  drop constraint if exists invoice_line_items_vat_treatment_check;

alter table public.invoice_line_items
  add constraint invoice_line_items_vat_treatment_check
  check (vat_treatment in ('standard', 'margin', 'zero', 'exempt', 'not_registered'));

create or replace function public.create_general_invoice(
  p_actor_user_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_org uuid;
  cust public.customers%rowtype;
  vehicle public.vehicles%rowtype;
  settings public.dealership_settings%rowtype;
  invoice_id uuid := gen_random_uuid();
  invoice_number text;
  invoice_status text := coalesce(p_input ->> 'status', 'draft');
  invoice_type text := coalesce(p_input ->> 'type', 'general');
  vat_treatment text := coalesce(p_input ->> 'vat_treatment', 'standard');
  entry record;
  item_type text;
  item_vat_rate numeric(5,2);
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select organisation_id into member_org
  from public.organisation_members
  where user_id = p_actor_user_id
    and is_active = true
    and role in ('owner', 'manager', 'salesperson')
  order by joined_at asc nulls last
  limit 1;

  if member_org is null then
    raise exception 'Not authorised to create invoices' using errcode = '42501';
  end if;
  if invoice_status not in ('draft', 'sent') then
    raise exception 'A new invoice must be draft or sent' using errcode = '22023';
  end if;
  if invoice_type not in ('general', 'pro_forma', 'vat') then
    raise exception 'Unsupported general invoice type' using errcode = '22023';
  end if;
  if vat_treatment not in ('standard', 'zero', 'exempt', 'not_registered') then
    raise exception 'Unsupported VAT treatment' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_input -> 'line_items', '[]'::jsonb)) = 0 then
    raise exception 'At least one invoice item is required' using errcode = '22023';
  end if;

  select * into cust
  from public.customers
  where id = (p_input ->> 'customer_id')::uuid
    and organisation_id = member_org
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  if nullif(p_input ->> 'vehicle_id', '') is not null then
    select * into vehicle
    from public.vehicles
    where id = (p_input ->> 'vehicle_id')::uuid
      and organisation_id = member_org
      and deleted_at is null;
    if not found then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
  end if;

  select * into settings
  from public.dealership_settings
  where organisation_id = member_org;

  invoice_number := public.allocate_invoice_number(member_org);

  insert into public.invoices (
    id, organisation_id, invoice_number, invoice_title, type, status,
    customer_id, customer_name_snapshot, customer_email_snapshot,
    customer_phone_snapshot, billing_address_snapshot,
    vehicle_id, vehicle_registration_snapshot, vehicle_description_snapshot,
    issued_at, due_at, vat_treatment, vat_registration_snapshot,
    show_vat, show_payment_details, notes, terms, created_by, issued_by
  )
  values (
    invoice_id,
    member_org,
    invoice_number,
    nullif(trim(p_input ->> 'title'), ''),
    invoice_type,
    invoice_status,
    cust.id,
    coalesce(cust.full_name, trim(concat_ws(' ', cust.first_name, cust.last_name))),
    cust.email,
    cust.phone,
    coalesce(cust.address, '{}'::jsonb),
    vehicle.id,
    vehicle.registration,
    nullif(trim(concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model)), ''),
    case
      when invoice_status = 'sent'
        then coalesce((p_input ->> 'issued_at')::timestamptz, now())
      else null
    end,
    nullif(p_input ->> 'due_at', '')::timestamptz,
    vat_treatment,
    settings.vat_number,
    coalesce((p_input ->> 'show_vat')::boolean, true),
    coalesce((p_input ->> 'show_payment_details')::boolean, true),
    nullif(trim(p_input ->> 'notes'), ''),
    nullif(trim(p_input ->> 'terms'), ''),
    p_actor_user_id,
    case when invoice_status = 'sent' then p_actor_user_id else null end
  );

  for entry in
    select value as item, ordinality as sort_order
    from jsonb_array_elements(p_input -> 'line_items') with ordinality
  loop
    item_type := coalesce(entry.item ->> 'item_type', 'charge');
    if item_type not in ('charge', 'labour', 'part', 'fee', 'discount', 'note') then
      raise exception 'Unsupported invoice item type' using errcode = '22023';
    end if;
    item_vat_rate := case
      when item_type in ('discount', 'note') then 0
      when vat_treatment in ('zero', 'exempt', 'not_registered') then 0
      when coalesce((p_input ->> 'show_vat')::boolean, true) = false then 0
      else coalesce((entry.item ->> 'vat_rate')::numeric, 20)
    end;

    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org,
      invoice_id,
      entry.sort_order - 1,
      item_type,
      trim(entry.item ->> 'description'),
      coalesce((entry.item ->> 'quantity')::numeric, 1),
      coalesce((entry.item ->> 'unit_price')::numeric, 0),
      item_vat_rate,
      vat_treatment,
      'other'
    );
  end loop;

  perform public.recompute_invoice_totals(invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    member_org, invoice_id, p_actor_user_id, 'invoice.created',
    'General invoice ' || invoice_number || ' created'
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    member_org, p_actor_user_id, 'invoice.created', 'invoice', invoice_id,
    'General invoice ' || invoice_number || ' created',
    jsonb_build_object('invoice_number', invoice_number, 'status', invoice_status)
  );

  return invoice_id;
end;
$$;

revoke all on function public.create_general_invoice(uuid, jsonb) from public;
grant execute on function public.create_general_invoice(uuid, jsonb) to authenticated;

create or replace function public.update_general_invoice(
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_input jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  cust public.customers%rowtype;
  vehicle public.vehicles%rowtype;
  invoice_status text := coalesce(p_input ->> 'status', 'draft');
  vat_treatment text := coalesce(p_input ->> 'vat_treatment', 'standard');
  entry record;
  item_type text;
  item_vat_rate numeric(5,2);
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into inv
  from public.invoices
  where id = p_invoice_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if not public.has_org_role(inv.organisation_id, array['owner', 'manager', 'salesperson']) then
    raise exception 'Not authorised to edit invoices' using errcode = '42501';
  end if;
  if inv.type not in ('general', 'pro_forma', 'vat') then
    raise exception 'Only general invoices can be edited here' using errcode = '22023';
  end if;
  if inv.status in ('paid', 'partially_paid', 'credited', 'void', 'cancelled', 'refunded') then
    raise exception 'This invoice can no longer be edited' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.invoice_payments
    where invoice_id = inv.id and deleted_at is null
  ) or exists (
    select 1 from public.invoice_credit_notes
    where invoice_id = inv.id and deleted_at is null and status <> 'cancelled'
  ) then
    raise exception 'Invoices with payments or credits cannot be edited' using errcode = '22023';
  end if;
  if invoice_status not in ('draft', 'sent') then
    raise exception 'Invoice status must be draft or sent' using errcode = '22023';
  end if;
  if vat_treatment not in ('standard', 'zero', 'exempt', 'not_registered') then
    raise exception 'Unsupported VAT treatment' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_input -> 'line_items', '[]'::jsonb)) = 0 then
    raise exception 'At least one invoice item is required' using errcode = '22023';
  end if;

  select * into cust
  from public.customers
  where id = (p_input ->> 'customer_id')::uuid
    and organisation_id = inv.organisation_id
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  if nullif(p_input ->> 'vehicle_id', '') is not null then
    select * into vehicle
    from public.vehicles
    where id = (p_input ->> 'vehicle_id')::uuid
      and organisation_id = inv.organisation_id
      and deleted_at is null;
    if not found then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
  end if;

  update public.invoices
  set invoice_title = nullif(trim(p_input ->> 'title'), ''),
      status = invoice_status,
      customer_id = cust.id,
      customer_name_snapshot = coalesce(
        cust.full_name,
        trim(concat_ws(' ', cust.first_name, cust.last_name))
      ),
      customer_email_snapshot = cust.email,
      customer_phone_snapshot = cust.phone,
      billing_address_snapshot = coalesce(cust.address, '{}'::jsonb),
      vehicle_id = vehicle.id,
      vehicle_registration_snapshot = vehicle.registration,
      vehicle_description_snapshot = nullif(
        trim(concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model)),
        ''
      ),
      issued_at = case
        when invoice_status = 'sent'
          then coalesce(inv.issued_at, (p_input ->> 'issued_at')::timestamptz, now())
        else null
      end,
      issued_by = case when invoice_status = 'sent' then p_actor_user_id else null end,
      due_at = nullif(p_input ->> 'due_at', '')::timestamptz,
      vat_treatment = vat_treatment,
      show_vat = coalesce((p_input ->> 'show_vat')::boolean, true),
      show_payment_details = coalesce(
        (p_input ->> 'show_payment_details')::boolean,
        true
      ),
      notes = nullif(trim(p_input ->> 'notes'), ''),
      terms = nullif(trim(p_input ->> 'terms'), '')
  where id = inv.id;

  update public.invoice_line_items
  set deleted_at = now()
  where invoice_id = inv.id and deleted_at is null;

  for entry in
    select value as item, ordinality as sort_order
    from jsonb_array_elements(p_input -> 'line_items') with ordinality
  loop
    item_type := coalesce(entry.item ->> 'item_type', 'charge');
    if item_type not in ('charge', 'labour', 'part', 'fee', 'discount', 'note') then
      raise exception 'Unsupported invoice item type' using errcode = '22023';
    end if;
    item_vat_rate := case
      when item_type in ('discount', 'note') then 0
      when vat_treatment in ('zero', 'exempt', 'not_registered') then 0
      when coalesce((p_input ->> 'show_vat')::boolean, true) = false then 0
      else coalesce((entry.item ->> 'vat_rate')::numeric, 20)
    end;

    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      inv.organisation_id,
      inv.id,
      entry.sort_order - 1,
      item_type,
      trim(entry.item ->> 'description'),
      coalesce((entry.item ->> 'quantity')::numeric, 1),
      coalesce((entry.item ->> 'unit_price')::numeric, 0),
      item_vat_rate,
      vat_treatment,
      'other'
    );
  end loop;

  perform public.recompute_invoice_totals(inv.id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    inv.organisation_id, inv.id, p_actor_user_id, 'invoice.updated',
    'Invoice details and line items updated'
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    inv.organisation_id, p_actor_user_id, 'invoice.updated', 'invoice', inv.id,
    'General invoice ' || inv.invoice_number || ' updated',
    jsonb_build_object('status', invoice_status, 'title', p_input ->> 'title')
  );
end;
$$;

revoke all on function public.update_general_invoice(uuid, uuid, jsonb) from public;
grant execute on function public.update_general_invoice(uuid, uuid, jsonb) to authenticated;

commit;
