begin;

-- A technician may edit notes on an assigned repair in any state, but only a
-- manager may move a repair out of a manager-controlled state. Enforce this in
-- the authenticated RPC so a handcrafted request cannot bypass the UI guard.
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

  if p_changes ? 'status'
    and target_job.status not in (
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
  then
    raise exception 'A manager must change this repair status'
      using errcode = '22023';
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

-- CREATE OR REPLACE preserves ACLs. Re-state the complete intended access so
-- this follow-up remains safe if the live function ACL has drifted.
revoke execute on function public.update_assigned_repair_job(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_assigned_repair_job(uuid, jsonb)
  to authenticated;

-- The positional overload is legacy and must not become an alternate path
-- around the JSON field allow-list.
revoke execute on function public.update_assigned_repair_job(
  uuid, text, text, text, text
) from public, anon, authenticated, service_role;

do $verify_technician_repair_acl$
declare
  guarded_rpc regprocedure :=
    'public.update_assigned_repair_job(uuid,jsonb)'::regprocedure;
  legacy_rpc regprocedure :=
    'public.update_assigned_repair_job(uuid,text,text,text,text)'::regprocedure;
begin
  if has_function_privilege('anon', guarded_rpc, 'execute')
    or not has_function_privilege('authenticated', guarded_rpc, 'execute')
    or has_function_privilege('anon', legacy_rpc, 'execute')
    or has_function_privilege('authenticated', legacy_rpc, 'execute')
  then
    raise exception 'Technician repair RPC has an invalid EXECUTE ACL';
  end if;
end;
$verify_technician_repair_acl$;

commit;
