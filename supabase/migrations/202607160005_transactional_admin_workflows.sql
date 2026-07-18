begin;

drop policy if exists storage_public_media_insert on storage.objects;
drop policy if exists storage_public_media_update on storage.objects;
drop policy if exists storage_public_media_delete on storage.objects;
drop policy if exists storage_private_write on storage.objects;
drop policy if exists storage_private_update on storage.objects;
drop policy if exists storage_private_delete on storage.objects;

drop policy if exists sourcing_write_assigned_sales
  on public.sourcing_requests;
drop policy if exists sourcing_candidates_write_request
  on public.sourcing_candidates;
drop policy if exists sourcing_candidates_write_management
  on public.sourcing_candidates;
create policy sourcing_candidates_write_management
on public.sourcing_candidates for all to authenticated
using (
  public.has_org_role(organisation_id, array['owner', 'manager'])
)
with check (
  public.has_org_role(organisation_id, array['owner', 'manager'])
);

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
where id = 'branding-public';

alter table public.sourcing_requests
  add column if not exists expected_margin numeric(12,2)
    check (expected_margin between -1000000 and 1000000);

revoke execute on function public.book_repair_call(
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
) from anon, authenticated;
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
) to service_role;

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email citext not null,
  role text not null
    check (
      role in (
        'manager',
        'salesperson',
        'service_advisor',
        'technician',
        'website_editor'
      )
    ),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, email),
  check (expires_at > created_at)
);

create index team_invitations_pending_idx
  on public.team_invitations (organisation_id, expires_at)
  where accepted_at is null;

create trigger team_invitations_touch_updated_at
before update on public.team_invitations
for each row execute function public.touch_updated_at();

alter table public.team_invitations enable row level security;

create policy team_invitations_owner_read
on public.team_invitations for select
to authenticated
using (public.has_org_role(organisation_id, array['owner']));

create policy team_invitations_owner_write
on public.team_invitations for all
to authenticated
using (public.has_org_role(organisation_id, array['owner']))
with check (public.has_org_role(organisation_id, array['owner']));

revoke all on public.team_invitations from anon;
grant select, insert, update, delete on public.team_invitations to authenticated;
grant all on public.team_invitations to service_role;

create table public.sourcing_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sourcing_request_id uuid not null
    references public.sourcing_requests(id) on delete cascade,
  activity_type text not null default 'note'
    check (
      activity_type in (
        'note',
        'status_change',
        'assignment',
        'candidate_added',
        'candidate_sent',
        'customer_decision',
        'task',
        'system'
      )
    ),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index sourcing_activities_request_idx
  on public.sourcing_activities (sourcing_request_id, created_at desc);

create or replace function public.check_sourcing_activity_organisation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.sourcing_requests sr
    where sr.id = new.sourcing_request_id
      and sr.organisation_id = new.organisation_id
  ) then
    raise exception 'Sourcing activity organisation mismatch'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger sourcing_activities_check_organisation
before insert or update on public.sourcing_activities
for each row execute function public.check_sourcing_activity_organisation();

alter table public.sourcing_activities enable row level security;

create policy sourcing_activities_operational_read
on public.sourcing_activities for select
to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy sourcing_activities_operational_write
on public.sourcing_activities for insert
to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

revoke all on public.sourcing_activities from anon;
grant select, insert on public.sourcing_activities to authenticated;
grant all on public.sourcing_activities to service_role;

create or replace function public.accept_team_invitation(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  invitation public.team_invitations%rowtype;
  invited_role_id uuid;
  invited_email text;
  user_metadata jsonb;
  user_confirmed_at timestamptz;
begin
  select
    u.email,
    u.raw_user_meta_data,
    u.email_confirmed_at
  into strict
    invited_email,
    user_metadata,
    user_confirmed_at
  from auth.users u
  where u.id = p_user_id;

  if user_confirmed_at is null then
    raise exception 'Invitation email has not been confirmed'
      using errcode = '42501';
  end if;

  begin
    invitation_id := nullif(
      user_metadata ->> 'invitation_id',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      invitation_id := null;
  end;

  if invitation_id is null then
    raise exception 'Invitation metadata is missing'
      using errcode = '22023';
  end if;

  select *
  into strict invitation
  from public.team_invitations ti
  where ti.id = invitation_id
    and ti.accepted_at is null
    and ti.expires_at > now()
    and lower(ti.email::text) = lower(invited_email)
  for update;

  select r.id
  into strict invited_role_id
  from public.roles r
  where r.code = invitation.role;

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role_id,
    role,
    status,
    invited_email,
    invited_at,
    joined_at,
    created_by
  )
  values (
    invitation.organisation_id,
    p_user_id,
    invited_role_id,
    invitation.role,
    'active',
    invitation.email,
    invitation.created_at,
    now(),
    invitation.invited_by
  )
  on conflict (organisation_id, user_id) do update
  set
    role_id = excluded.role_id,
    role = excluded.role,
    status = 'active',
    joined_at = now(),
    deleted_at = null;

  update public.team_invitations
  set
    accepted_at = now(),
    accepted_by = p_user_id
  where id = invitation.id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    invitation.organisation_id,
    p_user_id,
    'organisation_members',
    p_user_id,
    'team.invitation_accepted',
    'organisation_member',
    p_user_id,
    jsonb_build_object('role', invitation.role),
    'database'
  );

  return jsonb_build_object(
    'organisation_id', invitation.organisation_id,
    'user_id', p_user_id,
    'role', invitation.role
  );
end;
$$;

create or replace function public.merge_customers(
  p_organisation_id uuid,
  p_source_customer_id uuid,
  p_target_customer_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_customer jsonb;
  target_customer jsonb;
  source_vehicle record;
  target_vehicle_id uuid;
begin
  if p_source_customer_id = p_target_customer_id then
    raise exception 'Source and target customer must be different'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Customer merge is not permitted'
      using errcode = '42501';
  end if;

  select to_jsonb(c)
  into strict source_customer
  from public.customers c
  where c.id = p_source_customer_id
    and c.organisation_id = p_organisation_id
    and c.deleted_at is null
  for update;

  select to_jsonb(c)
  into strict target_customer
  from public.customers c
  where c.id = p_target_customer_id
    and c.organisation_id = p_organisation_id
    and c.deleted_at is null
  for update;

  for source_vehicle in
    select cv.*
    from public.customer_vehicles cv
    where cv.organisation_id = p_organisation_id
      and cv.customer_id = p_source_customer_id
      and cv.deleted_at is null
    for update
  loop
    target_vehicle_id := null;
    if source_vehicle.registration_normalised is not null then
      select cv.id
      into target_vehicle_id
      from public.customer_vehicles cv
      where cv.organisation_id = p_organisation_id
        and cv.customer_id = p_target_customer_id
        and cv.registration_normalised = source_vehicle.registration_normalised
        and cv.deleted_at is null
      limit 1;
    end if;

    if target_vehicle_id is not null then
      update public.appointments
      set customer_vehicle_id = target_vehicle_id
      where organisation_id = p_organisation_id
        and customer_vehicle_id = source_vehicle.id;

      update public.repair_jobs
      set customer_vehicle_id = target_vehicle_id
      where organisation_id = p_organisation_id
        and customer_vehicle_id = source_vehicle.id;

      update public.customer_vehicles
      set deleted_at = now()
      where id = source_vehicle.id;
    else
      update public.customer_vehicles
      set customer_id = p_target_customer_id
      where id = source_vehicle.id;
    end if;
  end loop;

  update public.leads
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.sourcing_requests
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.appointments
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.repair_jobs
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.sales
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.tasks
  set customer_id = p_target_customer_id
  where organisation_id = p_organisation_id
    and customer_id = p_source_customer_id;

  update public.documents
  set
    customer_id = case
      when customer_id = p_source_customer_id then p_target_customer_id
      else customer_id
    end,
    entity_id = case
      when entity_type = 'customer' and entity_id = p_source_customer_id
        then p_target_customer_id
      else entity_id
    end
  where organisation_id = p_organisation_id
    and (
      customer_id = p_source_customer_id
      or (entity_type = 'customer' and entity_id = p_source_customer_id)
    );

  update public.customers
  set
    merged_into_customer_id = p_target_customer_id,
    marketing_consent = false,
    do_not_contact = true,
    deleted_at = now()
  where id = p_source_customer_id
    and organisation_id = p_organisation_id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'customers',
    p_source_customer_id,
    'customer.merged',
    'customer',
    p_target_customer_id,
    jsonb_build_object(
      'source', source_customer,
      'target', target_customer
    ),
    jsonb_build_object(
      'source_customer_id', p_source_customer_id,
      'target_customer_id', p_target_customer_id
    ),
    'application'
  );

  return jsonb_build_object(
    'source_customer_id', p_source_customer_id,
    'target_customer_id', p_target_customer_id,
    'merged', true
  );
end;
$$;

create or replace function public.record_vehicle_sale(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_customer_id uuid,
  p_salesperson_id uuid,
  p_sale_price numeric,
  p_deposit numeric,
  p_part_exchange_allowance numeric,
  p_discount numeric,
  p_warranty text,
  p_payment_method text,
  p_sale_date date,
  p_handover_date date,
  p_internal_notes text,
  p_additional_products text[],
  p_completion_checklist jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle public.vehicles%rowtype;
  sale_id uuid;
  realised_gross numeric(12,2);
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Recording a completed sale is not permitted'
      using errcode = '42501';
  end if;

  if p_sale_price <= 0
    or p_deposit < 0
    or p_part_exchange_allowance < 0
    or p_discount < 0
    or p_deposit > p_sale_price then
    raise exception 'Sale amounts are invalid'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_completion_checklist, '[]'::jsonb)) <> 'array' then
    raise exception 'Completion checklist must be a JSON array'
      using errcode = '22023';
  end if;

  select *
  into strict vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;

  if vehicle.status in ('sold', 'returned', 'archived') then
    raise exception 'Vehicle is already closed or sold'
      using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.organisation_id = p_organisation_id
      and c.deleted_at is null
  ) then
    raise exception 'Customer does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_salesperson_id is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_salesperson_id
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Salesperson does not belong to this dealership'
      using errcode = '23514';
  end if;

  realised_gross := p_sale_price
    - coalesce(vehicle.purchase_price, 0)
    - coalesce(vehicle.preparation_costs, 0)
    - coalesce(vehicle.repair_costs, 0)
    - coalesce(vehicle.other_costs, 0);

  insert into public.sales (
    organisation_id,
    vehicle_id,
    customer_id,
    salesperson_id,
    status,
    sale_price,
    deposit,
    part_exchange_allowance,
    discount,
    warranty,
    additional_products,
    payment_method,
    sale_date,
    handover_date,
    gross_profit,
    internal_notes,
    completion_checklist,
    completed_at,
    created_by
  )
  values (
    p_organisation_id,
    p_vehicle_id,
    p_customer_id,
    p_salesperson_id,
    'completed',
    p_sale_price,
    p_deposit,
    p_part_exchange_allowance,
    p_discount,
    nullif(trim(p_warranty), ''),
    to_jsonb(coalesce(p_additional_products, array[]::text[])),
    p_payment_method,
    p_sale_date,
    p_handover_date,
    realised_gross,
    nullif(trim(p_internal_notes), ''),
    coalesce(p_completion_checklist, '[]'::jsonb),
    now(),
    p_actor_user_id
  )
  returning id into sale_id;

  update public.vehicles
  set
    status = 'sold',
    actual_sale_price = p_sale_price,
    sold_at = p_sale_date,
    updated_by = p_actor_user_id
  where id = p_vehicle_id;

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
    'vehicle_sold',
    'Vehicle sold',
    vehicle.make || ' ' || vehicle.model || ' has been recorded as sold.',
    '/admin/sales',
    'sale',
    sale_id
  );

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'sales',
    sale_id,
    'sale.completed',
    'sale',
    sale_id,
    jsonb_build_object(
      'vehicle_status', vehicle.status,
      'vehicle_actual_sale_price', vehicle.actual_sale_price
    ),
    jsonb_build_object(
      'vehicle_id', p_vehicle_id,
      'customer_id', p_customer_id,
      'sale_price', p_sale_price,
      'gross_profit', realised_gross
    ),
    'application'
  );

  return jsonb_build_object(
    'sale_id', sale_id,
    'vehicle_id', p_vehicle_id,
    'gross_profit', realised_gross,
    'status', 'completed'
  );
end;
$$;

create or replace function public.reorder_vehicle_images(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_image_ids uuid[],
  p_cover_image_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_id uuid;
  image_position integer := 0;
  active_count integer;
  distinct_count integer;
  old_order jsonb;
  new_order jsonb;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Image reordering is not permitted'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_image_ids), 0) = 0 then
    raise exception 'At least one image is required'
      using errcode = '22023';
  end if;

  perform vi.id
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null
  for update;

  select count(*)
  into active_count
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  select count(distinct candidate)
  into distinct_count
  from unnest(p_image_ids) as candidate;

  if active_count <> cardinality(p_image_ids)
    or distinct_count <> cardinality(p_image_ids)
    or exists (
      select 1
      from unnest(p_image_ids) as candidate
      where not exists (
        select 1
        from public.vehicle_images vi
        where vi.id = candidate
          and vi.organisation_id = p_organisation_id
          and vi.vehicle_id = p_vehicle_id
          and vi.deleted_at is null
      )
    ) then
    raise exception 'Image order must contain every active vehicle image exactly once'
      using errcode = '23514';
  end if;

  if not p_cover_image_id = any(p_image_ids) then
    raise exception 'Cover image must be part of the image order'
      using errcode = '23514';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', vi.id,
      'sort_order', vi.sort_order,
      'is_cover', vi.is_cover
    )
    order by vi.sort_order
  )
  into old_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  update public.vehicle_images
  set
    is_cover = false,
    sort_order = sort_order + 1000000
  where organisation_id = p_organisation_id
    and vehicle_id = p_vehicle_id
    and deleted_at is null;

  foreach image_id in array p_image_ids
  loop
    update public.vehicle_images
    set
      sort_order = image_position,
      is_cover = image_id = p_cover_image_id,
      updated_at = now()
    where id = image_id
      and organisation_id = p_organisation_id
      and vehicle_id = p_vehicle_id
      and deleted_at is null;
    image_position := image_position + 1;
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'id', vi.id,
      'sort_order', vi.sort_order,
      'is_cover', vi.is_cover
    )
    order by vi.sort_order
  )
  into new_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicle_images',
    p_vehicle_id,
    'vehicle_images.reordered',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object('images', old_order),
    jsonb_build_object('images', new_order),
    'application'
  );

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'images', new_order
  );
end;
$$;

create or replace function public.replace_availability_rules(
  p_organisation_id uuid,
  p_appointment_type_id uuid,
  p_rules jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'service_advisor')
  ) then
    raise exception 'Availability settings are not permitted'
      using errcode = '42501';
  end if;

  perform at.id
  from public.appointment_types at
  where at.id = p_appointment_type_id
    and at.organisation_id = p_organisation_id
    and at.active = true
  for update;
  if not found then
    raise exception 'Appointment type does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_rules is null or jsonb_typeof(p_rules) is distinct from 'array' then
    raise exception 'Availability rules must be a non-empty array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_rules) not between 1 and 14 then
    raise exception 'Availability rules must be a non-empty array'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rules) as rule
    where (rule ->> 'weekday')::integer not between 0 and 6
      or (rule ->> 'start_time_local')::time
        >= (rule ->> 'end_time_local')::time
      or (rule ->> 'slot_duration_minutes')::integer not between 5 and 480
      or (rule ->> 'buffer_minutes')::integer not between 0 and 240
      or (rule ->> 'minimum_notice_minutes')::integer not between 0 and 10080
      or (rule ->> 'maximum_advance_days')::integer not between 1 and 365
      or (rule ->> 'maximum_simultaneous')::integer not between 1 and 20
  ) then
    raise exception 'One or more availability rules are invalid'
      using errcode = '22023';
  end if;

  delete from public.availability_rules ar
  where ar.organisation_id = p_organisation_id
    and ar.appointment_type_id = p_appointment_type_id
    and ar.staff_user_id is null;

  insert into public.availability_rules (
    organisation_id,
    appointment_type_id,
    staff_user_id,
    weekday,
    start_time_local,
    end_time_local,
    slot_duration_minutes,
    buffer_minutes,
    minimum_notice_minutes,
    maximum_advance_days,
    maximum_simultaneous,
    timezone,
    appointment_type,
    active,
    created_by
  )
  select
    p_organisation_id,
    p_appointment_type_id,
    null,
    (rule ->> 'weekday')::smallint,
    (rule ->> 'start_time_local')::time,
    (rule ->> 'end_time_local')::time,
    (rule ->> 'slot_duration_minutes')::integer,
    (rule ->> 'buffer_minutes')::integer,
    (rule ->> 'minimum_notice_minutes')::integer,
    (rule ->> 'maximum_advance_days')::integer,
    (rule ->> 'maximum_simultaneous')::integer,
    coalesce(nullif(rule ->> 'timezone', ''), 'Europe/London'),
    coalesce(nullif(rule ->> 'appointment_type', ''), 'repair_call'),
    coalesce((rule ->> 'active')::boolean, true),
    p_actor_user_id
  from jsonb_array_elements(p_rules) as rule;

  get diagnostics inserted_count = row_count;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'availability_rules',
    p_appointment_type_id,
    'availability_rules.replaced',
    'appointment_type',
    p_appointment_type_id,
    jsonb_build_object('rule_count', inserted_count),
    'application'
  );

  return jsonb_build_object(
    'appointment_type_id', p_appointment_type_id,
    'rule_count', inserted_count
  );
end;
$$;

create or replace function public.publish_homepage(
  p_organisation_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_record public.website_pages%rowtype;
  hero jsonb;
  published_at_value timestamptz := now();
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'website_editor')
  ) then
    raise exception 'Homepage publishing is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict page_record
  from public.website_pages wp
  where wp.organisation_id = p_organisation_id
    and wp.slug = 'home'
    and wp.deleted_at is null
  for update;

  if page_record.requires_legal_review then
    raise exception 'Legal review must be completed before publishing'
      using errcode = '42501';
  end if;

  hero := page_record.content -> 'hero';
  if jsonb_typeof(hero) is distinct from 'object'
    or nullif(trim(hero ->> 'eyebrow'), '') is null
    or nullif(trim(hero ->> 'heading'), '') is null
    or nullif(trim(hero ->> 'body'), '') is null then
    raise exception 'Homepage draft is incomplete'
      using errcode = '22023';
  end if;

  update public.dealership_settings
  set homepage_wording =
    coalesce(homepage_wording, '{}'::jsonb) ||
    jsonb_build_object(
      'eyebrow', hero ->> 'eyebrow',
      'headline', hero ->> 'heading',
      'title', hero ->> 'heading',
      'summary', hero ->> 'body',
      'body', hero ->> 'body',
      'primaryLabel', hero ->> 'primaryLabel',
      'primaryHref', hero ->> 'primaryHref',
      'imageAlt', hero ->> 'imageAlt',
      'seoTitle', page_record.seo_title,
      'seoDescription', page_record.seo_description
    )
  where organisation_id = p_organisation_id;

  if not found then
    raise exception 'Dealership settings are missing'
      using errcode = 'P0002';
  end if;

  update public.website_pages
  set
    status = 'published',
    published_at = published_at_value,
    published_by = p_actor_user_id
  where id = page_record.id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'website_pages',
    page_record.id,
    'website.homepage_published',
    'website_page',
    page_record.id,
    jsonb_build_object(
      'status', page_record.status,
      'published_at', page_record.published_at
    ),
    jsonb_build_object(
      'status', 'published',
      'published_at', published_at_value
    ),
    'application'
  );

  return jsonb_build_object(
    'page_id', page_record.id,
    'status', 'published',
    'published_at', published_at_value
  );
end;
$$;

create or replace function public.update_sourcing_request(
  p_organisation_id uuid,
  p_sourcing_request_id uuid,
  p_changes jsonb,
  p_note text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.sourcing_requests%rowtype;
  updated_record public.sourcing_requests%rowtype;
  next_status text;
  next_priority text;
  next_assignee uuid;
  next_sourcing_fee numeric;
  next_expected_margin numeric;
  activity_type_value text := 'system';
  activity_body text;
begin
  if jsonb_typeof(coalesce(p_changes, '{}'::jsonb)) <> 'object' then
    raise exception 'Sourcing changes must be a JSON object'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager')
  ) then
    raise exception 'Sourcing updates are not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict request_record
  from public.sourcing_requests sr
  where sr.id = p_sourcing_request_id
    and sr.organisation_id = p_organisation_id
    and sr.deleted_at is null
  for update;

  next_status := case
    when p_changes ? 'status' then p_changes ->> 'status'
    else request_record.status
  end;
  if next_status not in (
    'new',
    'contact_attempted',
    'requirements_confirmed',
    'search_active',
    'options_found',
    'option_sent_to_customer',
    'inspection_required',
    'negotiation',
    'deposit_requested',
    'vehicle_secured',
    'preparing_vehicle',
    'completed',
    'paused',
    'lost'
  ) then
    raise exception 'Invalid sourcing status'
      using errcode = '22023';
  end if;

  next_priority := case
    when p_changes ? 'priority' then p_changes ->> 'priority'
    else request_record.priority
  end;
  if next_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid sourcing priority'
      using errcode = '22023';
  end if;

  if p_changes ? 'assignedUserId' then
    begin
      next_assignee := nullif(p_changes ->> 'assignedUserId', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Invalid sourcing assignee'
          using errcode = '22023';
    end;
  else
    next_assignee := request_record.assigned_user_id;
  end if;

  if next_assignee is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = next_assignee
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Sourcing assignee does not belong to this dealership'
      using errcode = '23514';
  end if;

  if p_changes ? 'sourcingFee' then
    begin
      next_sourcing_fee := (p_changes ->> 'sourcingFee')::numeric;
    exception
      when invalid_text_representation then
        raise exception 'Invalid sourcing fee'
          using errcode = '22023';
    end;
    if next_sourcing_fee < 0 then
      raise exception 'Sourcing fee cannot be negative'
        using errcode = '22023';
    end if;
  else
    next_sourcing_fee := request_record.sourcing_fee;
  end if;

  if p_changes ? 'expectedMargin' then
    begin
      next_expected_margin := (p_changes ->> 'expectedMargin')::numeric;
    exception
      when invalid_text_representation then
        raise exception 'Invalid expected margin'
          using errcode = '22023';
    end;
    if next_expected_margin < -1000000 or next_expected_margin > 1000000 then
      raise exception 'Expected margin is outside the permitted range'
        using errcode = '22023';
    end if;
  else
    next_expected_margin := request_record.expected_margin;
  end if;

  update public.sourcing_requests
  set
    status = next_status,
    assigned_user_id = next_assignee,
    priority = next_priority,
    sourcing_fee = next_sourcing_fee,
    expected_margin = next_expected_margin,
    closed_at = case
      when next_status in ('completed', 'lost') then coalesce(closed_at, now())
      when next_status not in ('completed', 'lost') then null
      else closed_at
    end
  where id = request_record.id
  returning * into updated_record;

  if nullif(trim(coalesce(p_note, '')), '') is not null then
    activity_type_value := 'note';
    activity_body := trim(p_note);
  elsif p_changes ? 'status' then
    activity_type_value := 'status_change';
    activity_body := 'Status changed to ' || replace(next_status, '_', ' ') || '.';
  elsif p_changes ? 'assignedUserId' then
    activity_type_value := 'assignment';
    activity_body := case
      when next_assignee is null then 'Sourcing request unassigned.'
      else 'Sourcing request assigned.'
    end;
  else
    activity_body := 'Sourcing request details updated.';
  end if;

  insert into public.sourcing_activities (
    organisation_id,
    sourcing_request_id,
    activity_type,
    body,
    metadata,
    created_by
  )
  values (
    p_organisation_id,
    p_sourcing_request_id,
    activity_type_value,
    activity_body,
    coalesce(p_changes, '{}'::jsonb),
    p_actor_user_id
  );

  return jsonb_build_object(
    'id', updated_record.id,
    'status', updated_record.status,
    'assigned_user_id', updated_record.assigned_user_id,
    'priority', updated_record.priority,
    'sourcing_fee', updated_record.sourcing_fee,
    'expected_margin', updated_record.expected_margin
  );
end;
$$;

create table public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bucket_id, object_path)
);

create trigger storage_cleanup_jobs_touch_updated_at
before update on public.storage_cleanup_jobs
for each row execute function public.touch_updated_at();

alter table public.storage_cleanup_jobs enable row level security;

create policy storage_cleanup_jobs_owner_read
on public.storage_cleanup_jobs for select
to authenticated
using (public.has_org_role(organisation_id, array['owner']));

revoke all on public.storage_cleanup_jobs from anon, authenticated;
grant select on public.storage_cleanup_jobs to authenticated;
grant all on public.storage_cleanup_jobs to service_role;

create or replace function public.attach_vehicle_image(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size bigint,
  p_alt_text text,
  p_caption text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_sort_order integer;
  image_id uuid;
  cover_value boolean;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Vehicle image upload is not permitted'
      using errcode = '42501';
  end if;

  perform v.id
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;
  if not found then
    raise exception 'Vehicle was not found'
      using errcode = 'P0002';
  end if;

  select coalesce(max(vi.sort_order), -1) + 1
  into next_sort_order
  from public.vehicle_images vi
  where vi.organisation_id = p_organisation_id
    and vi.vehicle_id = p_vehicle_id
    and vi.deleted_at is null;

  cover_value := not exists (
    select 1
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = p_vehicle_id
      and vi.deleted_at is null
      and vi.is_cover = true
  );

  insert into public.vehicle_images (
    organisation_id,
    vehicle_id,
    storage_bucket,
    storage_path,
    mime_type,
    byte_size,
    sort_order,
    is_cover,
    alt_text,
    caption,
    created_by
  )
  values (
    p_organisation_id,
    p_vehicle_id,
    p_storage_bucket,
    p_storage_path,
    p_mime_type,
    p_byte_size,
    next_sort_order,
    cover_value,
    nullif(trim(p_alt_text), ''),
    nullif(trim(p_caption), ''),
    p_actor_user_id
  )
  returning id into image_id;

  return jsonb_build_object(
    'id', image_id,
    'storage_path', p_storage_path,
    'sort_order', next_sort_order,
    'is_cover', cover_value,
    'alt_text', nullif(trim(p_alt_text), ''),
    'caption', nullif(trim(p_caption), '')
  );
end;
$$;

create or replace function public.soft_delete_vehicle_image(
  p_organisation_id uuid,
  p_image_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  image_record public.vehicle_images%rowtype;
  next_cover_id uuid;
begin
  if not exists (
    select 1
    from public.organisation_members om
    join public.roles r on r.id = om.role_id
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and r.code in ('owner', 'manager', 'salesperson', 'website_editor')
  ) then
    raise exception 'Vehicle image deletion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.deleted_at is null
  for update;

  perform v.id
  from public.vehicles v
  where v.id = image_record.vehicle_id
    and v.organisation_id = p_organisation_id
  for update;

  update public.vehicle_images
  set
    deleted_at = now(),
    is_cover = false
  where id = image_record.id;

  if image_record.is_cover then
    select vi.id
    into next_cover_id
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = image_record.vehicle_id
      and vi.deleted_at is null
    order by vi.sort_order
    limit 1
    for update;

    if next_cover_id is not null then
      update public.vehicle_images
      set is_cover = true
      where id = next_cover_id;
    end if;
  end if;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicle_images',
    image_record.id,
    'vehicle_image.deleted',
    'vehicle',
    image_record.vehicle_id,
    jsonb_build_object(
      'storage_bucket', image_record.storage_bucket,
      'storage_path', image_record.storage_path,
      'is_cover', image_record.is_cover
    ),
    jsonb_build_object('next_cover_id', next_cover_id),
    'application'
  );

  return jsonb_build_object(
    'image_id', image_record.id,
    'vehicle_id', image_record.vehicle_id,
    'storage_bucket', image_record.storage_bucket,
    'storage_path', image_record.storage_path,
    'next_cover_id', next_cover_id
  );
end;
$$;

-- An Auto Trader advertiser and stock record must resolve to one tenant and
-- one vehicle. These constraints make webhook routing deterministic even if
-- integration configuration is edited outside DealerOS.
create unique index if not exists integration_settings_autotrader_advertiser_id_unique
  on public.integration_settings (
    (btrim(public_configuration ->> 'advertiser_id'))
  )
  where provider = 'autotrader'
    and nullif(btrim(public_configuration ->> 'advertiser_id'), '') is not null;

create unique index if not exists vehicles_org_autotrader_stock_id_unique
  on public.vehicles (organisation_id, autotrader_stock_id)
  where autotrader_stock_id is not null
    and deleted_at is null;

-- Keep the array stored on the public-safe vehicle as a resilient source of
-- presentation features when no normalised vehicle_features rows exist.
create or replace view public.public_vehicle_inventory
with (security_barrier = true)
as
select
  safe_vehicle.*,
  vehicle.features
from public.public_safe_vehicles safe_vehicle
join public.vehicles vehicle
  on vehicle.id = safe_vehicle.id
  and vehicle.organisation_id = safe_vehicle.organisation_id;

revoke all on public.public_vehicle_inventory from public;
grant select on public.public_vehicle_inventory to anon, authenticated;

revoke all on function public.merge_customers(uuid, uuid, uuid, uuid) from public;
revoke all on function public.accept_team_invitation(uuid) from public;
revoke all on function public.publish_homepage(uuid, uuid) from public;
revoke all on function public.update_sourcing_request(
  uuid,
  uuid,
  jsonb,
  text,
  uuid
) from public;
revoke all on function public.attach_vehicle_image(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) from public;
revoke all on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  from public;
revoke all on function public.record_vehicle_sale(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  date,
  date,
  text,
  text[],
  jsonb,
  uuid
) from public;
revoke all on function public.reorder_vehicle_images(
  uuid,
  uuid,
  uuid[],
  uuid,
  uuid
) from public;
revoke all on function public.replace_availability_rules(
  uuid,
  uuid,
  jsonb,
  uuid
) from public;

grant execute on function public.merge_customers(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.accept_team_invitation(uuid)
  to service_role;
grant execute on function public.publish_homepage(uuid, uuid)
  to service_role;
grant execute on function public.update_sourcing_request(
  uuid,
  uuid,
  jsonb,
  text,
  uuid
) to service_role;
grant execute on function public.attach_vehicle_image(
  uuid,
  uuid,
  text,
  text,
  text,
  bigint,
  text,
  text,
  uuid
) to service_role;
grant execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  to service_role;
grant execute on function public.record_vehicle_sale(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text,
  text,
  date,
  date,
  text,
  text[],
  jsonb,
  uuid
) to service_role;
grant execute on function public.reorder_vehicle_images(
  uuid,
  uuid,
  uuid[],
  uuid,
  uuid
) to service_role;
grant execute on function public.replace_availability_rules(
  uuid,
  uuid,
  jsonb,
  uuid
) to service_role;

commit;
