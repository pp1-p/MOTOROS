begin;

-- =============================================================================
-- MOTOR.OS standalone repair invoice
--
-- Adds:
--  * repair_details jsonb column on invoices for repair-specific narrative
--    fields (reported fault, diagnosis, work completed, tech notes,
--    recommendations, warranty) and the vehicle snapshot when the invoice is
--    not tied to a stock/customer vehicle row.
--  * create_standalone_repair_invoice(actor, input) RPC that mirrors the
--    general-invoice creator but forces type = 'repair' and accepts the
--    repair-specific narrative + free-form vehicle details.
-- =============================================================================

alter table public.invoices
  add column if not exists repair_details jsonb;

comment on column public.invoices.repair_details is
  'Repair-invoice specific fields: reported_fault, diagnosis, work_completed, technician_notes, recommendations, warranty, vehicle {registration, vin, make, model, year, mileage}';

create or replace function public.create_standalone_repair_invoice(
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
  vat_treatment text := coalesce(p_input ->> 'vat_treatment', 'standard');
  entry record;
  item_type text;
  item_vat_rate numeric(5,2);
  vehicle_snapshot jsonb := coalesce(p_input -> 'vehicle_snapshot', '{}'::jsonb);
  vehicle_description text;
  vehicle_registration text;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select organisation_id into member_org
  from public.organisation_members
  where user_id = p_actor_user_id
    and is_active = true
    and role in ('owner', 'manager', 'service_advisor', 'salesperson')
  order by joined_at asc nulls last
  limit 1;

  if member_org is null then
    raise exception 'Not authorised to create repair invoices' using errcode = '42501';
  end if;
  if invoice_status not in ('draft', 'sent') then
    raise exception 'A new invoice must be draft or sent' using errcode = '22023';
  end if;
  if vat_treatment not in ('standard', 'margin', 'zero', 'exempt', 'not_registered') then
    raise exception 'Unsupported VAT treatment' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_input -> 'line_items', '[]'::jsonb)) = 0 then
    raise exception 'At least one repair line is required' using errcode = '22023';
  end if;

  select * into cust
  from public.customers
  where id = (p_input ->> 'customer_id')::uuid
    and organisation_id = member_org
    and deleted_at is null;
  if not found then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;

  -- Optional link to a stock vehicle; otherwise we rely on the snapshot.
  if nullif(p_input ->> 'vehicle_id', '') is not null then
    select * into vehicle
    from public.vehicles
    where id = (p_input ->> 'vehicle_id')::uuid
      and organisation_id = member_org
      and deleted_at is null;
    if not found then
      raise exception 'Vehicle not found' using errcode = 'P0002';
    end if;
    vehicle_registration := vehicle.registration;
    vehicle_description := nullif(
      trim(concat_ws(' ', vehicle.year::text, vehicle.make, vehicle.model)), '');
  else
    vehicle_registration := nullif(trim(vehicle_snapshot ->> 'registration'), '');
    vehicle_description := nullif(
      trim(concat_ws(' ',
        vehicle_snapshot ->> 'year',
        vehicle_snapshot ->> 'make',
        vehicle_snapshot ->> 'model')),
      '');
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
    show_vat, show_payment_details, notes, terms, repair_details,
    created_by, issued_by
  )
  values (
    invoice_id,
    member_org,
    invoice_number,
    nullif(trim(p_input ->> 'title'), ''),
    'repair',
    invoice_status,
    cust.id,
    coalesce(cust.full_name, trim(concat_ws(' ', cust.first_name, cust.last_name))),
    cust.email,
    cust.phone,
    coalesce(cust.address, '{}'::jsonb),
    vehicle.id,
    vehicle_registration,
    vehicle_description,
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
    jsonb_strip_nulls(jsonb_build_object(
      'reported_fault', nullif(trim(p_input ->> 'reported_fault'), ''),
      'diagnosis', nullif(trim(p_input ->> 'diagnosis'), ''),
      'work_completed', nullif(trim(p_input ->> 'work_completed'), ''),
      'technician_notes', nullif(trim(p_input ->> 'technician_notes'), ''),
      'recommendations', nullif(trim(p_input ->> 'recommendations'), ''),
      'warranty', nullif(trim(p_input ->> 'warranty'), ''),
      'vehicle', case
        when vehicle_snapshot = '{}'::jsonb then null
        else vehicle_snapshot
      end
    )),
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
      quantity, unit_price, vat_rate, vat_treatment, source_type, source_id
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
      case when nullif(entry.item ->> 'repair_code_id', '') is not null
        then 'repair_code' else 'other' end,
      nullif(entry.item ->> 'repair_code_id', '')::uuid
    );
  end loop;

  perform public.recompute_invoice_totals(invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    member_org, invoice_id, p_actor_user_id, 'invoice.created',
    'Repair invoice ' || invoice_number || ' created'
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    member_org, p_actor_user_id, 'invoice.created', 'invoice', invoice_id,
    'Repair invoice ' || invoice_number || ' created',
    jsonb_build_object('invoice_number', invoice_number, 'status', invoice_status, 'type', 'repair')
  );

  return invoice_id;
end;
$$;

revoke all on function public.create_standalone_repair_invoice(uuid, jsonb) from public;
grant execute on function public.create_standalone_repair_invoice(uuid, jsonb) to authenticated;

commit;
