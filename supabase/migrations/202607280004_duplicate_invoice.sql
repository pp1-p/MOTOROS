begin;

-- =============================================================================
-- MOTOR.OS duplicate invoice
--
-- Copies a source invoice into a new draft: same customer, vehicle,
-- type-specific detail blobs (repair_details / sale_details), line items,
-- notes and terms. Allocates a fresh invoice number, resets payments,
-- credit notes and issued/paid state. Returns the new invoice id.
-- =============================================================================

create or replace function public.duplicate_invoice(
  p_actor_user_id uuid,
  p_source_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.invoices%rowtype;
  new_invoice_id uuid := gen_random_uuid();
  new_invoice_number text;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into source
  from public.invoices
  where id = p_source_invoice_id
    and deleted_at is null;
  if not found then
    raise exception 'Source invoice not found' using errcode = 'P0002';
  end if;

  if not public.has_org_role(
    source.organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  ) then
    raise exception 'Not authorised to duplicate this invoice' using errcode = '42501';
  end if;

  new_invoice_number := public.allocate_invoice_number(source.organisation_id);

  insert into public.invoices (
    id, organisation_id, invoice_number, invoice_title, type, status,
    customer_id, customer_name_snapshot, customer_email_snapshot,
    customer_phone_snapshot, billing_address_snapshot,
    vehicle_id, vehicle_registration_snapshot, vehicle_description_snapshot,
    issued_at, due_at, vat_treatment, vat_registration_snapshot,
    show_vat, show_payment_details, notes, terms,
    repair_details, sale_details,
    created_by
  )
  values (
    new_invoice_id,
    source.organisation_id,
    new_invoice_number,
    case
      when source.invoice_title is not null
        then source.invoice_title || ' (copy)'
      else null
    end,
    source.type,
    'draft',
    source.customer_id,
    source.customer_name_snapshot,
    source.customer_email_snapshot,
    source.customer_phone_snapshot,
    source.billing_address_snapshot,
    source.vehicle_id,
    source.vehicle_registration_snapshot,
    source.vehicle_description_snapshot,
    null,
    null,
    source.vat_treatment,
    source.vat_registration_snapshot,
    source.show_vat,
    source.show_payment_details,
    source.notes,
    source.terms,
    source.repair_details,
    source.sale_details,
    p_actor_user_id
  );

  insert into public.invoice_line_items (
    organisation_id, invoice_id, sort_order, item_type, description,
    quantity, unit_price, vat_rate, discount_amount, vat_treatment,
    source_type, source_id
  )
  select
    organisation_id, new_invoice_id, sort_order, item_type, description,
    quantity, unit_price, vat_rate, discount_amount, vat_treatment,
    source_type, source_id
  from public.invoice_line_items
  where invoice_id = p_source_invoice_id
    and deleted_at is null
  order by sort_order;

  perform public.recompute_invoice_totals(new_invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    source.organisation_id, new_invoice_id, p_actor_user_id,
    'invoice.duplicated',
    'Duplicated from ' || source.invoice_number ||
      ' as ' || new_invoice_number
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    source.organisation_id, p_actor_user_id, 'invoice.duplicated',
    'invoice', new_invoice_id,
    'Duplicated invoice ' || source.invoice_number,
    jsonb_build_object(
      'source_invoice_id', p_source_invoice_id,
      'new_invoice_id', new_invoice_id,
      'new_invoice_number', new_invoice_number
    )
  );

  return new_invoice_id;
end;
$$;

revoke all on function public.duplicate_invoice(uuid, uuid) from public;
grant execute on function public.duplicate_invoice(uuid, uuid) to authenticated;

commit;
