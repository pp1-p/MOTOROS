begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The website reads commercial repair fields through its scoped server client.
-- RLS limits rows, not columns: an assigned technician must not be able to read
-- the hidden prices by querying the Data API directly. Preserve the operational
-- columns used by the security-invoker technician view and its guarded RPC.
revoke select, insert, update, delete on public.repair_jobs,
  public.repair_job_items from public, anon, authenticated;

-- Table revokes do not remove older column grants. Reset those too so this
-- migration remains safe if a live project previously granted extra columns.
do $reset_repair_column_acl$
declare
  target_table text;
  columns_sql text;
begin
  foreach target_table in array array['repair_jobs', 'repair_job_items'] loop
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into columns_sql
    from pg_attribute a
    where a.attrelid = format('public.%I', target_table)::regclass
      and a.attnum > 0 and not a.attisdropped;
    execute format(
      'revoke select (%1$s), insert (%1$s), update (%1$s), references (%1$s) on public.%2$I from public, anon, authenticated',
      columns_sql, target_table
    );
  end loop;
end;
$reset_repair_column_acl$;

grant select (
  id, organisation_id, reference, appointment_id, customer_vehicle_id,
  assigned_technician_id, status, registration, vehicle_make_model, mileage,
  reported_fault, diagnosis, work_completed, technician_notes,
  customer_facing_notes, start_date, due_date, collection_date,
  created_at, updated_at, deleted_at
) on public.repair_jobs to authenticated;

grant select (
  id, organisation_id, repair_job_id, item_type, description, quantity,
  status, sort_order, created_at, updated_at, deleted_at
) on public.repair_job_items to authenticated;

-- Operational browser roles need no schema-management privileges. TRUNCATE
-- does not consult RLS. Remove these leftover default grants without changing
-- the existing SELECT/DML access of unrelated application tables.
do $remove_browser_management_acl$
declare
  target_table record;
begin
  for target_table in
    select c.oid::regclass as identity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, references, trigger on table %s from public, anon, authenticated',
      target_table.identity
    );
  end loop;
end;
$remove_browser_management_acl$;

alter default privileges
  revoke truncate, references, trigger on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke truncate, references, trigger on tables from public, anon, authenticated;

-- These helpers have no caller/tenant checks because authorised invoice RPCs
-- and triggers call them internally. They are not public RPC entry points.
revoke execute on function public.allocate_invoice_number(uuid),
  public.recompute_invoice_totals(uuid),
  public.seed_invoice_number_sequences(uuid),
  public.assign_typed_invoice_number(),
  public.on_organisation_created_seed_invoice_sequences(),
  public.repair_codes_touch_updated_at()
  from public, anon, authenticated;
grant execute on function public.allocate_invoice_number(uuid),
  public.recompute_invoice_totals(uuid),
  public.seed_invoice_number_sequences(uuid),
  public.assign_typed_invoice_number(),
  public.on_organisation_created_seed_invoice_sequences(),
  public.repair_codes_touch_updated_at()
  to service_role;

-- Check effective privileges, including inherited PUBLIC grants, before commit.
do $verify_repair_and_helper_acl$
declare
  target_role text;
  target_table text;
  function_identity regprocedure;
  required_privilege text;
begin
  foreach target_role in array array['anon', 'authenticated'] loop
    foreach target_table in array array['repair_jobs', 'repair_job_items'] loop
      if has_table_privilege(target_role, 'public.' || target_table, 'SELECT')
        or has_table_privilege(target_role, 'public.' || target_table, 'INSERT')
        or has_table_privilege(target_role, 'public.' || target_table, 'UPDATE')
        or has_table_privilege(target_role, 'public.' || target_table, 'DELETE')
      then
        raise exception 'Unexpected browser table privilege on %', target_table;
      end if;
    end loop;
    foreach function_identity in array array[
      'public.allocate_invoice_number(uuid)'::regprocedure,
      'public.recompute_invoice_totals(uuid)'::regprocedure,
      'public.seed_invoice_number_sequences(uuid)'::regprocedure,
      'public.assign_typed_invoice_number()'::regprocedure,
      'public.on_organisation_created_seed_invoice_sequences()'::regprocedure,
      'public.repair_codes_touch_updated_at()'::regprocedure
    ] loop
      if has_function_privilege(target_role, function_identity, 'EXECUTE') then
        raise exception 'Unexpected browser access to internal helper %', function_identity;
      end if;
    end loop;
  end loop;
  if has_column_privilege('authenticated', 'public.repair_jobs', 'estimate_total', 'SELECT')
    or has_column_privilege('authenticated', 'public.repair_jobs', 'internal_notes', 'SELECT')
    or has_column_privilege('authenticated', 'public.repair_job_items', 'unit_price', 'SELECT')
    or has_column_privilege('authenticated', 'public.repair_job_items', 'unit_cost', 'SELECT')
    or not has_column_privilege('authenticated', 'public.repair_job_items', 'description', 'SELECT')
    or not has_column_privilege('authenticated', 'public.repair_jobs', 'diagnosis', 'SELECT')
  then
    raise exception 'Repair column permissions do not match the operational projection';
  end if;
  foreach required_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.repair_job_items', required_privilege) then
      raise exception 'Trusted repair item % access is missing', required_privilege;
    end if;
  end loop;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('authenticated', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE'))
  ) then
    raise exception 'Unexpected browser TRUNCATE privilege';
  end if;
end;
$verify_repair_and_helper_acl$;

notify pgrst, 'reload schema';
commit;
