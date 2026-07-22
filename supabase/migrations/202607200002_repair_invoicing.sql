begin;

-- =============================================================================
-- MOTOR.OS repair invoicing (Phase 2)
--
-- Builds on the Phase 1 invoicing tables. Adds a RPC that creates either a
-- final repair invoice or an estimate/pro-forma directly from a repair job,
-- copying its repair_job_items across as invoice line items with their VAT
-- rates preserved. Multiple pro-formas can coexist (they are revisions of the
-- estimate); only one active final invoice per job is allowed.
--
-- When a final invoice is issued the parent repair_job flips its
-- payment_status to 'invoice_due' so the workshop dashboard reflects the
-- money side of the job.
-- =============================================================================

create or replace function public.create_repair_invoice(
  p_actor_user_id uuid,
  p_repair_job_id uuid,
  p_options jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.repair_jobs%rowtype;
  cust public.customers%rowtype;
  cvehicle public.customer_vehicles%rowtype;
  settings public.dealership_settings%rowtype;
  invoice_id uuid := gen_random_uuid();
  invoice_number text;
  invoice_kind text := lower(coalesce(p_options ->> 'type', 'final'));
  invoice_type text;
  invoice_status text;
  should_issue boolean := coalesce((p_options ->> 'issue')::boolean, true);
  due_at timestamptz;
  vat_treatment text := coalesce(p_options ->> 'vat_treatment', 'standard');
  item public.repair_job_items%rowtype;
  effective_item_type text;
  effective_source_type text;
  vehicle_description text;
begin
  if p_actor_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if invoice_kind not in ('final', 'pro_forma', 'estimate') then
    raise exception 'Unsupported repair invoice type: %', invoice_kind
      using errcode = '22023';
  end if;
  -- 'estimate' is a friendlier synonym for pro_forma; both store as pro_forma.
  invoice_type := case when invoice_kind = 'final' then 'repair' else 'pro_forma' end;

  select * into job from public.repair_jobs
    where id = p_repair_job_id and deleted_at is null;
  if not found then
    raise exception 'Repair job % not found', p_repair_job_id using errcode = 'P0002';
  end if;

  if not public.has_org_role(
    job.organisation_id,
    array['owner', 'manager', 'service_advisor']
  ) then
    raise exception 'Not authorised to invoice this repair job' using errcode = '42501';
  end if;

  if invoice_kind = 'final' and exists (
    select 1 from public.invoices
    where repair_job_id = p_repair_job_id
      and organisation_id = job.organisation_id
      and type = 'repair'
      and deleted_at is null
      and status not in ('cancelled', 'void')
  ) then
    raise exception 'A final invoice already exists for this repair job'
      using errcode = '23505';
  end if;

  select * into cust from public.customers where id = job.customer_id;
  if job.customer_vehicle_id is not null then
    select * into cvehicle from public.customer_vehicles
      where id = job.customer_vehicle_id;
  end if;
  select * into settings from public.dealership_settings
    where organisation_id = job.organisation_id;

  invoice_number := public.allocate_invoice_number(job.organisation_id);
  due_at := coalesce(
    (p_options ->> 'due_at')::timestamptz,
    now() + interval '14 days'
  );

  vehicle_description := coalesce(
    nullif(trim(concat_ws(' ', cvehicle.year::text, cvehicle.make, cvehicle.model)), ''),
    job.vehicle_make_model
  );

  insert into public.invoices (
    id, organisation_id, invoice_number, type, status,
    customer_id, customer_name_snapshot, customer_email_snapshot,
    customer_phone_snapshot, billing_address_snapshot,
    vehicle_registration_snapshot, vehicle_description_snapshot,
    repair_job_id, issued_at, due_at, vat_treatment,
    vat_registration_snapshot, notes, terms, created_by, issued_by
  )
  values (
    invoice_id,
    job.organisation_id,
    invoice_number,
    invoice_type,
    case when should_issue then 'sent' else 'draft' end,
    job.customer_id,
    coalesce(cust.full_name, trim(concat(cust.first_name, ' ', cust.last_name))),
    cust.email,
    cust.phone,
    coalesce(cust.address, '{}'::jsonb),
    coalesce(cvehicle.registration, job.registration),
    vehicle_description,
    job.id,
    case when should_issue then now() else null end,
    due_at,
    vat_treatment,
    settings.vat_number,
    p_options ->> 'notes',
    p_options ->> 'terms',
    p_actor_user_id,
    case when should_issue then p_actor_user_id else null end
  );

  for item in
    select * from public.repair_job_items
    where repair_job_id = p_repair_job_id
      and organisation_id = job.organisation_id
      and deleted_at is null
      and item_type <> 'note'
    order by sort_order asc, created_at asc
  loop
    effective_item_type := case item.item_type
      when 'labour' then 'labour'
      when 'part' then 'part'
      when 'discount' then 'discount'
      when 'inspection' then 'fee'
      else 'fee'
    end;
    effective_source_type := case item.item_type
      when 'labour' then 'repair_labour'
      when 'part' then 'repair_part'
      when 'discount' then 'other'
      else 'other'
    end;

    insert into public.invoice_line_items (
      organisation_id, invoice_id, sort_order, item_type, description,
      quantity, unit_price, vat_rate, vat_treatment,
      source_type, source_id
    ) values (
      job.organisation_id,
      invoice_id,
      item.sort_order,
      effective_item_type,
      case
        when item.part_number is not null then item.description || ' (' || item.part_number || ')'
        else item.description
      end,
      item.quantity,
      item.unit_price,
      case when vat_treatment in ('zero', 'exempt', 'not_registered') then 0 else item.vat_rate end,
      vat_treatment,
      effective_source_type,
      item.id
    );
  end loop;

  perform public.recompute_invoice_totals(invoice_id);

  insert into public.invoice_activity (
    organisation_id, invoice_id, actor_user_id, action, detail
  ) values (
    job.organisation_id, invoice_id, p_actor_user_id, 'invoice.created',
    'Created from repair ' || job.reference
      || ' (' || invoice_kind || ')'
  );

  if should_issue then
    insert into public.invoice_activity (
      organisation_id, invoice_id, actor_user_id, action, detail
    ) values (
      job.organisation_id, invoice_id, p_actor_user_id, 'invoice.issued',
      'Issued with number ' || invoice_number
    );
  end if;

  -- Reflect the money state on the repair job for the workshop board.
  if invoice_kind = 'final' then
    update public.repair_jobs
    set payment_status = case
      when payment_status in ('paid', 'part_paid', 'refunded', 'written_off')
        then payment_status
      else 'invoice_due'
    end
    where id = job.id;
  end if;

  insert into public.audit_logs (
    organisation_id, actor_user_id, action, entity_type, entity_id,
    change_reason, new_values
  ) values (
    job.organisation_id, p_actor_user_id, 'invoice.created', 'invoice', invoice_id,
    'Invoice ' || invoice_number || ' created from repair ' || job.reference,
    jsonb_build_object(
      'invoice_number', invoice_number,
      'repair_job_id', job.id,
      'kind', invoice_kind,
      'issued', should_issue
    )
  );

  return invoice_id;
end;
$$;

revoke all on function public.create_repair_invoice(uuid, uuid, jsonb) from public;
grant execute on function public.create_repair_invoice(uuid, uuid, jsonb) to authenticated;

commit;
