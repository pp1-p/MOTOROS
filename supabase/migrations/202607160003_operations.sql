begin;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'LEAD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  lead_type text not null
    check (
      lead_type in (
        'vehicle_enquiry',
        'callback_request',
        'test_drive',
        'part_exchange',
        'car_sourcing',
        'repair_call',
        'general_enquiry'
      )
    ),
  status text not null default 'new'
    check (
      status in (
        'new',
        'assigned',
        'contact_attempted',
        'contacted',
        'appointment_booked',
        'qualified',
        'negotiation',
        'deposit_taken',
        'won',
        'lost',
        'spam'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  title text,
  subject text,
  message text,
  source text not null default 'website',
  source_detail text,
  preferred_contact_method text
    check (
      preferred_contact_method is null
      or preferred_contact_method in ('email', 'phone', 'sms', 'either')
    ),
  next_action text,
  due_at timestamptz,
  consent_status boolean not null default false,
  consent_scope text not null default 'not_recorded'
    check (
      consent_scope in (
        'not_recorded',
        'transactional_only',
        'marketing_granted',
        'marketing_withdrawn'
      )
    ),
  consent_recorded_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  lost_reason text,
  utm jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  last_activity_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create or replace function public.prepare_lead_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), nullif(trim(new.subject), ''));
  new.subject := coalesce(nullif(trim(new.subject), ''), nullif(trim(new.title), ''));
  if new.title is null then
    raise exception 'Lead title is required'
      using errcode = '23502';
  end if;
  new.utm := coalesce(new.utm, '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'source',
        new.utm_source,
        'medium',
        new.utm_medium,
        'campaign',
        new.utm_campaign
      )
    );
  if new.consent_scope = 'not_recorded' and new.consent_status then
    new.consent_scope := 'transactional_only';
  end if;
  return new;
end;
$$;

create trigger leads_prepare_compatibility
before insert or update on public.leads
for each row execute function public.prepare_lead_compatibility();

create unique index leads_org_reference_unique
  on public.leads (organisation_id, reference);
create index leads_org_status_idx
  on public.leads (organisation_id, status, created_at desc)
  where deleted_at is null;
create index leads_assigned_due_idx
  on public.leads (organisation_id, assigned_user_id, due_at)
  where deleted_at is null
    and status not in ('won', 'lost', 'spam');
create index leads_customer_idx
  on public.leads (organisation_id, customer_id, created_at desc)
  where deleted_at is null;
create index leads_vehicle_idx
  on public.leads (organisation_id, vehicle_id, created_at desc)
  where deleted_at is null;

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null
    check (
      activity_type in (
        'note',
        'email',
        'sms',
        'phone_call',
        'status_change',
        'assignment',
        'appointment',
        'task',
        'system'
      )
    ),
  direction text
    check (direction is null or direction in ('inbound', 'outbound', 'internal')),
  summary text not null,
  body text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index lead_activities_lead_idx
  on public.lead_activities (lead_id, occurred_at desc);
create index lead_activities_org_time_idx
  on public.lead_activities (organisation_id, occurred_at desc);

create table public.sourcing_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'SRC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'new'
    check (
      status in (
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
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  preferred_make text,
  preferred_model text,
  alternative_models text,
  alternative_vehicles text,
  minimum_year integer check (minimum_year between 1886 and 2200),
  maximum_mileage integer check (maximum_mileage >= 0),
  fuel_preference text,
  transmission_preference text,
  colour_preferences text,
  required_features text,
  budget numeric(12,2) not null check (budget > 0),
  deposit_available numeric(12,2) check (deposit_available >= 0),
  finance_required boolean not null default false,
  part_exchange boolean not null default false,
  desired_timescale text,
  requirements text,
  sourcing_fee numeric(12,2) check (sourcing_fee >= 0),
  next_action_at timestamptz,
  closed_at timestamptz,
  lost_reason text,
  converted_vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

alter table public.leads
  add column sourcing_request_id uuid
    references public.sourcing_requests(id) on delete set null;

create unique index sourcing_requests_org_reference_unique
  on public.sourcing_requests (organisation_id, reference);
create index sourcing_requests_status_idx
  on public.sourcing_requests (organisation_id, status, created_at desc)
  where deleted_at is null;
create index sourcing_requests_assigned_idx
  on public.sourcing_requests (organisation_id, assigned_user_id, next_action_at)
  where deleted_at is null
    and status not in ('completed', 'lost');
create index sourcing_requests_customer_idx
  on public.sourcing_requests (organisation_id, customer_id, created_at desc);

create table public.sourcing_candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  sourcing_request_id uuid not null
    references public.sourcing_requests(id) on delete cascade,
  stock_vehicle_id uuid references public.vehicles(id) on delete set null,
  supplier_name text,
  supplier_contact text,
  source_url text,
  registration text,
  make text not null,
  model text not null,
  derivative text,
  year integer check (year between 1886 and 2200),
  mileage integer check (mileage >= 0),
  colour text,
  expected_purchase_price numeric(12,2)
    check (expected_purchase_price >= 0),
  expected_preparation_cost numeric(12,2) not null default 0
    check (expected_preparation_cost >= 0),
  proposed_customer_price numeric(12,2)
    check (proposed_customer_price >= 0),
  expected_margin numeric(12,2) generated always as (
    case
      when proposed_customer_price is null or expected_purchase_price is null then null
      else proposed_customer_price
        - expected_purchase_price
        - expected_preparation_cost
    end
  ) stored,
  inspection_status text not null default 'not_requested'
    check (
      inspection_status in (
        'not_requested',
        'required',
        'booked',
        'passed',
        'failed'
      )
    ),
  customer_decision text not null default 'pending'
    check (
      customer_decision in (
        'pending',
        'interested',
        'declined',
        'approved',
        'unavailable'
      )
    ),
  notes text,
  sent_to_customer_at timestamptz,
  customer_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index sourcing_candidates_request_idx
  on public.sourcing_candidates (sourcing_request_id, created_at desc)
  where deleted_at is null;
create index sourcing_candidates_decision_idx
  on public.sourcing_candidates (
    organisation_id,
    customer_decision,
    inspection_status
  )
  where deleted_at is null;

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  category text not null default 'repair_call'
    check (
      category in (
        'repair_call',
        'viewing',
        'test_drive',
        'sales_call',
        'handover',
        'internal'
      )
    ),
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240),
  default_capacity integer not null default 1
    check (default_capacity between 1 and 20),
  colour text check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$'),
  is_public_bookable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, slug)
);

create index appointment_types_public_idx
  on public.appointment_types (organisation_id, category)
  where is_public_bookable = true and active = true;

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_type_id uuid not null
    references public.appointment_types(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time_local time not null,
  end_time_local time not null,
  slot_duration_minutes integer not null
    check (slot_duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 240),
  minimum_notice_minutes integer not null default 120
    check (minimum_notice_minutes between 0 and 10080),
  maximum_advance_days integer not null default 60
    check (maximum_advance_days between 1 and 365),
  maximum_simultaneous integer not null default 1
    check (maximum_simultaneous between 1 and 20),
  timezone text not null default 'Europe/London',
  valid_from date,
  valid_until date,
  active boolean not null default true,
  appointment_type text not null default 'repair_call',
  day_of_week smallint generated always as (weekday) stored,
  start_time time generated always as (start_time_local) stored,
  end_time time generated always as (end_time_local) stored,
  minimum_notice_hours numeric(8,2) generated always as (
    minimum_notice_minutes / 60.0
  ) stored,
  is_active boolean generated always as (active) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (end_time_local > start_time_local),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create index availability_rules_lookup_idx
  on public.availability_rules (
    organisation_id,
    appointment_type_id,
    weekday,
    active
  );
create index availability_rules_staff_idx
  on public.availability_rules (organisation_id, staff_user_id, weekday)
  where active = true;

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  appointment_type_id uuid references public.appointment_types(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete cascade,
  exception_date date not null,
  exception_type text not null
    check (exception_type in ('closed', 'open', 'capacity_override')),
  start_time_local time,
  end_time_local time,
  maximum_simultaneous integer
    check (maximum_simultaneous between 0 and 20),
  reason text,
  is_closed boolean generated always as (
    exception_type = 'closed'
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (
    (start_time_local is null and end_time_local is null)
    or (
      start_time_local is not null
      and end_time_local is not null
      and end_time_local > start_time_local
    )
  ),
  check (
    exception_type <> 'capacity_override'
    or maximum_simultaneous is not null
  )
);

create index availability_exceptions_lookup_idx
  on public.availability_exceptions (
    organisation_id,
    exception_date,
    appointment_type_id
  );

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'APT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  appointment_type_id uuid not null
    references public.appointment_types(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_vehicle_id uuid references public.customer_vehicles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_period tstzrange generated always as (
    tstzrange(starts_at, ends_at, '[)')
  ) stored,
  booking_resource smallint not null default 1
    check (booking_resource between 1 and 20),
  status text not null default 'requested'
    check (
      status in (
        'requested',
        'confirmed',
        'assigned',
        'call_completed',
        'repair_estimate_required',
        'workshop_appointment_required',
        'customer_unavailable',
        'cancelled',
        'no_show',
        'closed'
      )
    ),
  reason_for_call text,
  registration text,
  vehicle_make_model text,
  fault_description text,
  warning_lights text,
  is_driveable boolean,
  preferred_contact_method text
    check (
      preferred_contact_method is null
      or preferred_contact_method in ('email', 'phone', 'sms', 'either')
    ),
  customer_notes text,
  internal_notes text,
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (ends_at > starts_at),
  constraint appointments_no_resource_overlap
    exclude using gist (
      organisation_id with =,
      appointment_type_id with =,
      booking_resource with =,
      booking_period with &&
    )
    where (
      deleted_at is null
      and status in ('requested', 'confirmed', 'assigned')
    )
);

create unique index appointments_org_reference_unique
  on public.appointments (organisation_id, reference);
create index appointments_org_start_idx
  on public.appointments (organisation_id, starts_at, status)
  where deleted_at is null;
create index appointments_assigned_start_idx
  on public.appointments (organisation_id, assigned_user_id, starts_at)
  where deleted_at is null;
create index appointments_customer_idx
  on public.appointments (organisation_id, customer_id, starts_at desc)
  where deleted_at is null;

create table public.repair_services (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  slug text not null,
  short_description text,
  full_description text,
  icon_name text,
  display_order integer not null default 0,
  indicative_price_from numeric(12,2)
    check (indicative_price_from >= 0),
  is_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, slug)
);

create index repair_services_public_idx
  on public.repair_services (organisation_id, display_order)
  where is_public = true and active = true;

create table public.repair_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'JOB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_vehicle_id uuid references public.customer_vehicles(id) on delete set null,
  assigned_technician_id uuid references auth.users(id) on delete set null,
  status text not null default 'awaiting_inspection'
    check (
      status in (
        'awaiting_inspection',
        'diagnosing',
        'estimate_preparing',
        'awaiting_customer_approval',
        'approved',
        'parts_ordered',
        'parts_received',
        'work_in_progress',
        'quality_check',
        'ready_for_collection',
        'collected',
        'cancelled'
      )
    ),
  registration text,
  vehicle_make_model text,
  mileage integer check (mileage >= 0),
  reported_fault text not null,
  diagnosis text,
  labour_rate numeric(12,2) not null default 0 check (labour_rate >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  estimate_net numeric(12,2) not null default 0 check (estimate_net >= 0),
  estimate_vat numeric(12,2) not null default 0 check (estimate_vat >= 0),
  estimate_total numeric(12,2) not null default 0 check (estimate_total >= 0),
  approval_status text not null default 'not_requested'
    check (
      approval_status in (
        'not_requested',
        'requested',
        'approved',
        'partially_approved',
        'declined'
      )
    ),
  approval_recorded_at timestamptz,
  work_completed text,
  technician_notes text,
  internal_notes text,
  customer_facing_notes text,
  start_date date,
  due_date date,
  collection_date date,
  payment_status text not null default 'not_invoiced'
    check (
      payment_status in (
        'not_invoiced',
        'invoice_due',
        'part_paid',
        'paid',
        'refunded',
        'written_off'
      )
    ),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (due_date is null or start_date is null or due_date >= start_date),
  check (
    collection_date is null
    or start_date is null
    or collection_date >= start_date
  )
);

create unique index repair_jobs_org_reference_unique
  on public.repair_jobs (organisation_id, reference);
create index repair_jobs_status_idx
  on public.repair_jobs (organisation_id, status, due_date)
  where deleted_at is null;
create index repair_jobs_technician_idx
  on public.repair_jobs (organisation_id, assigned_technician_id, status, due_date)
  where deleted_at is null;
create index repair_jobs_customer_idx
  on public.repair_jobs (organisation_id, customer_id, created_at desc)
  where deleted_at is null;

create table public.repair_job_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  repair_job_id uuid not null references public.repair_jobs(id) on delete cascade,
  item_type text not null
    check (
      item_type in ('labour', 'part', 'fee', 'discount', 'inspection', 'note')
    ),
  description text not null,
  supplier text,
  part_number text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_cost numeric(12,2) check (unit_cost >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate between 0 and 100),
  line_total numeric(12,2) generated always as (
    round(quantity * unit_price, 2)
  ) stored,
  status text not null default 'planned'
    check (
      status in (
        'planned',
        'ordered',
        'received',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  customer_approved boolean,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index repair_job_items_job_idx
  on public.repair_job_items (repair_job_id, sort_order)
  where deleted_at is null;
create index repair_job_items_status_idx
  on public.repair_job_items (organisation_id, status)
  where deleted_at is null;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reference text not null default (
    'SALE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  salesperson_id uuid references auth.users(id) on delete set null,
  status text not null default 'enquiry'
    check (
      status in (
        'enquiry',
        'viewing',
        'test_drive',
        'negotiation',
        'deposit_taken',
        'reserved',
        'sale_agreed',
        'handover_scheduled',
        'completed',
        'cancelled'
      )
    ),
  sale_price numeric(12,2) check (sale_price >= 0),
  deposit numeric(12,2) not null default 0 check (deposit >= 0),
  part_exchange_allowance numeric(12,2) not null default 0
    check (part_exchange_allowance >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  warranty text,
  additional_products jsonb not null default '[]'::jsonb
    check (jsonb_typeof(additional_products) = 'array'),
  payment_method text,
  finance_referral_provider text,
  finance_referral_status text,
  sale_date date,
  handover_date date,
  gross_profit numeric(12,2),
  internal_notes text,
  completion_checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completion_checklist) = 'array'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  check (handover_date is null or sale_date is null or handover_date >= sale_date)
);

create unique index sales_org_reference_unique
  on public.sales (organisation_id, reference);
create index sales_status_idx
  on public.sales (organisation_id, status, created_at desc)
  where deleted_at is null;
create index sales_vehicle_idx
  on public.sales (organisation_id, vehicle_id, created_at desc)
  where deleted_at is null;
create index sales_salesperson_idx
  on public.sales (organisation_id, salesperson_id, sale_date desc)
  where deleted_at is null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  reminder_at timestamptz,
  recurrence_rule text,
  customer_id uuid references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  repair_job_id uuid references public.repair_jobs(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz
);

create index tasks_assigned_due_idx
  on public.tasks (organisation_id, assigned_user_id, due_at, priority)
  where deleted_at is null
    and status in ('open', 'in_progress', 'blocked');
create index tasks_overdue_idx
  on public.tasks (organisation_id, due_at)
  where deleted_at is null
    and status in ('open', 'in_progress', 'blocked');
create index tasks_customer_idx
  on public.tasks (organisation_id, customer_id)
  where deleted_at is null and customer_id is not null;
create index tasks_vehicle_idx
  on public.tasks (organisation_id, vehicle_id)
  where deleted_at is null and vehicle_id is not null;

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index task_comments_task_idx
  on public.task_comments (task_id, created_at);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text,
  file_name text,
  document_type text not null default 'other',
  storage_bucket text not null default 'private-documents',
  storage_path text not null,
  mime_type text not null,
  byte_size bigint check (byte_size between 1 and 52428800),
  size_bytes bigint check (size_bytes between 1 and 52428800),
  checksum_sha256 text,
  visibility text not null default 'private'
    check (visibility in ('private', 'customer', 'public')),
  entity_type text,
  entity_id uuid,
  customer_id uuid references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  sourcing_request_id uuid references public.sourcing_requests(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  repair_job_id uuid references public.repair_jobs(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  unique (storage_bucket, storage_path),
  check (coalesce(title, file_name) is not null),
  check (coalesce(byte_size, size_bytes) is not null)
);

create or replace function public.prepare_document_compatibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := coalesce(nullif(trim(new.title), ''), nullif(trim(new.file_name), ''));
  new.file_name := coalesce(nullif(trim(new.file_name), ''), nullif(trim(new.title), ''));
  new.byte_size := coalesce(new.byte_size, new.size_bytes);
  new.size_bytes := coalesce(new.size_bytes, new.byte_size);
  return new;
end;
$$;

create trigger documents_prepare_compatibility
before insert or update on public.documents
for each row execute function public.prepare_document_compatibility();

create index documents_org_created_idx
  on public.documents (organisation_id, created_at desc)
  where deleted_at is null;
create index documents_customer_idx
  on public.documents (organisation_id, customer_id)
  where deleted_at is null and customer_id is not null;
create index documents_repair_idx
  on public.documents (organisation_id, repair_job_id)
  where deleted_at is null and repair_job_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  notification_type text not null
    check (
      notification_type in (
        'new_lead',
        'new_repair_booking',
        'new_sourcing_request',
        'appointment_cancelled',
        'task_overdue',
        'vehicle_reserved',
        'vehicle_sold',
        'sync_failed',
        'lookup_failed',
        'repair_awaiting_approval',
        'system'
      )
    ),
  title text not null,
  body text,
  action_url text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index notifications_recipient_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);
create index notifications_org_type_idx
  on public.notifications (organisation_id, notification_type, created_at desc);

create table public.website_pages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  page_type text not null
    check (
      page_type in (
        'homepage',
        'about',
        'repairs',
        'contact',
        'faq',
        'testimonials',
        'privacy',
        'cookies',
        'terms',
        'custom'
      )
    ),
  slug text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  seo_title text,
  seo_description text,
  requires_legal_review boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  unique (organisation_id, slug)
);

create index website_pages_status_idx
  on public.website_pages (organisation_id, status, updated_at desc)
  where deleted_at is null;

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  provider text not null,
  status text not null default 'not_configured'
    check (
      status in (
        'not_configured',
        'connected',
        'authentication_failed',
        'permission_missing',
        'syncing',
        'error',
        'disabled'
      )
    ),
  public_configuration jsonb not null default '{}'::jsonb
    check (jsonb_typeof(public_configuration) = 'object'),
  secret_reference text,
  last_connected_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, provider)
);

create index integration_settings_status_idx
  on public.integration_settings (organisation_id, status);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  occurred_at timestamptz,
  status text not null default 'received'
    check (
      status in ('received', 'processing', 'processed', 'ignored', 'failed')
    ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_retry_at timestamptz,
  processed_at timestamptz,
  error_code text,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index webhook_events_pending_idx
  on public.webhook_events (status, next_retry_at, received_at)
  where status in ('received', 'failed');
create index webhook_events_org_idx
  on public.webhook_events (organisation_id, received_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id text,
  table_name text not null default 'application',
  record_id uuid,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text,
  entity_id uuid,
  change_reason text,
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now(),
  source text not null default 'database'
);

create index audit_logs_org_time_idx
  on public.audit_logs (organisation_id, occurred_at desc);
create index audit_logs_record_idx
  on public.audit_logs (table_name, record_id, occurred_at desc);
create index audit_logs_actor_idx
  on public.audit_logs (organisation_id, actor_user_id, occurred_at desc);

create view public.public_repair_services
with (security_barrier = true)
as
select
  rs.id,
  rs.organisation_id,
  o.slug as organisation_slug,
  rs.name,
  rs.slug,
  rs.short_description,
  rs.full_description,
  rs.icon_name,
  rs.display_order,
  rs.indicative_price_from
from public.repair_services rs
join public.organisations o on o.id = rs.organisation_id
where rs.is_public = true
  and rs.active = true
  and o.status = 'active'
  and o.deleted_at is null;

create view public.public_website_pages
with (security_barrier = true)
as
select
  wp.id,
  wp.organisation_id,
  o.slug as organisation_slug,
  wp.page_type,
  wp.slug,
  wp.title,
  wp.content,
  wp.seo_title,
  wp.seo_description,
  wp.requires_legal_review,
  wp.published_at,
  wp.updated_at
from public.website_pages wp
join public.organisations o on o.id = wp.organisation_id
where wp.status = 'published'
  and wp.deleted_at is null
  and o.status = 'active'
  and o.deleted_at is null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'leads',
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
    'documents',
    'website_pages',
    'integration_settings',
    'webhook_events'
  ]
  loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

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
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

revoke all on public.public_repair_services from public;
revoke all on public.public_website_pages from public;
grant select on public.public_repair_services to anon, authenticated;
grant select on public.public_website_pages to anon, authenticated;

commit;
