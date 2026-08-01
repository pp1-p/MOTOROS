begin;

-- =============================================================================
-- MOTOR.OS invoice narrative edits
--
-- Two RPCs that let staff correct the type-specific narrative on a repair or
-- vehicle-sale invoice without opening the whole line-item flow. Totals,
-- VAT, customer, vehicle links and line items are untouched — only the
-- jsonb blobs (repair_details / sale_details) and the shared notes / terms
-- fields are updated.
--
-- Allowed on any status except cancelled / void (edits are cosmetic and
-- don't affect posted amounts). Both RPCs write to invoice_activity and
-- audit_logs so the change is traceable.
-- =============================================================================

create or replace function public.update_repair_invoice_narrative(
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
  existing jsonb;
  merged jsonb;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into inv
  from public.invoices
  where id = p_invoice_id and deleted_at is null;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.type <> 'repair' then
    raise exception 'Not a repair invoice' using errcode = '22023';
  end if;
  if inv.status in ('cancelled', 'void') then
    raise exception 'Cancelled or void invoices cannot be edited'
      using errcode = '22023';
  end if;

  if not public.has_org_role(
    inv.organisation_id,
    array['owner', 'manager', 'service_advisor']
  ) then
    raise exception 'Not authorised to edit this invoice' using errcode = '42501';
  end if;

  existing := coalesce(inv.repair_details, '{}'::jsonb);
  merged := jsonb_strip_nulls(
    existing || jsonb_build_object(
      'reported_fault',    nullif(trim(p_input ->> 'reported_fault'), ''),
      'diagnosis',         nullif(trim(p_input ->> 'diagnosis'), ''),
      'work_completed',    nullif(trim(p_input ->> 'work_completed'), ''),
      'technician_notes',  nullif(trim(p_input ->> 'technician_notes'), ''),
      'recommendations',   nullif(trim(p_input ->> 'recommendations'), ''),
      'warranty',          nullif(trim(p_input ->> 'warranty'), '')
    )
  );

  update public.invoices
  set repair_details = merged,
      notes = nullif(trim(p_input ->> 'notes'), ''),
      terms = nullif(trim(p_input ->> 'terms'), ''),
      updated_at = now()
  where id = p_invoice_id;

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    inv.organisation_id, p_invoice_id, p_actor_user_id,
    'invoice.narrative_updated',
    'Repair narrative updated on ' || inv.invoice_number
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    inv.organisation_id, p_actor_user_id, 'invoice.narrative_updated',
    'invoice', p_invoice_id,
    'Repair narrative updated on ' || inv.invoice_number,
    jsonb_build_object('invoice_number', inv.invoice_number, 'type', 'repair')
  );
end;
$$;

revoke all on function public.update_repair_invoice_narrative(uuid, uuid, jsonb) from public;
grant execute on function public.update_repair_invoice_narrative(uuid, uuid, jsonb) to authenticated;


create or replace function public.update_sale_invoice_details(
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
  existing jsonb;
  part_exchange jsonb;
  merged jsonb;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select * into inv
  from public.invoices
  where id = p_invoice_id and deleted_at is null;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.type <> 'vehicle_sale' then
    raise exception 'Not a vehicle sale invoice' using errcode = '22023';
  end if;
  if inv.status in ('cancelled', 'void') then
    raise exception 'Cancelled or void invoices cannot be edited'
      using errcode = '22023';
  end if;

  if not public.has_org_role(
    inv.organisation_id,
    array['owner', 'manager', 'salesperson']
  ) then
    raise exception 'Not authorised to edit this invoice' using errcode = '42501';
  end if;

  existing := coalesce(inv.sale_details, '{}'::jsonb);

  part_exchange := jsonb_strip_nulls(jsonb_build_object(
    'description',   nullif(trim(p_input #>> '{part_exchange,description}'), ''),
    'allowance',     nullif(p_input #>> '{part_exchange,allowance}', '')::numeric,
    'registration',  nullif(trim(p_input #>> '{part_exchange,registration}'), ''),
    'mileage',       nullif(p_input #>> '{part_exchange,mileage}', '')
  ));

  merged := jsonb_strip_nulls(
    existing || jsonb_build_object(
      'warranty_terms',      nullif(trim(p_input ->> 'warranty_terms'), ''),
      'payment_method_note', nullif(trim(p_input ->> 'payment_method_note'), ''),
      'part_exchange',       case when part_exchange = '{}'::jsonb then null else part_exchange end
    )
  );

  update public.invoices
  set sale_details = merged,
      notes = nullif(trim(p_input ->> 'notes'), ''),
      terms = nullif(trim(p_input ->> 'terms'), ''),
      updated_at = now()
  where id = p_invoice_id;

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    inv.organisation_id, p_invoice_id, p_actor_user_id,
    'invoice.narrative_updated',
    'Sale details updated on ' || inv.invoice_number
  );

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    inv.organisation_id, p_actor_user_id, 'invoice.narrative_updated',
    'invoice', p_invoice_id,
    'Sale details updated on ' || inv.invoice_number,
    jsonb_build_object('invoice_number', inv.invoice_number, 'type', 'vehicle_sale')
  );
end;
$$;

revoke all on function public.update_sale_invoice_details(uuid, uuid, jsonb) from public;
grant execute on function public.update_sale_invoice_details(uuid, uuid, jsonb) to authenticated;

commit;
