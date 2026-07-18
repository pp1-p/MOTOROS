begin;

create or replace function public.can_access_customer(
  target_organisation_id uuid,
  target_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers target
    where target.id = target_customer_id
      and target.organisation_id = target_organisation_id
      and target.deleted_at is null
  )
  and exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = target_organisation_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'
      and om.deleted_at is null
      and (
        om.role in ('owner', 'manager', 'service_advisor')
        or (
          om.role = 'salesperson'
          and (
            exists (
              select 1
              from public.customers c
              where c.id = target_customer_id
                and c.organisation_id = target_organisation_id
                and c.created_by = (select auth.uid())
                and c.deleted_at is null
            )
            or exists (
              select 1
              from public.leads l
              where l.customer_id = target_customer_id
                and l.organisation_id = target_organisation_id
                and l.assigned_user_id = (select auth.uid())
                and l.deleted_at is null
            )
            or exists (
              select 1
              from public.sourcing_requests sr
              where sr.customer_id = target_customer_id
                and sr.organisation_id = target_organisation_id
                and sr.assigned_user_id = (select auth.uid())
                and sr.deleted_at is null
            )
            or exists (
              select 1
              from public.appointments a
              where a.customer_id = target_customer_id
                and a.organisation_id = target_organisation_id
                and a.assigned_user_id = (select auth.uid())
                and a.deleted_at is null
            )
            or exists (
              select 1
              from public.sales s
              where s.customer_id = target_customer_id
                and s.organisation_id = target_organisation_id
                and s.salesperson_id = (select auth.uid())
                and s.deleted_at is null
            )
          )
        )
      )
  );
$$;

revoke all on function public.can_access_customer(uuid, uuid) from public;
grant execute on function public.can_access_customer(uuid, uuid)
  to authenticated, service_role;

drop policy if exists customers_read_operational on public.customers;
drop policy if exists customers_write_operational on public.customers;
drop policy if exists customers_update_operational on public.customers;
drop policy if exists customer_vehicles_read_operational
  on public.customer_vehicles;
drop policy if exists customer_vehicles_write_operational
  on public.customer_vehicles;

create policy customers_read_scoped
on public.customers for select
to authenticated
using (public.can_access_customer(organisation_id, id));

create policy customers_insert_scoped
on public.customers for insert
to authenticated
with check (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson', 'service_advisor']
  )
  and (
    public.has_org_role(
      organisation_id,
      array['owner', 'manager', 'service_advisor']
    )
    or created_by = (select auth.uid())
  )
);

create policy customers_update_scoped
on public.customers for update
to authenticated
using (public.can_access_customer(organisation_id, id))
with check (public.can_access_customer(organisation_id, id));

create policy customer_vehicles_read_scoped
on public.customer_vehicles for select
to authenticated
using (public.can_access_customer(organisation_id, customer_id));

create policy customer_vehicles_write_scoped
on public.customer_vehicles for all
to authenticated
using (public.can_access_customer(organisation_id, customer_id))
with check (public.can_access_customer(organisation_id, customer_id));

create view public.staff_vehicle_records
with (security_barrier = true)
as
select
  v.id,
  v.organisation_id,
  v.registration,
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
  v.retail_price,
  v.status,
  v.public_title,
  v.is_public,
  v.slug,
  v.sold_at,
  v.acquired_at,
  v.created_at,
  v.updated_at,
  v.deleted_at
from public.vehicles v
where v.deleted_at is null
  and public.has_org_role(
    v.organisation_id,
    array[
      'owner',
      'manager',
      'salesperson',
      'service_advisor',
      'website_editor'
    ]
  );

create view public.staff_sales_records
with (security_barrier = true)
as
select
  s.id,
  s.organisation_id,
  s.reference,
  s.vehicle_id,
  s.customer_id,
  s.lead_id,
  s.salesperson_id,
  s.status,
  s.sale_price,
  s.deposit,
  s.part_exchange_allowance,
  s.discount,
  s.warranty,
  s.additional_products,
  s.payment_method,
  s.sale_date,
  s.handover_date,
  s.completed_at,
  s.created_at,
  s.updated_at,
  s.deleted_at
from public.sales s
where s.deleted_at is null
  and (
    public.has_org_role(s.organisation_id, array['owner', 'manager'])
    or (
      public.has_org_role(s.organisation_id, array['salesperson'])
      and s.salesperson_id = (select auth.uid())
    )
  );

revoke all on public.staff_vehicle_records from public;
revoke all on public.staff_sales_records from public;
grant select on public.staff_vehicle_records to authenticated;
grant select on public.staff_sales_records to authenticated;

revoke select on public.vehicles from authenticated;
revoke select on public.vehicle_costs from authenticated;
revoke select on public.sales from authenticated;

revoke insert, update, delete on
  public.organisation_members,
  public.dealership_settings,
  public.customers,
  public.customer_vehicles,
  public.vehicles,
  public.vehicle_images,
  public.vehicle_features,
  public.vehicle_costs,
  public.vehicle_status_history,
  public.vehicle_lookup_logs,
  public.vehicle_sync_records,
  public.leads,
  public.sourcing_requests,
  public.sourcing_candidates,
  public.appointment_types,
  public.availability_rules,
  public.availability_exceptions,
  public.appointments,
  public.repair_services,
  public.repair_jobs,
  public.repair_job_items,
  public.sales,
  public.tasks,
  public.task_comments,
  public.documents,
  public.notifications,
  public.website_pages,
  public.integration_settings,
  public.webhook_events,
  public.audit_logs,
  public.team_invitations,
  public.sourcing_activities,
  public.storage_cleanup_jobs
from authenticated;

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
) from authenticated;
revoke all on function public.update_assigned_repair_job(
  uuid,
  text,
  text,
  text,
  text
) from authenticated;

create unique index if not exists notifications_id_organisation_unique
  on public.notifications (id, organisation_id);

create table public.notification_receipts (
  organisation_id uuid not null
    references public.organisations(id) on delete cascade,
  notification_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (notification_id, user_id),
  foreign key (notification_id, organisation_id)
    references public.notifications(id, organisation_id) on delete cascade
);

create index notification_receipts_user_idx
  on public.notification_receipts (
    organisation_id,
    user_id,
    read_at desc
  );

alter table public.notification_receipts enable row level security;

create policy notification_receipts_read_own
on public.notification_receipts for select
to authenticated
using (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

create policy notification_receipts_write_own
on public.notification_receipts for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

create policy notification_receipts_update_own
on public.notification_receipts for update
to authenticated
using (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
)
with check (
  user_id = (select auth.uid())
  and public.is_org_member(organisation_id)
  and exists (
    select 1
    from public.notifications n
    where n.id = notification_receipts.notification_id
      and n.organisation_id = notification_receipts.organisation_id
      and (
        n.recipient_user_id = (select auth.uid())
        or (
          n.recipient_user_id is null
          and public.has_org_role(
            n.organisation_id,
            array['owner', 'manager', 'service_advisor']
          )
        )
      )
      and (n.expires_at is null or n.expires_at > now())
  )
);

revoke all on public.notification_receipts from anon;
grant select, insert, update on public.notification_receipts to authenticated;
grant all on public.notification_receipts to service_role;

create or replace function public.create_vehicle_with_costs(
  p_organisation_id uuid,
  p_actor_user_id uuid,
  p_vehicle jsonb,
  p_costs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle_id uuid;
  gross_profit numeric(12,2);
begin
  if jsonb_typeof(p_vehicle) <> 'object'
    or jsonb_typeof(p_costs) <> 'object' then
    raise exception 'Vehicle and cost details must be JSON objects'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager')
  ) then
    raise exception 'Creating stock is not permitted'
      using errcode = '42501';
  end if;

  gross_profit :=
    coalesce((p_vehicle ->> 'retail_price')::numeric, 0)
    - coalesce((p_costs ->> 'purchase_price')::numeric, 0)
    - coalesce((p_costs ->> 'preparation_costs')::numeric, 0)
    - coalesce((p_costs ->> 'repair_costs')::numeric, 0)
    - coalesce((p_costs ->> 'other_costs')::numeric, 0);

  insert into public.vehicles (
    organisation_id,
    created_by,
    updated_by,
    registration,
    registration_normalised,
    vin,
    stock_number,
    make,
    model,
    derivative,
    trim,
    body_type,
    fuel_type,
    transmission,
    colour,
    doors,
    seats,
    engine_size_cc,
    power_bhp,
    co2_emissions_g_km,
    euro_status,
    year,
    first_registration_date,
    mot_expiry,
    tax_status,
    previous_owners,
    mileage,
    service_history,
    number_of_keys,
    warranty,
    inspection_notes,
    known_faults,
    purchase_price,
    preparation_costs,
    repair_costs,
    other_costs,
    retail_price,
    minimum_acceptable_price,
    deposit_amount,
    estimated_gross_profit,
    public_title,
    attention_grabber,
    description,
    features,
    standard_equipment,
    optional_equipment,
    finance_example_text,
    warranty_wording,
    video_url,
    featured,
    is_featured,
    is_public,
    status,
    slug,
    lookup_provider,
    lookup_retrieved_at,
    data_reviewed_by,
    data_reviewed_at
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    p_actor_user_id,
    nullif(p_vehicle ->> 'registration', ''),
    nullif(p_vehicle ->> 'registration_normalised', ''),
    nullif(p_vehicle ->> 'vin', ''),
    p_vehicle ->> 'stock_number',
    p_vehicle ->> 'make',
    p_vehicle ->> 'model',
    nullif(p_vehicle ->> 'derivative', ''),
    nullif(p_vehicle ->> 'trim', ''),
    nullif(p_vehicle ->> 'body_type', ''),
    p_vehicle ->> 'fuel_type',
    p_vehicle ->> 'transmission',
    nullif(p_vehicle ->> 'colour', ''),
    nullif(p_vehicle ->> 'doors', '')::smallint,
    nullif(p_vehicle ->> 'seats', '')::smallint,
    nullif(p_vehicle ->> 'engine_size_cc', '')::integer,
    nullif(p_vehicle ->> 'power_bhp', '')::integer,
    nullif(p_vehicle ->> 'co2_emissions_g_km', '')::integer,
    nullif(p_vehicle ->> 'euro_status', ''),
    (p_vehicle ->> 'year')::integer,
    nullif(p_vehicle ->> 'first_registration_date', '')::date,
    nullif(p_vehicle ->> 'mot_expiry', '')::date,
    nullif(p_vehicle ->> 'tax_status', ''),
    nullif(p_vehicle ->> 'previous_owners', '')::smallint,
    (p_vehicle ->> 'mileage')::integer,
    nullif(p_vehicle ->> 'service_history', ''),
    nullif(p_vehicle ->> 'number_of_keys', '')::smallint,
    nullif(p_vehicle ->> 'warranty', ''),
    nullif(p_vehicle ->> 'inspection_notes', ''),
    nullif(p_vehicle ->> 'known_faults', ''),
    coalesce((p_costs ->> 'purchase_price')::numeric, 0),
    coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
    coalesce((p_costs ->> 'repair_costs')::numeric, 0),
    coalesce((p_costs ->> 'other_costs')::numeric, 0),
    (p_vehicle ->> 'retail_price')::numeric,
    nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
    coalesce((p_vehicle ->> 'deposit_amount')::numeric, 0),
    gross_profit,
    p_vehicle ->> 'public_title',
    nullif(p_vehicle ->> 'attention_grabber', ''),
    p_vehicle ->> 'description',
    coalesce(
      array(select jsonb_array_elements_text(p_vehicle -> 'features')),
      array[]::text[]
    ),
    nullif(p_vehicle ->> 'standard_equipment', ''),
    nullif(p_vehicle ->> 'optional_equipment', ''),
    nullif(p_vehicle ->> 'finance_example_text', ''),
    nullif(p_vehicle ->> 'warranty_wording', ''),
    nullif(p_vehicle ->> 'video_url', ''),
    coalesce((p_vehicle ->> 'featured')::boolean, false),
    coalesce((p_vehicle ->> 'is_featured')::boolean, false),
    false,
    coalesce(nullif(p_vehicle ->> 'status', ''), 'appraisal'),
    nullif(p_vehicle ->> 'slug', ''),
    nullif(p_vehicle ->> 'lookup_provider', ''),
    nullif(p_vehicle ->> 'lookup_retrieved_at', '')::timestamptz,
    p_actor_user_id,
    now()
  )
  returning id into vehicle_id;

  insert into public.vehicle_costs (
    organisation_id,
    vehicle_id,
    purchase_price,
    preparation_costs,
    repair_costs,
    other_costs,
    minimum_acceptable_price,
    created_by
  )
  values (
    p_organisation_id,
    vehicle_id,
    coalesce((p_costs ->> 'purchase_price')::numeric, 0),
    coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
    coalesce((p_costs ->> 'repair_costs')::numeric, 0),
    coalesce((p_costs ->> 'other_costs')::numeric, 0),
    nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
    p_actor_user_id
  );

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
    'vehicles',
    vehicle_id,
    'vehicle.created',
    'vehicle',
    vehicle_id,
    jsonb_build_object(
      'vehicle', p_vehicle,
      'costs_recorded', true
    ),
    'application'
  );

  return jsonb_build_object(
    'id', vehicle_id,
    'slug', p_vehicle ->> 'slug',
    'stock_number', p_vehicle ->> 'stock_number',
    'status', p_vehicle ->> 'status',
    'is_public', false
  );
end;
$$;

create or replace function public.update_vehicle_with_costs(
  p_organisation_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid,
  p_vehicle_changes jsonb,
  p_costs jsonb,
  p_change_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_vehicle public.vehicles%rowtype;
  next_vehicle public.vehicles%rowtype;
  existing_costs public.vehicle_costs%rowtype;
  old_costs public.vehicle_costs%rowtype;
  result_vehicle public.vehicles%rowtype;
  actor_role text;
  costs_found boolean;
begin
  if jsonb_typeof(coalesce(p_vehicle_changes, '{}'::jsonb)) <> 'object'
    or (p_costs is not null and jsonb_typeof(p_costs) <> 'object') then
    raise exception 'Vehicle changes must be JSON objects'
      using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_change_reason, '')), '') is null then
    raise exception 'A change reason is required'
      using errcode = '22023';
  end if;

  select om.role
  into actor_role
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.user_id = p_actor_user_id
    and om.status = 'active'
    and om.deleted_at is null
    and om.role in ('owner', 'manager', 'website_editor')
  limit 1;
  if actor_role is null then
    raise exception 'Updating this vehicle is not permitted'
      using errcode = '42501';
  end if;

  if actor_role = 'website_editor' and exists (
    select 1
    from jsonb_object_keys(
      coalesce(p_vehicle_changes, '{}'::jsonb)
    ) as keys(key_name)
    where key_name not in (
      'public_title',
      'attention_grabber',
      'description',
      'features',
      'standard_equipment',
      'optional_equipment',
      'finance_example_text',
      'warranty_wording',
      'video_url',
      'featured',
      'is_featured',
      'is_public'
    )
  ) then
    raise exception 'Website editors may change presentation fields only'
      using errcode = '42501';
  end if;

  select *
  into strict existing_vehicle
  from public.vehicles v
  where v.id = p_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;

  next_vehicle := jsonb_populate_record(
    existing_vehicle,
    coalesce(p_vehicle_changes, '{}'::jsonb)
  );
  next_vehicle.id := existing_vehicle.id;
  next_vehicle.organisation_id := existing_vehicle.organisation_id;
  next_vehicle.created_by := existing_vehicle.created_by;
  next_vehicle.created_at := existing_vehicle.created_at;
  next_vehicle.deleted_at := existing_vehicle.deleted_at;
  next_vehicle.updated_by := p_actor_user_id;

  if p_costs is not null then
    if not exists (
      select 1
      from public.organisation_members om
      where om.organisation_id = p_organisation_id
        and om.user_id = p_actor_user_id
        and om.status = 'active'
        and om.deleted_at is null
        and om.role in ('owner', 'manager')
    ) then
      raise exception 'Commercial changes are not permitted'
        using errcode = '42501';
    end if;

    select *
    into existing_costs
    from public.vehicle_costs vc
    where vc.vehicle_id = p_vehicle_id
      and vc.organisation_id = p_organisation_id
      and vc.cost_type is null
      and vc.deleted_at is null
    limit 1
    for update;
    costs_found := found;
    old_costs := existing_costs;

    if costs_found then
      update public.vehicle_costs
      set
        purchase_price = coalesce(
          nullif(p_costs ->> 'purchase_price', '')::numeric,
          purchase_price
        ),
        preparation_costs = coalesce(
          nullif(p_costs ->> 'preparation_costs', '')::numeric,
          preparation_costs
        ),
        repair_costs = coalesce(
          nullif(p_costs ->> 'repair_costs', '')::numeric,
          repair_costs
        ),
        other_costs = coalesce(
          nullif(p_costs ->> 'other_costs', '')::numeric,
          other_costs
        ),
        minimum_acceptable_price = case
          when p_costs ? 'minimum_acceptable_price'
            then nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric
          else minimum_acceptable_price
        end
      where id = existing_costs.id
      returning * into existing_costs;
    else
      insert into public.vehicle_costs (
        organisation_id,
        vehicle_id,
        purchase_price,
        preparation_costs,
        repair_costs,
        other_costs,
        minimum_acceptable_price,
        created_by
      )
      values (
        p_organisation_id,
        p_vehicle_id,
        coalesce((p_costs ->> 'purchase_price')::numeric, 0),
        coalesce((p_costs ->> 'preparation_costs')::numeric, 0),
        coalesce((p_costs ->> 'repair_costs')::numeric, 0),
        coalesce((p_costs ->> 'other_costs')::numeric, 0),
        nullif(p_costs ->> 'minimum_acceptable_price', '')::numeric,
        p_actor_user_id
      )
      returning * into existing_costs;
    end if;

    next_vehicle.purchase_price := existing_costs.purchase_price;
    next_vehicle.preparation_costs := existing_costs.preparation_costs;
    next_vehicle.repair_costs := existing_costs.repair_costs;
    next_vehicle.other_costs := existing_costs.other_costs;
    next_vehicle.minimum_acceptable_price :=
      existing_costs.minimum_acceptable_price;
    next_vehicle.estimated_gross_profit :=
      coalesce(next_vehicle.retail_price, 0)
      - coalesce(existing_costs.purchase_price, 0)
      - coalesce(existing_costs.preparation_costs, 0)
      - coalesce(existing_costs.repair_costs, 0)
      - coalesce(existing_costs.other_costs, 0);
  end if;

  next_vehicle.estimated_gross_profit :=
    coalesce(next_vehicle.retail_price, 0)
    - coalesce(next_vehicle.purchase_price, 0)
    - coalesce(next_vehicle.preparation_costs, 0)
    - coalesce(next_vehicle.repair_costs, 0)
    - coalesce(next_vehicle.other_costs, 0);

  if next_vehicle.is_public then
    if next_vehicle.status not in (
      'ready_for_sale',
      'on_forecourt',
      'reserved',
      'sold'
    )
      or nullif(trim(coalesce(next_vehicle.slug, '')), '') is null
      or nullif(trim(coalesce(next_vehicle.public_title, '')), '') is null
      or nullif(trim(coalesce(next_vehicle.description, '')), '') is null
      or coalesce(next_vehicle.retail_price, 0) <= 0 then
      raise exception 'The vehicle is not eligible for public listing'
        using errcode = '23514';
    end if;

    perform vi.id
    from public.vehicle_images vi
    where vi.organisation_id = p_organisation_id
      and vi.vehicle_id = p_vehicle_id
      and vi.is_cover = true
      and vi.deleted_at is null
    limit 1
    for share;
    if not found then
      raise exception 'A live cover image is required before publishing'
        using errcode = '23514';
    end if;
  end if;

  update public.vehicles
  set
    registration = next_vehicle.registration,
    registration_normalised = next_vehicle.registration_normalised,
    stock_number = next_vehicle.stock_number,
    make = next_vehicle.make,
    model = next_vehicle.model,
    derivative = next_vehicle.derivative,
    trim = next_vehicle.trim,
    body_type = next_vehicle.body_type,
    fuel_type = next_vehicle.fuel_type,
    transmission = next_vehicle.transmission,
    colour = next_vehicle.colour,
    doors = next_vehicle.doors,
    seats = next_vehicle.seats,
    engine_size_cc = next_vehicle.engine_size_cc,
    power_bhp = next_vehicle.power_bhp,
    co2_emissions_g_km = next_vehicle.co2_emissions_g_km,
    euro_status = next_vehicle.euro_status,
    year = next_vehicle.year,
    first_registration_date = next_vehicle.first_registration_date,
    mot_expiry = next_vehicle.mot_expiry,
    tax_status = next_vehicle.tax_status,
    previous_owners = next_vehicle.previous_owners,
    mileage = next_vehicle.mileage,
    service_history = next_vehicle.service_history,
    number_of_keys = next_vehicle.number_of_keys,
    warranty = next_vehicle.warranty,
    inspection_notes = next_vehicle.inspection_notes,
    known_faults = next_vehicle.known_faults,
    provenance_status = next_vehicle.provenance_status,
    purchase_price = next_vehicle.purchase_price,
    preparation_costs = next_vehicle.preparation_costs,
    repair_costs = next_vehicle.repair_costs,
    other_costs = next_vehicle.other_costs,
    retail_price = next_vehicle.retail_price,
    minimum_acceptable_price = next_vehicle.minimum_acceptable_price,
    deposit_amount = next_vehicle.deposit_amount,
    estimated_gross_profit = next_vehicle.estimated_gross_profit,
    actual_sale_price = next_vehicle.actual_sale_price,
    public_title = next_vehicle.public_title,
    attention_grabber = next_vehicle.attention_grabber,
    description = next_vehicle.description,
    features = next_vehicle.features,
    standard_equipment = next_vehicle.standard_equipment,
    optional_equipment = next_vehicle.optional_equipment,
    finance_example_text = next_vehicle.finance_example_text,
    warranty_wording = next_vehicle.warranty_wording,
    video_url = next_vehicle.video_url,
    featured = next_vehicle.featured,
    is_featured = next_vehicle.is_featured,
    is_public = next_vehicle.is_public,
    status = next_vehicle.status,
    slug = next_vehicle.slug,
    updated_by = p_actor_user_id
  where id = p_vehicle_id
  returning * into result_vehicle;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    change_reason,
    old_values,
    new_values,
    source
  )
  values (
    p_organisation_id,
    p_actor_user_id,
    'vehicles',
    p_vehicle_id,
    'vehicle.updated',
    'vehicle',
    p_vehicle_id,
    trim(p_change_reason),
    jsonb_build_object(
      'vehicle', to_jsonb(existing_vehicle),
      'costs', case when p_costs is null then null else to_jsonb(old_costs) end
    ),
    jsonb_build_object(
      'vehicle_changes', p_vehicle_changes,
      'costs', p_costs
    ),
    'application'
  );

  return jsonb_build_object(
    'id', result_vehicle.id,
    'slug', result_vehicle.slug,
    'status', result_vehicle.status,
    'is_public', result_vehicle.is_public
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
  locked_vehicle_id uuid;
  next_cover_id uuid;
  vehicle_unpublished boolean := false;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager', 'website_editor')
  ) then
    raise exception 'Vehicle image deletion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.deleted_at is null;
  locked_vehicle_id := image_record.vehicle_id;

  perform v.id
  from public.vehicles v
  where v.id = locked_vehicle_id
    and v.organisation_id = p_organisation_id
    and v.deleted_at is null
  for update;
  if not found then
    raise exception 'Vehicle was not found'
      using errcode = 'P0002';
  end if;

  select *
  into strict image_record
  from public.vehicle_images vi
  where vi.id = p_image_id
    and vi.organisation_id = p_organisation_id
    and vi.vehicle_id = locked_vehicle_id
    and vi.deleted_at is null
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
    order by vi.sort_order, vi.id
    limit 1
    for update;

    if next_cover_id is not null then
      update public.vehicle_images
      set is_cover = true
      where id = next_cover_id;
    else
      update public.vehicles
      set
        is_public = false,
        updated_by = p_actor_user_id
      where id = image_record.vehicle_id
        and is_public = true;
      vehicle_unpublished := found;
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
    jsonb_build_object(
      'next_cover_id', next_cover_id,
      'vehicle_unpublished', vehicle_unpublished
    ),
    'application'
  );

  return jsonb_build_object(
    'image_id', image_record.id,
    'vehicle_id', image_record.vehicle_id,
    'storage_bucket', image_record.storage_bucket,
    'storage_path', image_record.storage_path,
    'next_cover_id', next_cover_id,
    'vehicle_unpublished', vehicle_unpublished
  );
end;
$$;

create unique index if not exists repair_jobs_appointment_unique
  on public.repair_jobs (appointment_id)
  where appointment_id is not null and deleted_at is null;

create or replace function public.convert_appointment_to_repair(
  p_organisation_id uuid,
  p_appointment_id uuid,
  p_actor_user_id uuid,
  p_mileage integer,
  p_assigned_technician_id uuid,
  p_due_date date,
  p_internal_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_record public.appointments%rowtype;
  repair_record public.repair_jobs%rowtype;
  next_technician_id uuid;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('owner', 'manager', 'service_advisor')
  ) then
    raise exception 'Repair conversion is not permitted'
      using errcode = '42501';
  end if;

  select *
  into strict appointment_record
  from public.appointments a
  where a.id = p_appointment_id
    and a.organisation_id = p_organisation_id
    and a.deleted_at is null
  for update;

  if appointment_record.customer_id is null then
    raise exception 'The appointment must be linked to a customer'
      using errcode = '23514';
  end if;

  select *
  into repair_record
  from public.repair_jobs rj
  where rj.appointment_id = p_appointment_id
    and rj.organisation_id = p_organisation_id
    and rj.deleted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'id', repair_record.id,
      'reference', repair_record.reference,
      'status', repair_record.status,
      'already_exists', true
    );
  end if;

  if not exists (
    select 1
    from public.appointment_types at
    where at.id = appointment_record.appointment_type_id
      and at.organisation_id = p_organisation_id
      and at.category = 'repair_call'
  ) then
    raise exception 'Only a repair-call appointment can become a repair job'
      using errcode = '23514';
  end if;

  next_technician_id := p_assigned_technician_id;
  if next_technician_id is null and exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = appointment_record.assigned_user_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('technician', 'service_advisor', 'manager', 'owner')
  ) then
    next_technician_id := appointment_record.assigned_user_id;
  end if;

  if next_technician_id is not null and not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = next_technician_id
      and om.status = 'active'
      and om.deleted_at is null
      and om.role in ('technician', 'service_advisor', 'manager', 'owner')
  ) then
    raise exception 'The selected technician is not an active team member'
      using errcode = '23514';
  end if;

  insert into public.repair_jobs (
    organisation_id,
    appointment_id,
    customer_id,
    customer_vehicle_id,
    assigned_technician_id,
    status,
    registration,
    vehicle_make_model,
    mileage,
    reported_fault,
    internal_notes,
    start_date,
    due_date,
    approval_status,
    payment_status,
    created_by
  )
  values (
    p_organisation_id,
    p_appointment_id,
    appointment_record.customer_id,
    appointment_record.customer_vehicle_id,
    next_technician_id,
    'awaiting_inspection',
    appointment_record.registration,
    appointment_record.vehicle_make_model,
    p_mileage,
    coalesce(
      appointment_record.fault_description,
      appointment_record.reason_for_call,
      'Fault details to be confirmed'
    ),
    nullif(trim(coalesce(p_internal_note, '')), ''),
    appointment_record.starts_at::date,
    p_due_date,
    'not_requested',
    'not_invoiced',
    p_actor_user_id
  )
  returning * into repair_record;

  update public.appointments
  set status = 'workshop_appointment_required'
  where id = p_appointment_id;

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
    'repair_jobs',
    repair_record.id,
    'appointment.converted_to_repair',
    'repair_job',
    repair_record.id,
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'repair_reference', repair_record.reference,
      'assigned_technician_id', repair_record.assigned_technician_id
    ),
    'application'
  );

  return jsonb_build_object(
    'id', repair_record.id,
    'reference', repair_record.reference,
    'status', repair_record.status,
    'already_exists', false
  );
end;
$$;

create or replace function public.update_team_member_access(
  p_organisation_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_status text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_member public.organisation_members%rowtype;
  role_id_value uuid;
  active_owner_count integer;
begin
  if p_role not in (
    'owner',
    'manager',
    'salesperson',
    'service_advisor',
    'technician',
    'website_editor'
  ) or p_status not in ('active', 'suspended') then
    raise exception 'Invalid team role or status'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Only an active owner can change team access'
      using errcode = '42501';
  end if;

  if p_target_user_id = p_actor_user_id and p_status <> 'active' then
    raise exception 'You cannot suspend your own owner account'
      using errcode = '23514';
  end if;

  perform om.id
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.role = 'owner'
    and om.status = 'active'
    and om.deleted_at is null
  order by om.id
  for update;

  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_actor_user_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null
  ) then
    raise exception 'Only an active owner can change team access'
      using errcode = '42501';
  end if;

  select *
  into strict target_member
  from public.organisation_members om
  where om.organisation_id = p_organisation_id
    and om.user_id = p_target_user_id
    and om.deleted_at is null
  for update;

  if target_member.role = 'owner'
    and target_member.status = 'active'
    and (p_role <> 'owner' or p_status <> 'active') then
    select count(*)::integer
    into active_owner_count
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.role = 'owner'
      and om.status = 'active'
      and om.deleted_at is null;
    if active_owner_count <= 1 then
      raise exception 'Add another active owner before changing the final owner account'
        using errcode = '23514';
    end if;
  end if;

  select r.id
  into strict role_id_value
  from public.roles r
  where r.code = p_role;

  update public.organisation_members
  set
    role_id = role_id_value,
    role = p_role,
    status = p_status
  where id = target_member.id;

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
    'organisation_members',
    target_member.id,
    'team.member_access_updated',
    'organisation_member',
    target_member.id,
    jsonb_build_object(
      'user_id', target_member.user_id,
      'role', target_member.role,
      'status', target_member.status
    ),
    jsonb_build_object(
      'user_id', p_target_user_id,
      'role', p_role,
      'status', p_status
    ),
    'application'
  );

  return jsonb_build_object(
    'user_id', p_target_user_id,
    'role', p_role,
    'status', p_status
  );
end;
$$;

create or replace function public.claim_storage_cleanup_jobs(
  p_limit integer default 25
)
returns setof public.storage_cleanup_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select scj.id
    from public.storage_cleanup_jobs scj
    where (
        scj.status in ('pending', 'failed')
        or (
          scj.status = 'processing'
          and scj.updated_at < now() - interval '15 minutes'
        )
    )
      and scj.attempt_count < 10
    order by scj.created_at, scj.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    for update skip locked
  )
  update public.storage_cleanup_jobs scj
  set status = 'processing'
  from candidates
  where scj.id = candidates.id
  returning scj.*;
end;
$$;

revoke all on function public.create_vehicle_with_costs(
  uuid,
  uuid,
  jsonb,
  jsonb
) from public;
revoke all on function public.update_vehicle_with_costs(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) from public;
revoke all on function public.convert_appointment_to_repair(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  date,
  text
) from public;
revoke all on function public.update_team_member_access(
  uuid,
  uuid,
  text,
  text,
  uuid
) from public;
revoke all on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  from public;
revoke all on function public.claim_storage_cleanup_jobs(integer)
  from public;

grant execute on function public.create_vehicle_with_costs(
  uuid,
  uuid,
  jsonb,
  jsonb
) to service_role;
grant execute on function public.update_vehicle_with_costs(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb,
  text
) to service_role;
grant execute on function public.convert_appointment_to_repair(
  uuid,
  uuid,
  uuid,
  integer,
  uuid,
  date,
  text
) to service_role;
grant execute on function public.update_team_member_access(
  uuid,
  uuid,
  text,
  text,
  uuid
) to service_role;
grant execute on function public.soft_delete_vehicle_image(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_storage_cleanup_jobs(integer)
  to service_role;

commit;
