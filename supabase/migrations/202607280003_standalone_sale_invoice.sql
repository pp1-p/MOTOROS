begin;

-- =============================================================================
-- MOTOR.OS standalone vehicle-sale invoice
--
-- Adds:
--  * sale_details jsonb column on invoices for sale-specific narrative and
--    reference fields (part-exchange summary, payment method, warranty
--    terms, vehicle snapshot when not linked to a stock vehicle row).
--  * create_standalone_sale_invoice(actor, input) RPC that mirrors the
--    existing create_sale_invoice but doesn't require a prior sales row.
--    Accepts sale_price, deposit_paid, part_exchange allowance, warranty
--    price, delivery/admin/prep fees and additional products, then builds
--    invoice line items in the same shape as create_sale_invoice. Deposit
--    is recorded as an invoice_payments row so the balance is correct.
-- =============================================================================

alter table public.invoices
  add column if not exists sale_details jsonb;

comment on column public.invoices.sale_details is
  'Vehicle-sale invoice specific fields: warranty_terms, payment_method_note, part_exchange {description, allowance}, deposit_paid, vehicle {registration, vin, make, model, year, mileage}';

create or replace function public.create_standalone_sale_invoice(
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
  vat_treatment text := coalesce(p_input ->> 'vat_treatment', 'margin');
  vat_rate numeric(5,2);
  sale_price numeric := coalesce((p_input ->> 'sale_price')::numeric, 0);
  deposit_paid numeric := coalesce((p_input ->> 'deposit_paid')::numeric, 0);
  warranty_price numeric := coalesce((p_input ->> 'warranty_price')::numeric, 0);
  delivery_fee numeric := coalesce((p_input ->> 'delivery_fee')::numeric, 0);
  admin_fee numeric := coalesce((p_input ->> 'admin_fee')::numeric, 0);
  preparation_fee numeric := coalesce((p_input ->> 'preparation_fee')::numeric, 0);
  part_exchange jsonb := coalesce(p_input -> 'part_exchange', '{}'::jsonb);
  px_allowance numeric := coalesce((part_exchange ->> 'allowance')::numeric, 0);
  extra_products jsonb := coalesce(p_input -> 'additional_products', '[]'::jsonb);
  sort_cursor int := 0;
  vehicle_snapshot jsonb := coalesce(p_input -> 'vehicle_snapshot', '{}'::jsonb);
  vehicle_description text;
  vehicle_registration text;
  vehicle_line_title text;
  payment_method text;
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
    raise exception 'Not authorised to create sale invoices' using errcode = '42501';
  end if;
  if invoice_status not in ('draft', 'sent') then
    raise exception 'A new invoice must be draft or sent' using errcode = '22023';
  end if;
  if vat_treatment not in ('standard', 'margin', 'zero', 'exempt', 'not_registered') then
    raise exception 'Unsupported VAT treatment' using errcode = '22023';
  end if;
  if sale_price <= 0 then
    raise exception 'Sale price must be greater than zero' using errcode = '22023';
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

  vehicle_line_title := coalesce(vehicle_description, 'Vehicle sale');
  if vehicle_registration is not null then
    vehicle_line_title := vehicle_line_title || ' — ' || vehicle_registration;
  end if;

  vat_rate := case
    when vat_treatment in ('zero', 'exempt', 'not_registered') then 0
    else coalesce((p_input ->> 'vat_rate')::numeric, 20)
  end;

  select * into settings
  from public.dealership_settings
  where organisation_id = member_org;

  invoice_number := public.allocate_invoice_number(member_org);
  payment_method := nullif(trim(p_input ->> 'payment_method_note'), '');

  insert into public.invoices (
    id, organisation_id, invoice_number, invoice_title, type, status,
    customer_id, customer_name_snapshot, customer_email_snapshot,
    customer_phone_snapshot, billing_address_snapshot,
    vehicle_id, vehicle_registration_snapshot, vehicle_description_snapshot,
    issued_at, due_at, vat_treatment, vat_registration_snapshot,
    show_vat, show_payment_details, notes, terms, sale_details,
    created_by, issued_by
  )
  values (
    invoice_id,
    member_org,
    invoice_number,
    nullif(trim(p_input ->> 'title'), ''),
    'vehicle_sale',
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
    coalesce((p_input ->> 'show_vat')::boolean, vat_treatment = 'standard'),
    coalesce((p_input ->> 'show_payment_details')::boolean, true),
    nullif(trim(p_input ->> 'notes'), ''),
    nullif(trim(p_input ->> 'terms'), ''),
    jsonb_strip_nulls(jsonb_build_object(
      'warranty_terms', nullif(trim(p_input ->> 'warranty_terms'), ''),
      'payment_method_note', payment_method,
      'part_exchange', case
        when part_exchange = '{}'::jsonb then null
        else part_exchange
      end,
      'deposit_paid', case when deposit_paid > 0 then deposit_paid else null end,
      'vehicle', case
        when vehicle_snapshot = '{}'::jsonb then null
        else vehicle_snapshot
      end
    )),
    p_actor_user_id,
    case when invoice_status = 'sent' then p_actor_user_id else null end
  );

  -- Line 1: vehicle sale price
  sort_cursor := sort_cursor + 1;
  insert into public.invoice_line_items (
    organisation_id, invoice_id, sort_order, item_type, description,
    quantity, unit_price, vat_rate, vat_treatment, source_type
  )
  values (
    member_org, invoice_id, sort_cursor - 1, 'charge', vehicle_line_title,
    1, sale_price,
    case when vat_treatment = 'margin' then 0 else vat_rate end,
    vat_treatment, 'vehicle'
  );

  if warranty_price > 0 then
    sort_cursor := sort_cursor + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org, invoice_id, sort_cursor - 1, 'fee', 'Extended warranty',
      1, warranty_price, vat_rate, vat_treatment, 'warranty'
    );
  end if;

  if preparation_fee > 0 then
    sort_cursor := sort_cursor + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org, invoice_id, sort_cursor - 1, 'fee', 'Vehicle preparation',
      1, preparation_fee, vat_rate, vat_treatment, 'preparation'
    );
  end if;

  if delivery_fee > 0 then
    sort_cursor := sort_cursor + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org, invoice_id, sort_cursor - 1, 'fee', 'Delivery',
      1, delivery_fee, vat_rate, vat_treatment, 'delivery'
    );
  end if;

  if admin_fee > 0 then
    sort_cursor := sort_cursor + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org, invoice_id, sort_cursor - 1, 'fee', 'Administration fee',
      1, admin_fee, vat_rate, vat_treatment, 'admin_fee'
    );
  end if;

  if jsonb_typeof(extra_products) = 'array' then
    declare
      product jsonb;
      p_name text;
      p_qty numeric;
      p_price numeric;
      p_vat numeric;
    begin
      for product in select value from jsonb_array_elements(extra_products)
      loop
        p_name := trim(product ->> 'name');
        if p_name is null or p_name = '' then continue; end if;
        p_qty := coalesce((product ->> 'quantity')::numeric, 1);
        p_price := coalesce((product ->> 'price')::numeric, 0);
        p_vat := coalesce((product ->> 'vat_rate')::numeric, vat_rate);
        sort_cursor := sort_cursor + 1;
        insert into public.invoice_line_items (
          organisation_id, invoice_id, sort_order, item_type, description,
          quantity, unit_price, vat_rate, vat_treatment, source_type
        )
        values (
          member_org, invoice_id, sort_cursor - 1, 'fee', p_name,
          p_qty, p_price, p_vat, vat_treatment, 'additional_product'
        );
      end loop;
    end;
  end if;

  if px_allowance > 0 then
    sort_cursor := sort_cursor + 1;
    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment, source_type
    )
    values (
      member_org, invoice_id, sort_cursor - 1, 'discount',
      coalesce(nullif(trim(part_exchange ->> 'description'), ''),
               'Part-exchange allowance'),
      1, px_allowance, 0, vat_treatment, 'part_exchange'
    );
  end if;

  perform public.recompute_invoice_totals(invoice_id);

  -- Record the deposit as a payment so the balance reflects it correctly.
  if deposit_paid > 0 then
    insert into public.invoice_payments (
      organisation_id, invoice_id, amount, method, paid_at, notes,
      recorded_by
    )
    values (
      member_org, invoice_id, deposit_paid,
      coalesce(nullif(trim(p_input ->> 'deposit_method'), ''), 'deposit_transfer'),
      now(),
      'Deposit received at sale creation',
      p_actor_user_id
    );
    perform public.recompute_invoice_totals(invoice_id);
  end if;

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    member_org, invoice_id, p_actor_user_id, 'invoice.created',
    'Vehicle sale invoice ' || invoice_number || ' created'
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    member_org, p_actor_user_id, 'invoice.created', 'invoice', invoice_id,
    'Vehicle sale invoice ' || invoice_number || ' created',
    jsonb_build_object('invoice_number', invoice_number, 'status', invoice_status, 'type', 'vehicle_sale')
  );

  return invoice_id;
end;
$$;

revoke all on function public.create_standalone_sale_invoice(uuid, jsonb) from public;
grant execute on function public.create_standalone_sale_invoice(uuid, jsonb) to authenticated;

commit;
