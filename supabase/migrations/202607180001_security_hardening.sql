begin;

-- Hosted Supabase installs pgcrypto in the extensions schema. Keep the
-- SECURITY DEFINER search paths empty and qualify digest at its call sites.
do $digest_resolution$
declare
  function_signature text;
  function_oid regprocedure;
  function_definition text;
begin
  if to_regprocedure('extensions.digest(text,text)') is null then
    raise exception
      'Expected pgcrypto function extensions.digest(text,text) is unavailable';
  end if;

  foreach function_signature in array array[
    'public.consume_public_rate_limit(uuid,text,text,integer,integer)',
    'public.submit_public_enquiry(uuid,jsonb)',
    'public.submit_public_sourcing_request(uuid,jsonb)',
    'public.book_repair_call(uuid,timestamp with time zone,text,text,text,text,text,text,text,text,text,text)'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Required function % is unavailable', function_signature;
    end if;

    function_definition := pg_get_functiondef(function_oid);
    if position('extensions.digest(' in function_definition) = 0 then
      if position('digest(' in function_definition) = 0 then
        raise exception
          'Function % does not contain the expected digest call',
          function_signature;
      end if;

      execute replace(
        function_definition,
        'digest(',
        'extensions.digest('
      );
    end if;

    function_definition := pg_get_functiondef(function_oid);
    if position('extensions.digest(' in function_definition) = 0 then
      raise exception
        'Function % was not updated to extensions.digest',
        function_signature;
    end if;
  end loop;
end;
$digest_resolution$;

-- Run technician repair updates as the authenticated user. Locking the row
-- keeps the assignment check and update atomic; a null status preserves a
-- manager-only current status while the technician edits other permitted
-- fields.
create or replace function public.update_assigned_repair_job(
  p_repair_job_id uuid,
  p_status text,
  p_diagnosis text,
  p_technician_notes text,
  p_work_completed text
)
returns public.technician_repair_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.repair_jobs%rowtype;
  result public.technician_repair_jobs;
begin
  select *
  into strict target_job
  from public.repair_jobs
  where id = p_repair_job_id
    and deleted_at is null
  for update;

  if not (
    public.has_org_role(
      target_job.organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
    or (
      target_job.assigned_technician_id = auth.uid()
      and public.has_org_role(
        target_job.organisation_id,
        array['technician']
      )
    )
  ) then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  if p_status is not null and p_status not in (
    'awaiting_inspection',
    'diagnosing',
    'estimate_preparing',
    'approved',
    'parts_ordered',
    'parts_received',
    'work_in_progress',
    'quality_check',
    'ready_for_collection'
  ) then
    raise exception 'Technicians cannot set that repair status'
      using errcode = '22023';
  end if;

  update public.repair_jobs
  set
    status = coalesce(p_status, target_job.status),
    diagnosis = nullif(trim(p_diagnosis), ''),
    technician_notes = nullif(trim(p_technician_notes), ''),
    work_completed = nullif(trim(p_work_completed), '')
  where id = p_repair_job_id;

  select *
  into strict result
  from public.technician_repair_jobs
  where id = p_repair_job_id;

  return result;
end;
$$;

create or replace function public.update_assigned_repair_job(
  p_repair_job_id uuid,
  p_changes jsonb
)
returns public.technician_repair_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_job public.repair_jobs%rowtype;
  result public.technician_repair_jobs;
begin
  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or p_changes = '{}'::jsonb
  then
    raise exception 'Choose at least one repair field to update'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_changes) as submitted(field)
    where submitted.field not in (
      'status',
      'diagnosis',
      'technician_notes',
      'work_completed'
    )
  ) then
    raise exception 'Technicians cannot update that repair field'
      using errcode = '22023';
  end if;

  if p_changes ? 'status' and (
    jsonb_typeof(p_changes -> 'status') <> 'string'
    or p_changes ->> 'status' not in (
      'awaiting_inspection',
      'diagnosing',
      'estimate_preparing',
      'approved',
      'parts_ordered',
      'parts_received',
      'work_in_progress',
      'quality_check',
      'ready_for_collection'
    )
  ) then
    raise exception 'Technicians cannot set that repair status'
      using errcode = '22023';
  end if;

  if (p_changes ? 'diagnosis' and
      jsonb_typeof(p_changes -> 'diagnosis') not in ('string', 'null'))
    or (p_changes ? 'technician_notes' and
        jsonb_typeof(p_changes -> 'technician_notes') not in ('string', 'null'))
    or (p_changes ? 'work_completed' and
        jsonb_typeof(p_changes -> 'work_completed') not in ('string', 'null'))
    or length(coalesce(p_changes ->> 'diagnosis', '')) > 5000
    or length(coalesce(p_changes ->> 'technician_notes', '')) > 5000
    or length(coalesce(p_changes ->> 'work_completed', '')) > 5000
  then
    raise exception 'Review the repair changes'
      using errcode = '22023';
  end if;

  select *
  into strict target_job
  from public.repair_jobs
  where id = p_repair_job_id
    and deleted_at is null
  for update;

  if target_job.assigned_technician_id is distinct from auth.uid()
    or not public.has_org_role(
      target_job.organisation_id,
      array['technician']
    )
  then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  update public.repair_jobs
  set
    status = case
      when p_changes ? 'status' then p_changes ->> 'status'
      else target_job.status
    end,
    diagnosis = case
      when p_changes ? 'diagnosis'
        then nullif(trim(p_changes ->> 'diagnosis'), '')
      else target_job.diagnosis
    end,
    technician_notes = case
      when p_changes ? 'technician_notes'
        then nullif(trim(p_changes ->> 'technician_notes'), '')
      else target_job.technician_notes
    end,
    work_completed = case
      when p_changes ? 'work_completed'
        then nullif(trim(p_changes ->> 'work_completed'), '')
      else target_job.work_completed
    end
  where id = p_repair_job_id;

  select *
  into strict result
  from public.technician_repair_jobs
  where id = p_repair_job_id;

  return result;
end;
$$;

-- Customer audit snapshots intentionally exclude names, contact details,
-- addresses, notes, normalised identifiers and consent-source free text.
create or replace function public.customer_audit_snapshot(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_row is null then null
    else jsonb_strip_nulls(
      jsonb_build_object(
        'id', p_row -> 'id',
        'organisation_id', p_row -> 'organisation_id',
        'marketing_consent', p_row -> 'marketing_consent',
        'do_not_contact', p_row -> 'do_not_contact',
        'merged_into_customer_id', p_row -> 'merged_into_customer_id',
        'anonymised_at', p_row -> 'anonymised_at',
        'created_at', p_row -> 'created_at',
        'updated_at', p_row -> 'updated_at',
        'deleted_at', p_row -> 'deleted_at'
      )
    )
  end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  tenant_id uuid;
  target_id uuid;
  changed text[];
begin
  if tg_op <> 'INSERT' then
    old_row := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_row := to_jsonb(new);
  end if;

  tenant_id := nullif(
    coalesce(new_row ->> 'organisation_id', old_row ->> 'organisation_id'),
    ''
  )::uuid;
  target_id := nullif(coalesce(new_row ->> 'id', old_row ->> 'id'), '')::uuid;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}'::text[])
    into changed
    from (
      select key
      from jsonb_object_keys(coalesce(old_row, '{}'::jsonb) || coalesce(new_row, '{}'::jsonb)) key
      where old_row -> key is distinct from new_row -> key
        and key not in ('updated_at')
    ) differences;

    if cardinality(changed) = 0 then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    changed := array['created'];
  else
    changed := array['deleted'];
  end if;

  if tg_table_name = 'customers' then
    old_row := public.customer_audit_snapshot(old_row);
    new_row := public.customer_audit_snapshot(new_row);
  else
    old_row := old_row - 'secret_reference';
    new_row := new_row - 'secret_reference';
  end if;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    request_id,
    table_name,
    record_id,
    action,
    changed_fields,
    old_values,
    new_values
  )
  values (
    tenant_id,
    auth.uid(),
    nullif(current_setting('request.id', true), ''),
    tg_table_name,
    target_id,
    tg_op,
    changed,
    old_row,
    new_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- This guard also sanitises application-written customer audit events, such as
-- customer merges, rather than relying only on the generic table trigger.
create or replace function public.sanitise_customer_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.table_name = 'customers' then
    new.old_values := public.customer_audit_snapshot(new.old_values);
    new.new_values := public.customer_audit_snapshot(new.new_values);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_logs_sanitise_customer_values
  on public.audit_logs;
create trigger audit_logs_sanitise_customer_values
before insert or update on public.audit_logs
for each row
when (new.table_name = 'customers')
execute function public.sanitise_customer_audit_log();

-- Rebuild from an allow-list instead of deleting individual sensitive keys.
-- This is idempotent and intentionally emits no customer values.
with sanitised as (
  select
    id,
    public.customer_audit_snapshot(old_values) as old_values,
    public.customer_audit_snapshot(new_values) as new_values
  from public.audit_logs
  where table_name = 'customers'
)
update public.audit_logs audit
set
  old_values = sanitised.old_values,
  new_values = sanitised.new_values
from sanitised
where audit.id = sanitised.id
  and (
    audit.old_values is distinct from sanitised.old_values
    or audit.new_values is distinct from sanitised.new_values
  );

-- PostgreSQL grants new functions to PUBLIC by default. Remove direct access
-- from every current SECURITY DEFINER function, including any untracked live
-- function, before applying the small intentional allow-list below.
do $deny_security_definers$
declare
  secured_function record;
begin
  for secured_function in
    select p.oid::regprocedure as identity
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      secured_function.identity
    );
  end loop;
end;
$deny_security_definers$;

-- These thirteen workflows are server-only entry points. Keep the explicit
-- signatures here so overload changes cannot silently broaden access.
revoke execute on function public.attach_vehicle_image(
  uuid, uuid, text, text, text, bigint, text, text, uuid
) from public, anon, authenticated;
revoke execute on function public.claim_storage_cleanup_jobs(integer)
  from public, anon, authenticated;
revoke execute on function public.convert_appointment_to_repair(
  uuid, uuid, uuid, integer, uuid, date, text
) from public, anon, authenticated;
revoke execute on function public.create_vehicle_with_costs(
  uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke execute on function public.merge_customers(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.publish_homepage(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.record_vehicle_sale(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, text, text,
  date, date, text, text[], jsonb, uuid
) from public, anon, authenticated;
revoke execute on function public.reorder_vehicle_images(
  uuid, uuid, uuid[], uuid, uuid
) from public, anon, authenticated;
revoke execute on function public.replace_availability_rules(
  uuid, uuid, jsonb, uuid
) from public, anon, authenticated;
revoke execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.update_sourcing_request(
  uuid, uuid, jsonb, text, uuid
) from public, anon, authenticated;
revoke execute on function public.update_team_member_access(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated;
revoke execute on function public.update_vehicle_with_costs(
  uuid, uuid, uuid, jsonb, jsonb, text
) from public, anon, authenticated;

revoke execute on function public.customer_audit_snapshot(jsonb)
  from public, anon, authenticated;

-- Authenticated entry points and RLS helpers.
grant execute on function public.bootstrap_organisation(text, text)
  to authenticated;
grant execute on function public.is_org_member(uuid)
  to authenticated;
grant execute on function public.has_org_role(uuid, text[])
  to authenticated;
grant execute on function public.has_org_permission(uuid, text)
  to authenticated;
grant execute on function public.current_member_role(uuid)
  to authenticated;
grant execute on function public.can_access_customer(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.update_vehicle_presentation(
  uuid, text, text, text, text, text, text, text, text, boolean, boolean,
  text, text, text
) to authenticated;
grant execute on function public.update_assigned_repair_job(
  uuid, jsonb
) to authenticated;

-- The availability projection is the only anonymous SECURITY DEFINER RPC.
-- Both booking overloads remain server-only in the final canonical state.
grant execute on function public.public_available_appointment_slots(
  text, text, date, integer
) to anon, authenticated;

-- Trusted server entry points.
grant execute on function public.consume_public_rate_limit(
  uuid, text, text, integer, integer
) to service_role;
grant execute on function public.submit_public_enquiry(uuid, jsonb)
  to service_role;
grant execute on function public.submit_public_sourcing_request(uuid, jsonb)
  to service_role;
grant execute on function public.book_repair_call(
  text, text, timestamptz, text, text, text, text, text, text, text, text,
  boolean, boolean, text, text, boolean, text, text
) to service_role;
grant execute on function public.book_repair_call(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.accept_team_invitation(uuid)
  to service_role;
grant execute on function public.attach_vehicle_image(
  uuid, uuid, text, text, text, bigint, text, text, uuid
) to service_role;
grant execute on function public.claim_storage_cleanup_jobs(integer)
  to service_role;
grant execute on function public.convert_appointment_to_repair(
  uuid, uuid, uuid, integer, uuid, date, text
) to service_role;
grant execute on function public.create_vehicle_with_costs(
  uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.merge_customers(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.publish_homepage(uuid, uuid)
  to service_role;
grant execute on function public.record_vehicle_sale(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, text, text,
  date, date, text, text[], jsonb, uuid
) to service_role;
grant execute on function public.reorder_vehicle_images(
  uuid, uuid, uuid[], uuid, uuid
) to service_role;
grant execute on function public.replace_availability_rules(
  uuid, uuid, jsonb, uuid
) to service_role;
grant execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  to service_role;
grant execute on function public.update_sourcing_request(
  uuid, uuid, jsonb, text, uuid
) to service_role;
grant execute on function public.update_team_member_access(
  uuid, uuid, text, text, uuid
) to service_role;
grant execute on function public.update_vehicle_with_costs(
  uuid, uuid, uuid, jsonb, jsonb, text
) to service_role;

-- Make future functions private until a later migration explicitly grants a
-- documented entry-point role. This affects functions created by this
-- migration role in the public schema.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Abort rather than commit an accidentally broadened ACL.
do $verify_security_definer_acl$
declare
  allowed_anon regprocedure[] := array[
    'public.public_available_appointment_slots(text,text,date,integer)'::regprocedure
  ];
  allowed_authenticated regprocedure[] := array[
    'public.bootstrap_organisation(text,text)'::regprocedure,
    'public.is_org_member(uuid)'::regprocedure,
    'public.has_org_role(uuid,text[])'::regprocedure,
    'public.has_org_permission(uuid,text)'::regprocedure,
    'public.current_member_role(uuid)'::regprocedure,
    'public.can_access_customer(uuid,uuid)'::regprocedure,
    'public.public_available_appointment_slots(text,text,date,integer)'::regprocedure,
    'public.update_vehicle_presentation(uuid,text,text,text,text,text,text,text,text,boolean,boolean,text,text,text)'::regprocedure,
    'public.update_assigned_repair_job(uuid,jsonb)'::regprocedure
  ];
  service_only regprocedure[] := array[
    'public.consume_public_rate_limit(uuid,text,text,integer,integer)'::regprocedure,
    'public.submit_public_enquiry(uuid,jsonb)'::regprocedure,
    'public.submit_public_sourcing_request(uuid,jsonb)'::regprocedure,
    'public.book_repair_call(text,text,timestamp with time zone,text,text,text,text,text,text,text,text,boolean,boolean,text,text,boolean,text,text)'::regprocedure,
    'public.book_repair_call(uuid,timestamp with time zone,text,text,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.accept_team_invitation(uuid)'::regprocedure,
    'public.attach_vehicle_image(uuid,uuid,text,text,text,bigint,text,text,uuid)'::regprocedure,
    'public.claim_storage_cleanup_jobs(integer)'::regprocedure,
    'public.convert_appointment_to_repair(uuid,uuid,uuid,integer,uuid,date,text)'::regprocedure,
    'public.create_vehicle_with_costs(uuid,uuid,jsonb,jsonb)'::regprocedure,
    'public.merge_customers(uuid,uuid,uuid,uuid)'::regprocedure,
    'public.publish_homepage(uuid,uuid)'::regprocedure,
    'public.record_vehicle_sale(uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text,date,date,text,text[],jsonb,uuid)'::regprocedure,
    'public.reorder_vehicle_images(uuid,uuid,uuid[],uuid,uuid)'::regprocedure,
    'public.replace_availability_rules(uuid,uuid,jsonb,uuid)'::regprocedure,
    'public.soft_delete_vehicle_image(uuid,uuid,uuid)'::regprocedure,
    'public.update_sourcing_request(uuid,uuid,jsonb,text,uuid)'::regprocedure,
    'public.update_team_member_access(uuid,uuid,text,text,uuid)'::regprocedure,
    'public.update_vehicle_with_costs(uuid,uuid,uuid,jsonb,jsonb,text)'::regprocedure
  ];
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and not (p.oid::regprocedure = any(allowed_anon))
  ) then
    raise exception 'Unexpected anonymous access to a SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
      and not (p.oid::regprocedure = any(allowed_authenticated))
  ) then
    raise exception 'Unexpected authenticated access to a SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from unnest(service_only) as target(identity)
    where has_function_privilege('anon', target.identity, 'execute')
      or has_function_privilege('authenticated', target.identity, 'execute')
      or not has_function_privilege('service_role', target.identity, 'execute')
  ) then
    raise exception 'A service-only function has an invalid EXECUTE ACL';
  end if;
end;
$verify_security_definer_acl$;

commit;
