-- Run with ON_ERROR_STOP. Every fixture and change is rolled back, including
-- auth users and profiles. No passwords, real contacts, or provider calls.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
create temporary table motoros_verification_results (checks jsonb);

do $repair_verification$
declare
  owner_id uuid := gen_random_uuid();
  technician_id uuid := gen_random_uuid();
  outsider_id uuid := gen_random_uuid();
  org_id uuid := gen_random_uuid();
  other_org_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  other_customer_id uuid := gen_random_uuid();
  job_id uuid := gen_random_uuid();
  other_job_id uuid := gen_random_uuid();
  labour_id uuid := gen_random_uuid();
  part_id uuid := gen_random_uuid();
  other_item_id uuid := gen_random_uuid();
  estimate_id uuid;
  original_version timestamptz := now() - interval '1 day';
  saved_version timestamptz;
  affected integer;
  amount numeric;
  rejected boolean;
  passed text[] := '{}'::text[];
  baseline_customers bigint;
  baseline_jobs bigint;
  baseline_items bigint;
begin
  select count(*) into baseline_customers from public.customers;
  select count(*) into baseline_jobs from public.repair_jobs;
  select count(*) into baseline_items from public.repair_job_items;

  insert into auth.users (id) values (owner_id), (technician_id), (outsider_id);
  insert into public.organisations (id, name, slug, status) values
    (org_id, 'MOTOR.OS rollback verification', 'verify-' || org_id, 'active'),
    (other_org_id, 'MOTOR.OS isolation verification', 'verify-' || other_org_id, 'active');
  insert into public.organisation_members
    (organisation_id, user_id, role, role_id, status)
  select org_id, owner_id, 'owner', id, 'active' from public.roles where code='owner';
  insert into public.organisation_members
    (organisation_id, user_id, role, role_id, status)
  select org_id, technician_id, 'technician', id, 'active' from public.roles where code='technician';
  insert into public.organisation_members
    (organisation_id, user_id, role, role_id, status)
  select other_org_id, outsider_id, 'owner', id, 'active' from public.roles where code='owner';
  insert into public.customers (id, organisation_id, first_name, last_name, do_not_contact)
  values (customer_id, org_id, 'Verification', 'Fixture', true),
    (other_customer_id, other_org_id, 'Isolation', 'Fixture', true);
  insert into public.repair_jobs
    (id, organisation_id, customer_id, reported_fault, assigned_technician_id,
     estimate_total, internal_notes)
  values (job_id, org_id, customer_id, 'Rollback verification only', technician_id, 10,
      'Commercial field must not be readable by technicians'),
    (other_job_id, other_org_id, other_customer_id, 'Isolation verification only', null, 0, null);
  if (select count(*) from public.invoice_number_sequences where organisation_id=org_id) <> 8 then
    raise exception 'Verification failed: organisation sequence trigger';
  end if;
  passed := array_append(passed, 'organisation invoice-sequence trigger');

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','service_role')::text, true);
  execute 'set local role service_role';
  insert into public.repair_job_items
    (id, organisation_id, repair_job_id, item_type, description, quantity,
     unit_price, vat_rate, updated_at, created_by)
  values (labour_id, org_id, job_id, 'labour', 'Verification labour', 1.25, 43.99, 20,
    original_version, owner_id);
  select line_total into amount from public.repair_job_items where id=labour_id;
  if amount <> 54.99 then raise exception 'Verification failed: generated line rounding'; end if;
  passed := array_append(passed, 'server create and generated penny rounding');

  rejected := false;
  begin
    insert into public.repair_job_items
      (id, organisation_id, repair_job_id, item_type, description)
    values (labour_id, org_id, job_id, 'labour', 'Duplicate verification');
  exception when unique_violation then rejected := true;
  end;
  if not rejected then raise exception 'Verification failed: duplicate item ID'; end if;
  passed := array_append(passed, 'duplicate item ID rejected');

  update public.repair_job_items set quantity=1.5, unit_price=42
  where id=labour_id and repair_job_id=job_id and organisation_id=org_id
    and updated_at=original_version and deleted_at is null
  returning updated_at into saved_version;
  get diagnostics affected = row_count;
  if affected <> 1 or saved_version <= original_version then
    raise exception 'Verification failed: item update/version trigger';
  end if;
  passed := array_append(passed, 'scoped update and timestamp trigger');
  update public.repair_job_items set quantity=9
  where id=labour_id and repair_job_id=job_id and organisation_id=org_id
    and updated_at=original_version and deleted_at is null;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Verification failed: stale item update'; end if;
  passed := array_append(passed, 'stale edit rejected');
  update public.repair_job_items set quantity=9
  where id=labour_id and repair_job_id=job_id and organisation_id=other_org_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Verification failed: tenant-scoped update'; end if;
  passed := array_append(passed, 'wrong tenant update matches no record');

  rejected := false;
  begin
    insert into public.repair_job_items
      (organisation_id, repair_job_id, item_type, description)
    values (other_org_id, job_id, 'part', 'Cross-tenant fixture');
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'Verification failed: tenant reference trigger'; end if;
  passed := array_append(passed, 'cross-tenant item reference rejected');
  rejected := false;
  begin
    insert into public.repair_job_items
      (organisation_id, repair_job_id, item_type, description, quantity)
    values (org_id, job_id, 'part', 'Invalid fixture', 0);
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception 'Verification failed: quantity constraint'; end if;
  passed := array_append(passed, 'invalid quantity rejected');

  insert into public.repair_job_items
    (id, organisation_id, repair_job_id, item_type, description, quantity, unit_price)
  values (part_id, org_id, job_id, 'part', 'Removed verification part', 1, 5),
    (other_item_id, other_org_id, other_job_id, 'part', 'Other tenant fixture', 1, 10);
  update public.repair_job_items set deleted_at=now()
  where id=part_id and repair_job_id=job_id and organisation_id=org_id and deleted_at is null;
  get diagnostics affected = row_count;
  if affected <> 1 or (select count(*) from public.repair_job_items
      where repair_job_id=job_id and deleted_at is null) <> 1 then
    raise exception 'Verification failed: soft removal';
  end if;
  passed := array_append(passed, 'soft removal preserves history and excludes active list');
  insert into public.audit_logs
    (organisation_id, actor_user_id, action, entity_type, entity_id, change_reason, new_values)
  values (org_id, owner_id, 'repair_job.item_created', 'repair_job', job_id,
    'Rollback verification', jsonb_build_object('item_id',labour_id,'operation','created'));
  if (select count(*) from public.audit_logs where organisation_id=org_id
      and entity_id=job_id and action='repair_job.item_created') <> 1 then
    raise exception 'Verification failed: application activity';
  end if;
  passed := array_append(passed, 'application activity insert');

  execute 'reset role';
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.repair_jobs where id in (job_id,other_job_id)) <> 1
    or (select count(*) from public.repair_job_items where id in (labour_id,other_item_id)) <> 1 then
    raise exception 'Verification failed: owner tenant isolation';
  end if;
  passed := array_append(passed, 'owner reads own tenant only');

  rejected := false;
  begin perform public.allocate_invoice_number(other_org_id);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: invoice allocator RPC access'; end if;
  passed := array_append(passed, 'direct invoice allocator blocked');
  rejected := false;
  begin perform public.seed_invoice_number_sequences(other_org_id);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: invoice seeder RPC access'; end if;
  passed := array_append(passed, 'direct invoice sequence seeder blocked');
  rejected := false;
  begin perform public.recompute_invoice_totals(gen_random_uuid());
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: invoice totals RPC access'; end if;
  passed := array_append(passed, 'direct unchecked invoice totals helper blocked');

  estimate_id := public.create_repair_invoice(owner_id, job_id,
    '{"type":"estimate","issue":false,"vat_treatment":"standard"}'::jsonb);
  execute 'reset role';
  if not exists (select 1 from public.invoices
      where id=estimate_id and organisation_id=org_id and status='draft'
        and type='pro_forma' and total=75.60)
    or (select count(*) from public.invoice_line_items where invoice_id=estimate_id) <> 1 then
    raise exception 'Verification failed: estimate copies current items and totals';
  end if;
  passed := array_append(passed, 'authorised draft estimate and internal helper calls');
  if (select estimate_total from public.repair_jobs where id=job_id) <> 10 then
    raise exception 'Verification failed: recorded estimate changed';
  end if;
  passed := array_append(passed, 'recorded customer estimate preserved');

  perform set_config('request.jwt.claim.sub', technician_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',technician_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.technician_repair_jobs where id=job_id) <> 1
    or (select count(*) from public.technician_repair_jobs where id=other_job_id) <> 0 then
    raise exception 'Verification failed: technician job projection';
  end if;
  passed := array_append(passed, 'technician operational view and assignment isolation');
  if (select description from public.repair_job_items where id=labour_id) <> 'Verification labour' then
    raise exception 'Verification failed: technician operational item read';
  end if;
  passed := array_append(passed, 'technician operational item columns');
  rejected := false;
  begin select unit_price into amount from public.repair_job_items where id=labour_id;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician item price disclosure'; end if;
  passed := array_append(passed, 'technician item price read blocked');
  rejected := false;
  begin select estimate_total into amount from public.repair_jobs where id=job_id;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician estimate disclosure'; end if;
  passed := array_append(passed, 'technician estimate read blocked');
  rejected := false;
  begin perform internal_notes from public.repair_jobs where id=job_id;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician internal notes disclosure'; end if;
  passed := array_append(passed, 'technician internal notes read blocked');
  rejected := false;
  begin update public.repair_job_items set unit_price=0 where id=labour_id;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician price write'; end if;
  passed := array_append(passed, 'technician direct price write blocked');
  perform public.update_assigned_repair_job(job_id, '{"diagnosis":"Verification diagnosis"}'::jsonb);
  if (select diagnosis from public.technician_repair_jobs where id=job_id) <> 'Verification diagnosis' then
    raise exception 'Verification failed: technician guarded update';
  end if;
  passed := array_append(passed, 'technician guarded diagnosis RPC still works');
  rejected := false;
  begin perform public.update_assigned_repair_job(job_id, '{"estimate_total":0}'::jsonb);
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician commercial RPC input'; end if;
  passed := array_append(passed, 'technician commercial RPC field rejected');
  rejected := false;
  begin perform public.create_repair_invoice(technician_id, job_id, '{"type":"estimate","issue":false}'::jsonb);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: technician invoice creation'; end if;
  passed := array_append(passed, 'technician invoice creation rejected');

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',outsider_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.repair_job_items where id=labour_id) <> 0 then
    raise exception 'Verification failed: other tenant item read';
  end if;
  passed := array_append(passed, 'other dealership item read blocked');
  rejected := false;
  begin perform public.create_repair_invoice(outsider_id, job_id, '{"type":"estimate","issue":false}'::jsonb);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: other tenant estimate'; end if;
  passed := array_append(passed, 'other dealership estimate creation rejected');

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  rejected := false;
  begin perform id from public.repair_job_items where id=labour_id;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Verification failed: anonymous repair read'; end if;
  passed := array_append(passed, 'anonymous repair read blocked');
  if not has_function_privilege(current_user,
    'public.public_available_appointment_slots(text,text,date,integer)', 'EXECUTE') then
    raise exception 'Verification failed: public availability RPC access';
  end if;
  passed := array_append(passed, 'intentional public availability RPC retained');
  execute 'reset role';
  if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p')
        and (has_table_privilege('authenticated',c.oid,'TRUNCATE')
          or has_table_privilege('anon',c.oid,'TRUNCATE'))) then
    raise exception 'Verification failed: browser truncate privilege';
  end if;
  passed := array_append(passed, 'browser table truncate privilege removed');

  insert into motoros_verification_results values (jsonb_build_object(
    'passed',cardinality(passed), 'checks',passed,
    'baseline_customers',baseline_customers,'baseline_jobs',baseline_jobs,
    'baseline_items',baseline_items,'fixtures_rollback',true));
end;
$repair_verification$;

select checks from motoros_verification_results;
rollback;
