begin;

create table public.public_submission_counters (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  action text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, action, key_hash, window_started_at)
);

alter table public.public_submission_counters enable row level security;
revoke all on public.public_submission_counters from anon, authenticated;

create or replace function public.consume_public_rate_limit(
  target_organisation_id uuid,
  target_action text,
  client_token text,
  maximum_attempts integer default 5,
  window_minutes integer default 15
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  recorded_attempts integer;
begin
  if client_token is null or char_length(client_token) < 16 then
    raise exception 'A valid submission token is required'
      using errcode = '22023';
  end if;

  if maximum_attempts not between 1 and 100
    or window_minutes not between 1 and 1440 then
    raise exception 'Invalid rate-limit configuration'
      using errcode = '22023';
  end if;

  bucket_start := date_bin(
    make_interval(mins => window_minutes),
    now(),
    timestamptz '2000-01-01 00:00:00+00'
  );

  insert into public.public_submission_counters (
    organisation_id,
    action,
    key_hash,
    window_started_at,
    attempts
  )
  values (
    target_organisation_id,
    target_action,
    encode(extensions.digest(client_token, 'sha256'), 'hex'),
    bucket_start,
    1
  )
  on conflict (organisation_id, action, key_hash, window_started_at)
  do update
  set
    attempts = public.public_submission_counters.attempts + 1,
    updated_at = now()
  where public.public_submission_counters.attempts < maximum_attempts
  returning attempts into recorded_attempts;

  if recorded_attempts is null then
    raise exception 'Too many submissions. Please try again later.'
      using errcode = 'P0001';
  end if;

  if random() < 0.01 then
    delete from public.public_submission_counters
    where window_started_at < now() - interval '2 days';
  end if;
end;
$$;

create or replace function public.assert_same_organisation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  foreign_column text := tg_argv[0];
  foreign_table text := tg_argv[1];
  foreign_id uuid;
  referenced_organisation_id uuid;
begin
  foreign_id := nullif(to_jsonb(new) ->> foreign_column, '')::uuid;
  if foreign_id is null then
    return new;
  end if;

  execute format(
    'select organisation_id from public.%I where id = $1',
    foreign_table
  )
  into referenced_organisation_id
  using foreign_id;

  if referenced_organisation_id is distinct from new.organisation_id then
    raise exception
      'Cross-organisation reference from %.% to % is not allowed',
      tg_table_name,
      foreign_column,
      foreign_table
      using errcode = '23514';
  end if;

  return new;
end;
$$;

do $$
declare
  relation record;
begin
  for relation in
    select *
    from (
      values
        ('customer_vehicles', 'customer_id', 'customers'),
        ('customer_vehicles', 'stock_vehicle_id', 'vehicles'),
        ('vehicle_images', 'vehicle_id', 'vehicles'),
        ('vehicle_features', 'vehicle_id', 'vehicles'),
        ('vehicle_costs', 'vehicle_id', 'vehicles'),
        ('vehicle_status_history', 'vehicle_id', 'vehicles'),
        ('vehicle_sync_records', 'vehicle_id', 'vehicles'),
        ('leads', 'customer_id', 'customers'),
        ('leads', 'vehicle_id', 'vehicles'),
        ('leads', 'sourcing_request_id', 'sourcing_requests'),
        ('lead_activities', 'lead_id', 'leads'),
        ('sourcing_requests', 'customer_id', 'customers'),
        ('sourcing_requests', 'lead_id', 'leads'),
        ('sourcing_requests', 'converted_vehicle_id', 'vehicles'),
        ('sourcing_candidates', 'sourcing_request_id', 'sourcing_requests'),
        ('sourcing_candidates', 'stock_vehicle_id', 'vehicles'),
        ('availability_rules', 'appointment_type_id', 'appointment_types'),
        ('availability_exceptions', 'appointment_type_id', 'appointment_types'),
        ('appointments', 'appointment_type_id', 'appointment_types'),
        ('appointments', 'customer_id', 'customers'),
        ('appointments', 'customer_vehicle_id', 'customer_vehicles'),
        ('appointments', 'lead_id', 'leads'),
        ('repair_jobs', 'appointment_id', 'appointments'),
        ('repair_jobs', 'customer_id', 'customers'),
        ('repair_jobs', 'customer_vehicle_id', 'customer_vehicles'),
        ('repair_job_items', 'repair_job_id', 'repair_jobs'),
        ('sales', 'vehicle_id', 'vehicles'),
        ('sales', 'customer_id', 'customers'),
        ('sales', 'lead_id', 'leads'),
        ('tasks', 'customer_id', 'customers'),
        ('tasks', 'vehicle_id', 'vehicles'),
        ('tasks', 'lead_id', 'leads'),
        ('tasks', 'sourcing_request_id', 'sourcing_requests'),
        ('tasks', 'appointment_id', 'appointments'),
        ('tasks', 'repair_job_id', 'repair_jobs'),
        ('tasks', 'sale_id', 'sales'),
        ('task_comments', 'task_id', 'tasks'),
        ('documents', 'customer_id', 'customers'),
        ('documents', 'vehicle_id', 'vehicles'),
        ('documents', 'lead_id', 'leads'),
        ('documents', 'sourcing_request_id', 'sourcing_requests'),
        ('documents', 'appointment_id', 'appointments'),
        ('documents', 'repair_job_id', 'repair_jobs'),
        ('documents', 'sale_id', 'sales')
    ) as links(table_name, column_name, referenced_table)
  loop
    execute format(
      'create trigger %I_assert_org before insert or update on public.%I for each row execute function public.assert_same_organisation(%L, %L)',
      relation.table_name || '_' || relation.column_name,
      relation.table_name,
      relation.column_name,
      relation.referenced_table
    );
  end loop;
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

  old_row := old_row - 'secret_reference';
  new_row := new_row - 'secret_reference';

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

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'vehicles',
    'customers',
    'appointments',
    'repair_jobs',
    'sales',
    'organisation_members',
    'integration_settings'
  ]
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create policy leads_read_management
on public.leads for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy leads_read_sales_assigned
on public.leads for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);
create policy leads_read_service
on public.leads for select to authenticated
using (
  public.has_org_role(organisation_id, array['service_advisor'])
  and lead_type = 'repair_call'
);
create policy leads_insert_operational
on public.leads for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);
create policy leads_update_management
on public.leads for update to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy leads_update_assigned
on public.leads for update to authenticated
using (
  (
    public.has_org_role(organisation_id, array['salesperson'])
    and (assigned_user_id is null or assigned_user_id = auth.uid())
  )
  or (
    public.has_org_role(organisation_id, array['service_advisor'])
    and lead_type = 'repair_call'
  )
)
with check (
  (
    public.has_org_role(organisation_id, array['salesperson'])
    and (assigned_user_id is null or assigned_user_id = auth.uid())
  )
  or (
    public.has_org_role(organisation_id, array['service_advisor'])
    and lead_type = 'repair_call'
  )
);

create policy lead_activities_read_visible_lead
on public.lead_activities for select to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_activities.lead_id
  )
);
create policy lead_activities_insert_visible_lead
on public.lead_activities for insert to authenticated
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_activities.lead_id
  )
);

create policy sourcing_read_management
on public.sourcing_requests for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sourcing_read_assigned_sales
on public.sourcing_requests for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);
create policy sourcing_write_management
on public.sourcing_requests for all to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sourcing_write_assigned_sales
on public.sourcing_requests for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and (assigned_user_id is null or assigned_user_id = auth.uid())
);

create policy sourcing_candidates_visible_request
on public.sourcing_candidates for select to authenticated
using (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
);
create policy sourcing_candidates_write_request
on public.sourcing_candidates for all to authenticated
using (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
)
with check (
  exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = sourcing_candidates.sourcing_request_id
  )
);

create policy appointment_types_read_staff
on public.appointment_types for select to authenticated
using (public.is_org_member(organisation_id));
create policy appointment_types_write_management
on public.appointment_types for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy availability_rules_read_staff
on public.availability_rules for select to authenticated
using (public.is_org_member(organisation_id));
create policy availability_rules_write_management
on public.availability_rules for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy availability_exceptions_read_staff
on public.availability_exceptions for select to authenticated
using (public.is_org_member(organisation_id));
create policy availability_exceptions_write_management
on public.availability_exceptions for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy appointments_read_management
on public.appointments for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy appointments_read_assigned_sales
on public.appointments for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
);
create policy appointments_write_management
on public.appointments for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy appointments_write_assigned_sales
on public.appointments for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and assigned_user_id = auth.uid()
);

create policy repair_services_read_staff
on public.repair_services for select to authenticated
using (public.is_org_member(organisation_id));
create policy repair_services_write_content
on public.repair_services for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor', 'website_editor']
  )
);

create policy repair_jobs_read_operational
on public.repair_jobs for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy repair_jobs_write_operational
on public.repair_jobs for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy repair_items_read_operational
on public.repair_job_items for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);
create policy repair_items_write_operational
on public.repair_job_items for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = repair_job_items.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);

create policy sales_read_management
on public.sales for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sales_read_assigned
on public.sales for select to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
);
create policy sales_write_management
on public.sales for all to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']))
with check (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy sales_write_assigned
on public.sales for all to authenticated
using (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
)
with check (
  public.has_org_role(organisation_id, array['salesperson'])
  and salesperson_id = auth.uid()
);

create policy tasks_read_management_or_assigned
on public.tasks for select to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
);
create policy tasks_insert_member
on public.tasks for insert to authenticated
with check (public.is_org_member(organisation_id));
create policy tasks_update_management_or_assigned
on public.tasks for update to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
)
with check (
  public.has_org_role(organisation_id, array['owner', 'manager'])
  or (
    public.is_org_member(organisation_id)
    and (assigned_user_id = auth.uid() or created_by = auth.uid())
  )
);

create policy task_comments_visible_task
on public.task_comments for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));
create policy task_comments_create_visible_task
on public.task_comments for insert to authenticated
with check (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy documents_read_operational
on public.documents for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
  or (
    public.has_org_role(organisation_id, array['technician'])
    and repair_job_id is not null
    and exists (
      select 1
      from public.repair_jobs rj
      where rj.id = documents.repair_job_id
        and rj.assigned_technician_id = auth.uid()
    )
  )
);
create policy documents_write_operational
on public.documents for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy notifications_read_own
on public.notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
);
create policy notifications_read_broadcast_management
on public.notifications for select to authenticated
using (
  recipient_user_id is null
  and public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);
create policy notifications_update_own
on public.notifications for update to authenticated
using (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
)
with check (
  recipient_user_id = auth.uid()
  and public.is_org_member(organisation_id)
);
create policy notifications_insert_management
on public.notifications for insert to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'service_advisor']
  )
);

create policy website_pages_read_staff
on public.website_pages for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);
create policy website_pages_write_content
on public.website_pages for all to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
)
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);

create policy integration_settings_read_management
on public.integration_settings for select to authenticated
using (public.has_org_role(organisation_id, array['owner', 'manager']));
create policy integration_settings_write_owner
on public.integration_settings for all to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

create policy webhook_events_read_management
on public.webhook_events for select to authenticated
using (
  organisation_id is not null
  and public.has_org_role(organisation_id, array['owner', 'manager'])
);

create policy audit_logs_read_owner
on public.audit_logs for select to authenticated
using (
  organisation_id is not null
  and public.has_org_role(organisation_id, array['owner'])
);

create view public.public_vehicle_inventory
with (security_barrier = true)
as
select * from public.public_safe_vehicles;

create view public.public_appointment_types
with (security_barrier = true)
as
select
  at.id,
  at.organisation_id,
  o.slug as organisation_slug,
  at.name,
  at.slug,
  at.description,
  at.category,
  at.duration_minutes,
  at.colour
from public.appointment_types at
join public.organisations o on o.id = at.organisation_id
where at.is_public_bookable = true
  and at.active = true
  and o.status = 'active'
  and o.deleted_at is null;

create view public.vehicle_presentation_records
with (security_barrier = true)
as
select
  v.id,
  v.organisation_id,
  v.stock_number,
  v.make,
  v.model,
  v.derivative,
  v.year,
  v.mileage,
  v.fuel_type,
  v.transmission,
  v.body_type,
  v.colour,
  v.status,
  v.public_title,
  v.attention_grabber,
  v.description,
  v.standard_equipment,
  v.optional_equipment,
  v.finance_example_text,
  v.warranty_wording,
  v.video_url,
  v.featured,
  v.is_public,
  v.slug,
  v.seo_title,
  v.seo_description,
  v.published_at,
  v.updated_at
from public.vehicles v
where v.deleted_at is null
  and public.has_org_role(
    v.organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  );

create view public.technician_repair_jobs
with (security_barrier = true)
as
select
  rj.id,
  rj.organisation_id,
  rj.reference,
  rj.appointment_id,
  rj.customer_vehicle_id,
  rj.assigned_technician_id,
  rj.status,
  rj.registration,
  rj.vehicle_make_model,
  rj.mileage,
  rj.reported_fault,
  rj.diagnosis,
  rj.work_completed,
  rj.technician_notes,
  rj.customer_facing_notes,
  rj.start_date,
  rj.due_date,
  rj.collection_date,
  rj.updated_at
from public.repair_jobs rj
where rj.deleted_at is null
  and rj.assigned_technician_id = auth.uid()
  and public.has_org_role(rj.organisation_id, array['technician']);

create or replace function public.public_available_appointment_slots(
  organisation_slug text,
  appointment_type_slug text,
  first_date date default current_date,
  number_of_days integer default 14
)
returns table (
  appointment_type_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  remaining_capacity integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select
      o.id as organisation_id,
      at.id as appointment_type_id
    from public.organisations o
    join public.appointment_types at on at.organisation_id = o.id
    where o.slug = organisation_slug
      and o.status = 'active'
      and o.deleted_at is null
      and at.slug = appointment_type_slug
      and at.is_public_bookable = true
      and at.active = true
      and number_of_days between 1 and 90
  ),
  calendar as (
    select
      ar.*,
      day_value::date as local_date
    from target t
    join public.availability_rules ar
      on ar.organisation_id = t.organisation_id
      and ar.appointment_type_id = t.appointment_type_id
      and ar.active = true
    cross join lateral generate_series(
      greatest(first_date, (now() at time zone ar.timezone)::date)::timestamp,
      least(
        first_date + (number_of_days - 1),
        (now() at time zone ar.timezone)::date + ar.maximum_advance_days
      )::timestamp,
      interval '1 day'
    ) day_value
    where extract(dow from day_value)::smallint = ar.weekday
      and (ar.valid_from is null or day_value::date >= ar.valid_from)
      and (ar.valid_until is null or day_value::date <= ar.valid_until)
  ),
  raw_slots as (
    select
      c.organisation_id,
      c.appointment_type_id,
      c.timezone,
      c.local_date,
      c.maximum_simultaneous,
      c.slot_duration_minutes,
      local_start at time zone c.timezone as slot_start,
      (
        local_start
        + make_interval(mins => c.slot_duration_minutes)
      ) at time zone c.timezone as slot_end
    from calendar c
    cross join lateral generate_series(
      c.local_date + c.start_time_local,
      c.local_date + c.end_time_local
        - make_interval(mins => c.slot_duration_minutes),
      make_interval(mins => c.slot_duration_minutes + c.buffer_minutes)
    ) local_start
    where
      (local_start at time zone c.timezone)
        >= now() + make_interval(mins => c.minimum_notice_minutes)
      and not exists (
        select 1
        from public.availability_exceptions ae
        where ae.organisation_id = c.organisation_id
          and (
            ae.appointment_type_id is null
            or ae.appointment_type_id = c.appointment_type_id
          )
          and ae.exception_date = c.local_date
          and ae.exception_type = 'closed'
          and (
            ae.start_time_local is null
            or (
              local_start::time < ae.end_time_local
              and (
                local_start
                + make_interval(mins => c.slot_duration_minutes)
              )::time > ae.start_time_local
            )
          )
      )
  ),
  capacities as (
    select
      rs.*,
      coalesce(
        (
          select ae.maximum_simultaneous
          from public.availability_exceptions ae
          where ae.organisation_id = rs.organisation_id
            and (
              ae.appointment_type_id is null
              or ae.appointment_type_id = rs.appointment_type_id
            )
            and ae.exception_date = rs.local_date
            and ae.exception_type = 'capacity_override'
            and (
              ae.start_time_local is null
              or (
                (rs.slot_start at time zone rs.timezone)::time < ae.end_time_local
                and (rs.slot_end at time zone rs.timezone)::time > ae.start_time_local
              )
            )
          order by ae.appointment_type_id nulls last
          limit 1
        ),
        rs.maximum_simultaneous
      ) as slot_capacity
    from raw_slots rs
  ),
  available as (
    select
      c.appointment_type_id,
      c.slot_start,
      c.slot_end,
      c.slot_capacity - (
        select count(*)::integer
        from public.appointments a
        where a.organisation_id = c.organisation_id
          and a.appointment_type_id = c.appointment_type_id
          and a.deleted_at is null
          and a.status in ('requested', 'confirmed', 'assigned')
          and a.booking_period && tstzrange(c.slot_start, c.slot_end, '[)')
      ) as remaining_capacity
    from capacities c
  )
  select distinct on (a.slot_start)
    a.appointment_type_id,
    a.slot_start as starts_at,
    a.slot_end as ends_at,
    a.remaining_capacity
  from available a
  where a.remaining_capacity > 0
  order by a.slot_start, a.remaining_capacity desc;
$$;

create or replace function public.book_repair_call(
  p_organisation_slug text,
  p_appointment_type_slug text,
  p_starts_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_reason_for_call text,
  p_fault_description text,
  p_registration text,
  p_vehicle_make_model text,
  p_consent boolean,
  p_privacy_accepted boolean,
  p_rate_limit_token text,
  p_warning_lights text default null,
  p_is_driveable boolean default null,
  p_preferred_contact_method text default 'phone',
  p_honeypot text default ''
)
returns table (
  appointment_id uuid,
  appointment_reference text,
  lead_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organisation public.organisations%rowtype;
  target_type public.appointment_types%rowtype;
  matched_customer_ids uuid[];
  target_customer_id uuid;
  target_customer_vehicle_id uuid;
  target_lead_id uuid;
  target_appointment_id uuid;
  target_appointment_reference text;
  target_ends_at timestamptz;
  available_remaining integer;
  existing_bookings integer;
  slot_capacity integer;
  selected_resource integer;
  resource_number integer;
  local_booking_date date;
  normalised_customer_phone text;
begin
  if nullif(trim(p_honeypot), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;

  if not coalesce(p_consent, false) or not coalesce(p_privacy_accepted, false) then
    raise exception 'Contact consent and privacy acknowledgement are required'
      using errcode = '22023';
  end if;

  if char_length(trim(p_first_name)) not between 1 and 80
    or char_length(trim(p_last_name)) not between 1 and 80
    or char_length(trim(p_reason_for_call)) not between 2 and 200
    or char_length(trim(p_fault_description)) not between 3 and 4000 then
    raise exception 'Required booking details are invalid'
      using errcode = '22023';
  end if;

  if p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid email address is required'
      using errcode = '22023';
  end if;

  normalised_customer_phone := public.normalise_phone(p_phone);
  if normalised_customer_phone is null
    or char_length(normalised_customer_phone) not between 10 and 15 then
    raise exception 'A valid telephone number is required'
      using errcode = '22023';
  end if;

  if p_preferred_contact_method not in ('email', 'phone', 'sms', 'either') then
    raise exception 'Preferred contact method is invalid'
      using errcode = '22023';
  end if;

  select o.*
  into strict target_organisation
  from public.organisations o
  where o.slug = p_organisation_slug
    and o.status = 'active'
    and o.deleted_at is null;

  select at.*
  into strict target_type
  from public.appointment_types at
  where at.organisation_id = target_organisation.id
    and at.slug = p_appointment_type_slug
    and at.category = 'repair_call'
    and at.is_public_bookable = true
    and at.active = true;

  perform public.consume_public_rate_limit(
    target_organisation.id,
    'book_repair_call',
    p_rate_limit_token,
    5,
    15
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_organisation.id::text
        || ':'
        || target_type.id::text
        || ':'
        || p_starts_at::text,
      0
    )
  );

  local_booking_date := (
    p_starts_at at time zone target_organisation.default_timezone
  )::date;

  select slots.ends_at, slots.remaining_capacity
  into target_ends_at, available_remaining
  from public.public_available_appointment_slots(
    p_organisation_slug,
    p_appointment_type_slug,
    local_booking_date,
    1
  ) slots
  where slots.starts_at = p_starts_at
  limit 1;

  if target_ends_at is null or available_remaining is null then
    raise exception 'That appointment slot is no longer available'
      using errcode = '23P01';
  end if;

  select count(*)::integer
  into existing_bookings
  from public.appointments a
  where a.organisation_id = target_organisation.id
    and a.appointment_type_id = target_type.id
    and a.deleted_at is null
    and a.status in ('requested', 'confirmed', 'assigned')
    and a.booking_period && tstzrange(p_starts_at, target_ends_at, '[)');

  slot_capacity := existing_bookings + available_remaining;

  select array_agg(c.id order by c.created_at)
  into matched_customer_ids
  from public.customers c
  where c.organisation_id = target_organisation.id
    and c.deleted_at is null
    and c.anonymised_at is null
    and (
      c.normalised_email = lower(trim(p_email))
      or c.normalised_phone = normalised_customer_phone
    );

  if coalesce(cardinality(matched_customer_ids), 0) > 1 then
    raise exception 'The supplied contact details match different customer records'
      using errcode = '23505';
  elsif coalesce(cardinality(matched_customer_ids), 0) = 1 then
    target_customer_id := matched_customer_ids[1];
    update public.customers
    set
      preferred_contact_method = p_preferred_contact_method,
      privacy_notice_accepted_at = coalesce(privacy_notice_accepted_at, now())
    where id = target_customer_id;
  else
    insert into public.customers (
      organisation_id,
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method,
      privacy_notice_accepted_at,
      marketing_consent,
      marketing_consent_source
    )
    values (
      target_organisation.id,
      trim(p_first_name),
      trim(p_last_name),
      lower(trim(p_email)),
      trim(p_phone),
      p_preferred_contact_method,
      now(),
      false,
      'repair-call booking'
    )
    returning id into target_customer_id;
  end if;

  if nullif(public.normalise_registration(p_registration), '') is not null then
    select cv.id
    into target_customer_vehicle_id
    from public.customer_vehicles cv
    where cv.customer_id = target_customer_id
      and cv.registration_normalised = public.normalise_registration(p_registration)
      and cv.deleted_at is null
    limit 1;

    if target_customer_vehicle_id is null then
      insert into public.customer_vehicles (
        organisation_id,
        customer_id,
        registration,
        make,
        model,
        relationship
      )
      values (
        target_organisation.id,
        target_customer_id,
        public.normalise_registration(p_registration),
        nullif(split_part(trim(p_vehicle_make_model), ' ', 1), ''),
        nullif(
          trim(substr(
            trim(p_vehicle_make_model),
            char_length(split_part(trim(p_vehicle_make_model), ' ', 1)) + 1
          )),
          ''
        ),
        'owned'
      )
      returning id into target_customer_vehicle_id;
    end if;
  end if;

  insert into public.leads (
    organisation_id,
    lead_type,
    status,
    priority,
    customer_id,
    subject,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at,
    last_activity_at,
    metadata
  )
  values (
    target_organisation.id,
    'repair_call',
    'appointment_booked',
    'normal',
    target_customer_id,
    'Repair call: ' || trim(p_reason_for_call),
    trim(p_fault_description),
    'website',
    p_preferred_contact_method,
    true,
    'transactional_only',
    now(),
    now(),
    jsonb_build_object(
      'registration_last_four',
      right(public.normalise_registration(p_registration), 4)
    )
  )
  returning id into target_lead_id;

  for resource_number in 1..least(slot_capacity, 20)
  loop
    if not exists (
      select 1
      from public.appointments a
      where a.organisation_id = target_organisation.id
        and a.appointment_type_id = target_type.id
        and a.booking_resource = resource_number
        and a.deleted_at is null
        and a.status in ('requested', 'confirmed', 'assigned')
        and a.booking_period && tstzrange(p_starts_at, target_ends_at, '[)')
    ) then
      selected_resource := resource_number;
      exit;
    end if;
  end loop;

  if selected_resource is null then
    raise exception 'That appointment slot is no longer available'
      using errcode = '23P01';
  end if;

  begin
    insert into public.appointments (
      organisation_id,
      appointment_type_id,
      customer_id,
      customer_vehicle_id,
      lead_id,
      starts_at,
      ends_at,
      booking_resource,
      status,
      reason_for_call,
      registration,
      vehicle_make_model,
      fault_description,
      warning_lights,
      is_driveable,
      preferred_contact_method
    )
    values (
      target_organisation.id,
      target_type.id,
      target_customer_id,
      target_customer_vehicle_id,
      target_lead_id,
      p_starts_at,
      target_ends_at,
      selected_resource,
      'requested',
      trim(p_reason_for_call),
      nullif(public.normalise_registration(p_registration), ''),
      nullif(trim(p_vehicle_make_model), ''),
      trim(p_fault_description),
      nullif(trim(p_warning_lights), ''),
      p_is_driveable,
      p_preferred_contact_method
    )
    returning id, reference
    into target_appointment_id, target_appointment_reference;
  exception
    when exclusion_violation then
      raise exception 'That appointment slot is no longer available'
        using errcode = '23P01';
  end;

  insert into public.lead_activities (
    organisation_id,
    lead_id,
    activity_type,
    direction,
    summary,
    metadata
  )
  values (
    target_organisation.id,
    target_lead_id,
    'appointment',
    'inbound',
    'Repair-call appointment requested online',
    jsonb_build_object('appointment_id', target_appointment_id)
  );

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  select
    target_organisation.id,
    om.user_id,
    'new_repair_booking',
    'New repair-call booking',
    trim(p_first_name) || ' ' || trim(p_last_name)
      || ' booked '
      || to_char(p_starts_at at time zone target_organisation.default_timezone, 'DD Mon YYYY HH24:MI'),
    '/admin/diary',
    'appointment',
    target_appointment_id
  from public.organisation_members om
  join public.roles r on r.id = om.role_id
  where om.organisation_id = target_organisation.id
    and om.status = 'active'
    and om.deleted_at is null
    and r.code in ('owner', 'manager', 'service_advisor');

  return query
  select
    target_appointment_id,
    target_appointment_reference,
    target_lead_id,
    p_starts_at,
    target_ends_at;
end;
$$;

create or replace function public.match_or_create_public_customer(
  p_organisation_id uuid,
  p_payload jsonb,
  p_consent_source text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_ids uuid[];
  customer_id uuid;
  customer_name text := nullif(trim(p_payload ->> 'name'), '');
  customer_email text := lower(nullif(trim(p_payload ->> 'email'), ''));
  customer_phone text := nullif(trim(p_payload ->> 'phone'), '');
  customer_phone_normalised text := public.normalise_phone(p_payload ->> 'phone');
  preferred_contact text := coalesce(
    nullif(p_payload ->> 'preferredContact', ''),
    'email'
  );
  marketing_allowed boolean := coalesce(
    (p_payload ->> 'marketingConsent')::boolean,
    false
  );
begin
  if customer_name is null or char_length(customer_name) > 120 then
    raise exception 'A valid customer name is required'
      using errcode = '22023';
  end if;
  if customer_email is null
    or customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'A valid customer email is required'
      using errcode = '22023';
  end if;
  if preferred_contact not in ('email', 'phone', 'sms', 'either') then
    raise exception 'Preferred contact method is invalid'
      using errcode = '22023';
  end if;

  select array_agg(c.id order by c.created_at)
  into customer_ids
  from public.customers c
  where c.organisation_id = p_organisation_id
    and c.deleted_at is null
    and c.anonymised_at is null
    and (
      c.normalised_email = customer_email
      or (
        customer_phone_normalised is not null
        and c.normalised_phone = customer_phone_normalised
      )
    );

  if coalesce(cardinality(customer_ids), 0) > 1 then
    raise exception 'The supplied contact details match different customer records'
      using errcode = '23505';
  elsif coalesce(cardinality(customer_ids), 0) = 1 then
    customer_id := customer_ids[1];
    update public.customers
    set
      preferred_contact_method = preferred_contact,
      privacy_notice_accepted_at = coalesce(
        privacy_notice_accepted_at,
        now()
      ),
      marketing_consent = marketing_consent or marketing_allowed,
      marketing_consent_at = case
        when marketing_allowed then coalesce(marketing_consent_at, now())
        else marketing_consent_at
      end,
      marketing_consent_source = case
        when marketing_allowed then coalesce(
          marketing_consent_source,
          p_consent_source
        )
        else marketing_consent_source
      end
    where id = customer_id;
  else
    insert into public.customers (
      organisation_id,
      full_name,
      email,
      phone,
      preferred_contact_method,
      marketing_consent,
      marketing_consent_at,
      marketing_consent_source,
      privacy_notice_accepted_at,
      consent_at,
      consent_source
    )
    values (
      p_organisation_id,
      customer_name,
      customer_email,
      customer_phone,
      preferred_contact,
      marketing_allowed,
      case when marketing_allowed then now() else null end,
      p_consent_source,
      now(),
      now(),
      p_consent_source
    )
    returning id into customer_id;
  end if;

  return customer_id;
end;
$$;

create or replace function public.submit_public_enquiry(
  p_organisation_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid;
  lead_id uuid;
  vehicle_id uuid;
  lead_kind text := coalesce(p_payload ->> 'enquiryType', 'general_enquiry');
  marketing_allowed boolean := coalesce(
    (p_payload ->> 'marketingConsent')::boolean,
    false
  );
begin
  if not exists (
    select 1 from public.organisations o
    where o.id = p_organisation_id
      and o.status = 'active'
      and o.deleted_at is null
  ) then
    raise exception 'Dealership is unavailable'
      using errcode = '22023';
  end if;
  if nullif(trim(p_payload ->> 'website'), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;
  if not coalesce((p_payload ->> 'consent')::boolean, false) then
    raise exception 'Contact consent is required'
      using errcode = '22023';
  end if;
  if lead_kind not in (
    'vehicle_enquiry',
    'callback_request',
    'test_drive',
    'part_exchange',
    'general_enquiry'
  ) then
    raise exception 'Enquiry type is invalid'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_payload ->> 'message', ''))) not between 1 and 3000 then
    raise exception 'A message is required'
      using errcode = '22023';
  end if;

  perform public.consume_public_rate_limit(
    p_organisation_id,
    'public_enquiry',
    coalesce(
      nullif(p_payload ->> 'rateLimitToken', ''),
      encode(
        extensions.digest(
          lower(coalesce(p_payload ->> 'email', ''))
            || ':'
            || coalesce(public.normalise_phone(p_payload ->> 'phone'), '')
            || ':'
            || current_date::text,
          'sha256'
        ),
        'hex'
      )
    ),
    6,
    15
  );

  customer_id := public.match_or_create_public_customer(
    p_organisation_id,
    p_payload,
    'public_website_enquiry'
  );

  vehicle_id := nullif(p_payload ->> 'vehicleId', '')::uuid;
  if vehicle_id is not null and not exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and v.organisation_id = p_organisation_id
      and v.deleted_at is null
  ) then
    raise exception 'Vehicle does not belong to this dealership'
      using errcode = '23514';
  end if;

  insert into public.leads (
    organisation_id,
    customer_id,
    vehicle_id,
    lead_type,
    status,
    priority,
    title,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at,
    utm_source,
    utm_medium,
    utm_campaign
  )
  values (
    p_organisation_id,
    customer_id,
    vehicle_id,
    lead_kind,
    'new',
    'normal',
    trim(p_payload ->> 'name') || ' — ' || replace(lead_kind, '_', ' '),
    trim(p_payload ->> 'message'),
    coalesce(nullif(p_payload ->> 'source', ''), 'website'),
    coalesce(nullif(p_payload ->> 'preferredContact', ''), 'email'),
    true,
    case
      when marketing_allowed then 'marketing_granted'
      else 'transactional_only'
    end,
    now(),
    nullif(p_payload ->> 'utmSource', ''),
    nullif(p_payload ->> 'utmMedium', ''),
    nullif(p_payload ->> 'utmCampaign', '')
  )
  returning id into lead_id;

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  values (
    p_organisation_id,
    null,
    'new_lead',
    'New website enquiry',
    trim(p_payload ->> 'name') || ' submitted a ' || replace(lead_kind, '_', ' '),
    '/admin/leads',
    'lead',
    lead_id
  );

  return jsonb_build_object(
    'customer_id', customer_id,
    'lead_id', lead_id
  );
end;
$$;

create or replace function public.submit_public_sourcing_request(
  p_organisation_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid;
  request_id uuid;
  lead_id uuid;
  requested_make text := nullif(trim(p_payload ->> 'make'), '');
  requested_model text := nullif(trim(p_payload ->> 'model'), '');
begin
  if not exists (
    select 1 from public.organisations o
    where o.id = p_organisation_id
      and o.status = 'active'
      and o.deleted_at is null
  ) then
    raise exception 'Dealership is unavailable'
      using errcode = '22023';
  end if;
  if nullif(trim(p_payload ->> 'website'), '') is not null then
    raise exception 'Unable to accept this submission'
      using errcode = '22023';
  end if;
  if not coalesce((p_payload ->> 'consent')::boolean, false)
    or not coalesce((p_payload ->> 'privacyAcknowledged')::boolean, false) then
    raise exception 'Consent and privacy acknowledgement are required'
      using errcode = '22023';
  end if;
  if requested_make is null or requested_model is null then
    raise exception 'Vehicle make and model are required'
      using errcode = '22023';
  end if;

  perform public.consume_public_rate_limit(
    p_organisation_id,
    'public_sourcing',
    coalesce(
      nullif(p_payload ->> 'rateLimitToken', ''),
      encode(
        extensions.digest(
          lower(coalesce(p_payload ->> 'email', ''))
            || ':'
            || coalesce(public.normalise_phone(p_payload ->> 'phone'), '')
            || ':'
            || current_date::text,
          'sha256'
        ),
        'hex'
      )
    ),
    4,
    30
  );

  customer_id := public.match_or_create_public_customer(
    p_organisation_id,
    p_payload,
    'public_sourcing_request'
  );

  insert into public.sourcing_requests (
    organisation_id,
    customer_id,
    status,
    priority,
    preferred_make,
    preferred_model,
    alternative_models,
    alternative_vehicles,
    minimum_year,
    maximum_mileage,
    fuel_preference,
    transmission_preference,
    colour_preferences,
    required_features,
    budget,
    deposit_available,
    finance_required,
    part_exchange,
    desired_timescale,
    requirements
  )
  values (
    p_organisation_id,
    customer_id,
    'new',
    'normal',
    requested_make,
    requested_model,
    nullif(p_payload ->> 'alternatives', ''),
    nullif(p_payload ->> 'alternatives', ''),
    nullif(p_payload ->> 'minimumYear', '')::integer,
    nullif(p_payload ->> 'maximumMileage', '')::integer,
    nullif(p_payload ->> 'fuelPreference', ''),
    nullif(p_payload ->> 'transmission', ''),
    nullif(p_payload ->> 'colourPreferences', ''),
    nullif(p_payload ->> 'requiredFeatures', ''),
    (p_payload ->> 'budget')::numeric,
    coalesce(nullif(p_payload ->> 'depositAvailable', '')::numeric, 0),
    coalesce((p_payload ->> 'financeRequired')::boolean, false),
    coalesce((p_payload ->> 'partExchange')::boolean, false),
    nullif(p_payload ->> 'desiredTimescale', ''),
    nullif(p_payload ->> 'requirements', '')
  )
  returning id into request_id;

  insert into public.leads (
    organisation_id,
    customer_id,
    sourcing_request_id,
    lead_type,
    status,
    priority,
    title,
    message,
    source,
    preferred_contact_method,
    consent_status,
    consent_scope,
    consent_recorded_at
  )
  values (
    p_organisation_id,
    customer_id,
    request_id,
    'car_sourcing',
    'new',
    'normal',
    trim(p_payload ->> 'name') || ' — ' || requested_make || ' ' || requested_model,
    nullif(p_payload ->> 'requirements', ''),
    'website',
    coalesce(nullif(p_payload ->> 'preferredContact', ''), 'email'),
    true,
    'transactional_only',
    now()
  )
  returning id into lead_id;

  update public.sourcing_requests
  set lead_id = submit_public_sourcing_request.lead_id
  where id = request_id;

  insert into public.notifications (
    organisation_id,
    recipient_user_id,
    notification_type,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  values (
    p_organisation_id,
    null,
    'new_sourcing_request',
    'New sourcing request',
    trim(p_payload ->> 'name') || ' is looking for a ' || requested_make || ' ' || requested_model,
    '/admin/sourcing',
    'sourcing_request',
    request_id
  );

  return jsonb_build_object(
    'customer_id', customer_id,
    'sourcing_request_id', request_id,
    'lead_id', lead_id
  );
end;
$$;

create or replace function public.book_repair_call(
  p_organisation_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_email text,
  p_phone text,
  p_preferred_contact text,
  p_reason text,
  p_registration text,
  p_make_model text,
  p_fault_description text,
  p_warning_lights text,
  p_driveable text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organisation_slug text;
  appointment_type_slug text;
  clean_name text := trim(p_name);
  final_space integer;
  first_name text;
  last_name text;
  booked record;
  customer_id uuid;
begin
  select o.slug
  into strict organisation_slug
  from public.organisations o
  where o.id = p_organisation_id
    and o.status = 'active'
    and o.deleted_at is null;

  select at.slug
  into strict appointment_type_slug
  from public.appointment_types at
  where at.organisation_id = p_organisation_id
    and at.category = 'repair_call'
    and at.is_public_bookable = true
    and at.active = true
  order by at.created_at
  limit 1;

  final_space := length(clean_name) - strpos(reverse(clean_name), ' ') + 1;
  if final_space > 0 and final_space < length(clean_name) then
    first_name := trim(substr(clean_name, 1, final_space - 1));
    last_name := trim(substr(clean_name, final_space + 1));
  else
    first_name := clean_name;
    last_name := 'Customer';
  end if;

  select *
  into strict booked
  from public.book_repair_call(
    p_organisation_slug => organisation_slug,
    p_appointment_type_slug => appointment_type_slug,
    p_starts_at => p_starts_at,
    p_first_name => first_name,
    p_last_name => last_name,
    p_email => p_email,
    p_phone => p_phone,
    p_reason_for_call => p_reason,
    p_fault_description => p_fault_description,
    p_registration => p_registration,
    p_vehicle_make_model => p_make_model,
    p_consent => true,
    p_privacy_accepted => true,
    p_rate_limit_token => encode(
      extensions.digest(
        lower(trim(p_email))
          || ':'
          || coalesce(public.normalise_phone(p_phone), '')
          || ':'
          || current_date::text,
        'sha256'
      ),
      'hex'
    ),
    p_warning_lights => p_warning_lights,
    p_is_driveable => case p_driveable
      when 'yes' then true
      when 'no' then false
      else null
    end,
    p_preferred_contact_method => p_preferred_contact,
    p_honeypot => ''
  );

  select a.customer_id
  into strict customer_id
  from public.appointments a
  where a.id = booked.appointment_id;

  return jsonb_build_object(
    'appointment_id', booked.appointment_id,
    'lead_id', booked.lead_id,
    'customer_id', customer_id,
    'starts_at', booked.starts_at,
    'ends_at', booked.ends_at
  );
end;
$$;

create or replace function public.update_vehicle_presentation(
  p_vehicle_id uuid,
  p_public_title text,
  p_attention_grabber text,
  p_description text,
  p_standard_equipment text,
  p_optional_equipment text,
  p_finance_example_text text,
  p_warranty_wording text,
  p_video_url text,
  p_featured boolean,
  p_is_public boolean,
  p_slug text,
  p_seo_title text,
  p_seo_description text
)
returns public.vehicle_presentation_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organisation_id uuid;
  result public.vehicle_presentation_records;
begin
  select organisation_id
  into strict target_organisation_id
  from public.vehicles
  where id = p_vehicle_id
    and deleted_at is null;

  if not public.has_org_role(
    target_organisation_id,
    array['owner', 'manager', 'salesperson', 'website_editor']
  ) then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  update public.vehicles
  set
    public_title = nullif(trim(p_public_title), ''),
    attention_grabber = nullif(trim(p_attention_grabber), ''),
    description = nullif(trim(p_description), ''),
    standard_equipment = nullif(trim(p_standard_equipment), ''),
    optional_equipment = nullif(trim(p_optional_equipment), ''),
    finance_example_text = nullif(trim(p_finance_example_text), ''),
    warranty_wording = nullif(trim(p_warranty_wording), ''),
    video_url = nullif(trim(p_video_url), ''),
    featured = p_featured,
    is_public = p_is_public,
    slug = nullif(trim(p_slug), ''),
    seo_title = nullif(trim(p_seo_title), ''),
    seo_description = nullif(trim(p_seo_description), ''),
    published_at = case
      when p_is_public and published_at is null then now()
      when not p_is_public then null
      else published_at
    end
  where id = p_vehicle_id;

  select *
  into strict result
  from public.vehicle_presentation_records
  where id = p_vehicle_id;

  return result;
end;
$$;

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

create or replace function public.storage_object_org_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  if first_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return first_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vehicle-public',
    'vehicle-public',
    true,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'branding-public',
    'branding-public',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
  ),
  (
    'private-documents',
    'private-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ),
  (
    'repair-uploads',
    'repair-uploads',
    false,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_public_media_read
on storage.objects for select
to anon, authenticated
using (bucket_id in ('vehicle-public', 'branding-public'));

create policy storage_public_media_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_public_media_update
on storage.objects for update
to authenticated
using (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
)
with check (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_public_media_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in ('vehicle-public', 'branding-public')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'website_editor']
  )
);

create policy storage_private_read
on storage.objects for select
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_write
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_update
on storage.objects for update
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
)
with check (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

create policy storage_private_delete
on storage.objects for delete
to authenticated
using (
  bucket_id in ('private-documents', 'repair-uploads')
  and public.has_org_role(
    public.storage_object_org_id(name),
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads',
    'lead_activities',
    'sourcing_requests',
    'sourcing_candidates',
    'appointment_types',
    'availability_rules',
    'availability_exceptions',
    'appointments',
    'repair_services',
    'repair_jobs',
    'repair_job_items',
    'sales',
    'tasks',
    'task_comments',
    'documents',
    'notifications',
    'website_pages',
    'integration_settings',
    'webhook_events',
    'audit_logs'
  ]
  loop
    execute format('revoke all on public.%I from anon', table_name);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
  end loop;
end;
$$;

revoke all on public.public_vehicle_inventory from public;
revoke all on public.public_appointment_types from public;
revoke all on public.vehicle_presentation_records from public;
revoke all on public.technician_repair_jobs from public;
grant select on public.public_vehicle_inventory to anon, authenticated;
grant select on public.public_appointment_types to anon, authenticated;
grant select on public.vehicle_presentation_records to authenticated;
grant select on public.technician_repair_jobs to authenticated;

revoke all on function public.consume_public_rate_limit(uuid, text, text, integer, integer) from public;
revoke all on function public.assert_same_organisation() from public;
revoke all on function public.audit_row_change() from public;
revoke all on function public.match_or_create_public_customer(uuid, jsonb, text) from public;
revoke all on function public.submit_public_enquiry(uuid, jsonb) from public;
revoke all on function public.submit_public_sourcing_request(uuid, jsonb) from public;
revoke all on function public.public_available_appointment_slots(text, text, date, integer) from public;
revoke all on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) from public;
revoke all on function public.book_repair_call(
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.update_vehicle_presentation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  text
) from public;
revoke all on function public.update_assigned_repair_job(
  uuid,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.update_assigned_repair_job(uuid, jsonb)
  from public;
revoke all on function public.storage_object_org_id(text) from public;

grant execute on function public.public_available_appointment_slots(text, text, date, integer)
  to anon, authenticated;
grant execute on function public.submit_public_enquiry(uuid, jsonb)
  to service_role;
grant execute on function public.submit_public_sourcing_request(uuid, jsonb)
  to service_role;
grant execute on function public.book_repair_call(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  boolean,
  text,
  text
) to anon, authenticated;
grant execute on function public.book_repair_call(
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
grant execute on function public.update_vehicle_presentation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  text,
  text
) to authenticated;
grant execute on function public.update_assigned_repair_job(
  uuid,
  jsonb
) to authenticated;

commit;
