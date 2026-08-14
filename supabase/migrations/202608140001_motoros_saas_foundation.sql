begin;

-- MOTOR.OS platform administrators are deliberately separate from dealership
-- memberships. The email allow-list remains a read-only bootstrap mechanism in
-- the application; mutating platform actions require a row in this table.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.status = 'active'
  );
$$;

alter table public.organisations
  drop constraint if exists organisations_status_check;
alter table public.organisations
  add constraint organisations_status_check
  check (status in ('trial', 'active', 'suspended', 'cancelled', 'closed'));

create table public.dealership_subscriptions (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  plan_code text not null default 'starter'
    check (plan_code in ('starter', 'professional', 'premium', 'custom')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  provider text,
  external_customer_id text,
  external_subscription_id text,
  monthly_amount_pence integer check (
    monthly_amount_pence is null or monthly_amount_pence >= 0
  ),
  currency_code char(3) not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index dealership_subscriptions_status_idx
  on public.dealership_subscriptions (status, plan_code, updated_at desc);

create table public.dealership_entitlements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  feature_key text not null check (
    feature_key ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'
  ),
  enabled boolean not null,
  limits jsonb not null default '{}'::jsonb
    check (jsonb_typeof(limits) = 'object'),
  source text not null default 'override'
    check (source in ('plan', 'override', 'trial')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, feature_key)
);

create index dealership_entitlements_org_enabled_idx
  on public.dealership_entitlements (organisation_id, enabled, feature_key);

create table public.website_themes (
  id text primary key check (id in ('modern', 'performance', 'classic', 'luxury')),
  name text not null,
  description text not null,
  preview_tokens jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preview_tokens) = 'object'),
  required_entitlement text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.website_themes (
  id,
  name,
  description,
  preview_tokens,
  required_entitlement,
  display_order
)
values
  (
    'modern',
    'Modern',
    'Bright, minimal and conversion-focused with clean vehicle cards.',
    '{"surface":"#ffffff","ink":"#172033","accent":"#2f6f60"}',
    null,
    10
  ),
  (
    'performance',
    'Performance',
    'Dark, high-contrast presentation for sports and performance stock.',
    '{"surface":"#111315","ink":"#f7f7f5","accent":"#ef3d32"}',
    'website.themes.premium',
    20
  ),
  (
    'classic',
    'Classic Dealer',
    'Traditional, trustworthy styling with prominent contact actions.',
    '{"surface":"#f6f1e7","ink":"#22354a","accent":"#b87a2c"}',
    null,
    30
  ),
  (
    'luxury',
    'Luxury',
    'Editorial spacing, restrained colour and premium typography.',
    '{"surface":"#f7f5f0","ink":"#161616","accent":"#9c7b45"}',
    'website.themes.premium',
    40
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  preview_tokens = excluded.preview_tokens,
  required_entitlement = excluded.required_entitlement,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

-- Keep the database permission catalogue aligned with the application roles.
-- Owner already has the wildcard grant.
update public.roles
set permissions = permissions || '["social:*","website:*"]'::jsonb,
    updated_at = now()
where code = 'manager';

update public.roles
set permissions = permissions || '["social:read"]'::jsonb,
    updated_at = now()
where code = 'salesperson';

-- Composite uniqueness lets every new cross-entity foreign key prove that
-- both sides belong to the same dealership, not merely that an ID exists.
alter table public.customers
  add constraint customers_org_id_unique unique (organisation_id, id);
alter table public.vehicles
  add constraint vehicles_org_id_unique unique (organisation_id, id);
alter table public.leads
  add constraint leads_org_id_unique unique (organisation_id, id);

create table public.dealership_sites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references public.organisations(id) on delete cascade,
  theme_id text not null default 'modern' references public.website_themes(id),
  status text not null default 'draft'
    check (status in ('disabled', 'draft', 'live', 'suspended')),
  suspended_from_status text check (
    suspended_from_status is null
    or suspended_from_status in ('disabled', 'draft', 'live')
  ),
  hosted_subdomain text unique check (
    hosted_subdomain is null
    or hosted_subdomain ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  branding jsonb not null default '{}'::jsonb
    check (jsonb_typeof(branding) = 'object'),
  homepage_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(homepage_settings) = 'object'),
  navigation jsonb not null default '[]'::jsonb
    check (jsonb_typeof(navigation) = 'array'),
  seo_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(seo_settings) = 'object'),
  published_at timestamptz,
  last_deployment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, id)
);

create index dealership_sites_status_idx
  on public.dealership_sites (status, theme_id, updated_at desc);

create table public.dealership_domains (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null,
  hostname text not null unique check (
    hostname = lower(hostname)
    and hostname ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'
  ),
  domain_type text not null check (domain_type in ('hosted', 'custom')),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'active', 'error', 'disabled')),
  verification_token_hash text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint dealership_domains_site_tenant_fk
    foreign key (organisation_id, site_id)
    references public.dealership_sites(organisation_id, id)
    on delete cascade
);

create index dealership_domains_org_status_idx
  on public.dealership_domains (organisation_id, status, domain_type);

-- Reuse the existing integration_settings table as the single connection
-- record rather than introducing a competing social-account model.
alter table public.integration_settings
  drop constraint if exists integration_settings_status_check;
alter table public.integration_settings
  add constraint integration_settings_status_check
  check (
    status in (
      'not_configured',
      'connecting',
      'connected',
      'token_expired',
      'action_required',
      'authentication_failed',
      'permission_missing',
      'syncing',
      'error',
      'disabled'
    )
  );
alter table public.integration_settings
  add column if not exists account_name text,
  add column if not exists account_username text,
  add column if not exists account_avatar_url text,
  add column if not exists capabilities text[] not null default '{}',
  add column if not exists credentials_updated_at timestamptz;
alter table public.integration_settings
  add constraint integration_settings_org_id_unique unique (organisation_id, id);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  vehicle_id uuid,
  caption text not null check (char_length(caption) between 1 and 5000),
  call_to_action text,
  media jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media) = 'array'),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organisation_id, id),
  constraint social_posts_vehicle_tenant_fk
    foreign key (organisation_id, vehicle_id)
    references public.vehicles(organisation_id, id)
    on delete set null (vehicle_id)
);

create index social_posts_calendar_idx
  on public.social_posts (organisation_id, scheduled_for, status)
  where status in ('draft', 'scheduled', 'publishing', 'failed');

create table public.social_post_targets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  social_post_id uuid not null,
  integration_setting_id uuid not null,
  provider text not null,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  external_post_id text,
  error_code text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (social_post_id, integration_setting_id),
  constraint social_post_targets_post_tenant_fk
    foreign key (organisation_id, social_post_id)
    references public.social_posts(organisation_id, id)
    on delete cascade,
  constraint social_post_targets_connection_tenant_fk
    foreign key (organisation_id, integration_setting_id)
    references public.integration_settings(organisation_id, id)
    on delete cascade
);

create index social_post_targets_delivery_idx
  on public.social_post_targets (organisation_id, status, updated_at desc);

create table public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  integration_setting_id uuid,
  provider text not null,
  external_conversation_id text,
  customer_id uuid,
  vehicle_id uuid,
  lead_id uuid,
  assigned_user_id uuid references auth.users(id) on delete set null,
  subject text,
  status text not null default 'open'
    check (status in ('open', 'pending', 'closed', 'spam')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, provider, external_conversation_id),
  unique (organisation_id, id),
  constraint social_conversations_connection_tenant_fk
    foreign key (organisation_id, integration_setting_id)
    references public.integration_settings(organisation_id, id)
    on delete restrict,
  constraint social_conversations_customer_tenant_fk
    foreign key (organisation_id, customer_id)
    references public.customers(organisation_id, id)
    on delete set null (customer_id),
  constraint social_conversations_vehicle_tenant_fk
    foreign key (organisation_id, vehicle_id)
    references public.vehicles(organisation_id, id)
    on delete set null (vehicle_id),
  constraint social_conversations_lead_tenant_fk
    foreign key (organisation_id, lead_id)
    references public.leads(organisation_id, id)
    on delete set null (lead_id)
);

create index social_conversations_inbox_idx
  on public.social_conversations (organisation_id, status, last_message_at desc);

create table public.social_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  conversation_id uuid not null,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  sender_display_name text,
  body text,
  media jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media) = 'array'),
  delivery_status text not null default 'received'
    check (delivery_status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, conversation_id, external_message_id),
  constraint social_messages_conversation_tenant_fk
    foreign key (organisation_id, conversation_id)
    references public.social_conversations(organisation_id, id)
    on delete cascade
);

create index social_messages_conversation_idx
  on public.social_messages (organisation_id, conversation_id, sent_at);

alter table public.leads
  add column if not exists source_campaign text,
  add column if not exists source_external_id text,
  add column if not exists originating_conversation_id uuid;
alter table public.leads
  add constraint leads_originating_conversation_tenant_fk
  foreign key (organisation_id, originating_conversation_id)
  references public.social_conversations(organisation_id, id)
  on delete set null (originating_conversation_id);
create index if not exists leads_source_attribution_idx
  on public.leads (organisation_id, source, created_at desc)
  where deleted_at is null;

create or replace function public.convert_social_conversation_to_lead(
  target_organisation_id uuid,
  target_conversation_id uuid,
  actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation public.social_conversations%rowtype;
  latest_message text;
  created_lead_id uuid;
  lead_title text;
begin
  select *
  into strict conversation
  from public.social_conversations
  where organisation_id = target_organisation_id
    and id = target_conversation_id
  for update;

  if conversation.lead_id is not null then
    return conversation.lead_id;
  end if;

  select body
  into latest_message
  from public.social_messages
  where organisation_id = target_organisation_id
    and conversation_id = target_conversation_id
    and direction = 'inbound'
  order by sent_at desc
  limit 1;

  lead_title := coalesce(
    nullif(trim(conversation.subject), ''),
    initcap(replace(conversation.provider, '_', ' ')) || ' enquiry'
  );

  insert into public.leads (
    organisation_id,
    lead_type,
    status,
    customer_id,
    vehicle_id,
    assigned_user_id,
    title,
    subject,
    message,
    source,
    source_detail,
    source_external_id,
    originating_conversation_id,
    metadata,
    created_by
  )
  values (
    target_organisation_id,
    'general_enquiry',
    'new',
    conversation.customer_id,
    conversation.vehicle_id,
    conversation.assigned_user_id,
    lead_title,
    lead_title,
    latest_message,
    conversation.provider,
    conversation.provider || ' conversation',
    conversation.external_conversation_id,
    conversation.id,
    jsonb_build_object(
      'provider', conversation.provider,
      'social_conversation_id', conversation.id
    ),
    actor_user_id
  )
  returning id into created_lead_id;

  update public.social_conversations
  set lead_id = created_lead_id,
      updated_at = now()
  where organisation_id = target_organisation_id
    and id = target_conversation_id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    changed_fields,
    new_values,
    source
  )
  values (
    target_organisation_id,
    actor_user_id,
    'leads',
    created_lead_id,
    'social_conversation.converted_to_lead',
    'lead',
    created_lead_id,
    array['source', 'originating_conversation_id'],
    jsonb_build_object(
      'source', conversation.provider,
      'originating_conversation_id', conversation.id
    ),
    'admin_api'
  );

  return created_lead_id;
end;
$$;

create or replace function public.initialise_motoros_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dealership_subscriptions (
    organisation_id,
    plan_code,
    status,
    trial_ends_at,
    created_by
  )
  values (new.id, 'starter', 'trialing', now() + interval '14 days', new.created_by)
  on conflict (organisation_id) do nothing;

  insert into public.dealership_sites (
    organisation_id,
    theme_id,
    status,
    hosted_subdomain,
    updated_by
  )
  values (new.id, 'modern', 'draft', new.slug, new.created_by)
  on conflict (organisation_id) do nothing;

  return new;
end;
$$;

create trigger organisations_initialise_motoros_tenant
after insert on public.organisations
for each row execute function public.initialise_motoros_tenant();

insert into public.dealership_subscriptions (
  organisation_id,
  plan_code,
  status,
  current_period_starts_at,
  created_by
)
select o.id, 'starter', 'active', o.created_at, o.created_by
from public.organisations o
on conflict (organisation_id) do nothing;

insert into public.dealership_sites (
  organisation_id,
  theme_id,
  status,
  hosted_subdomain,
  updated_by
)
select o.id, 'modern', 'draft', o.slug, o.created_by
from public.organisations o
on conflict (organisation_id) do nothing;

create or replace function public.platform_set_dealership_status(
  target_organisation_id uuid,
  next_status text,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access is required'
      using errcode = '42501';
  end if;

  if next_status not in ('active', 'suspended') then
    raise exception 'Unsupported dealership status transition'
      using errcode = '22023';
  end if;

  select status
  into strict previous_status
  from public.organisations
  where id = target_organisation_id
    and deleted_at is null
  for update;

  if previous_status = next_status then
    return;
  end if;

  update public.organisations
  set status = next_status,
      updated_at = now()
  where id = target_organisation_id;

  update public.dealership_sites
  set suspended_from_status = case
        when next_status = 'suspended' and status <> 'suspended' then status
        when next_status = 'active' then null
        else suspended_from_status
      end,
      status = case
        when next_status = 'suspended' then 'suspended'
        when status = 'suspended' then coalesce(suspended_from_status, 'draft')
        else status
      end,
      updated_at = now(),
      updated_by = auth.uid()
  where organisation_id = target_organisation_id;

  insert into public.audit_logs (
    organisation_id,
    actor_user_id,
    table_name,
    record_id,
    action,
    entity_type,
    entity_id,
    change_reason,
    changed_fields,
    old_values,
    new_values,
    source
  )
  values (
    target_organisation_id,
    auth.uid(),
    'organisations',
    target_organisation_id,
    case
      when next_status = 'suspended' then 'platform.dealership.suspended'
      else 'platform.dealership.reactivated'
    end,
    'organisation',
    target_organisation_id,
    nullif(trim(reason), ''),
    array['status'],
    jsonb_build_object('status', previous_status),
    jsonb_build_object('status', next_status),
    'platform_admin'
  );
end;
$$;

create or replace view public.public_dealerships
with (security_invoker = on, security_barrier = true)
as
select
  o.id,
  o.slug,
  ds.dealership_name,
  ds.logo_path,
  ds.telephone,
  ds.email,
  ds.address,
  ds.opening_hours,
  ds.social_links,
  ds.company_number,
  ds.vat_number,
  ds.brand_primary_colour,
  ds.brand_accent_colour,
  ds.homepage_wording,
  ds.legal_wording,
  ds.timezone,
  coalesce(site.theme_id, 'modern') as website_theme_id,
  coalesce(site.status, 'draft') as website_status
from public.organisations o
join public.dealership_settings ds on ds.organisation_id = o.id
left join public.dealership_sites site on site.organisation_id = o.id
where o.status = 'active'
  and o.deleted_at is null
  and (site.status is null or site.status in ('draft', 'live'));

-- Pre-aggregate control-centre metrics in Postgres. The application reads one
-- row per tenant instead of transferring every vehicle, invoice, lead and sale
-- to the Next.js process. This view is service-role only.
create or replace view public.platform_dealership_metrics
with (security_invoker = on, security_barrier = true)
as
with member_metrics as (
  select organisation_id, count(distinct user_id) as member_count
  from public.organisation_members
  where status = 'active' and deleted_at is null
  group by organisation_id
),
vehicle_metrics as (
  select
    organisation_id,
    count(*) as vehicle_count,
    count(*) filter (where status <> 'sold') as vehicles_in_stock,
    count(*) filter (where is_public) as advertised_vehicle_count,
    count(*) filter (where status = 'sold') as sold_vehicle_count
  from public.vehicles
  where deleted_at is null
  group by organisation_id
),
invoice_metrics as (
  select
    organisation_id,
    count(*) filter (where status not in ('cancelled', 'void')) as active_invoice_count,
    count(*) filter (
      where status not in ('cancelled', 'void')
        and created_at >= now() - interval '30 days'
    ) as invoices_last_30_days,
    coalesce(sum(total) filter (
      where status not in ('cancelled', 'void')
        and created_at >= now() - interval '30 days'
    ), 0) as invoiced_value_last_30_days
  from public.invoices
  where deleted_at is null
  group by organisation_id
),
lead_metrics as (
  select organisation_id, count(*) as lead_count
  from public.leads
  where deleted_at is null
  group by organisation_id
),
sale_metrics as (
  select organisation_id, count(*) as sale_count
  from public.sales
  where deleted_at is null
  group by organisation_id
),
activity_metrics as (
  select organisation_id, max(occurred_at) as last_activity_at
  from public.audit_logs
  where organisation_id is not null
  group by organisation_id
)
select
  o.id as organisation_id,
  o.name,
  o.slug,
  o.status,
  o.created_at,
  coalesce(mm.member_count, 0) as member_count,
  coalesce(vm.vehicle_count, 0) as vehicle_count,
  coalesce(vm.vehicles_in_stock, 0) as vehicles_in_stock,
  coalesce(vm.advertised_vehicle_count, 0) as advertised_vehicle_count,
  coalesce(vm.sold_vehicle_count, 0) as sold_vehicle_count,
  coalesce(im.active_invoice_count, 0) as active_invoice_count,
  coalesce(im.invoices_last_30_days, 0) as invoices_last_30_days,
  coalesce(im.invoiced_value_last_30_days, 0) as invoiced_value_last_30_days,
  coalesce(lm.lead_count, 0) as lead_count,
  coalesce(sm.sale_count, 0) as sale_count,
  am.last_activity_at
from public.organisations o
left join member_metrics mm on mm.organisation_id = o.id
left join vehicle_metrics vm on vm.organisation_id = o.id
left join invoice_metrics im on im.organisation_id = o.id
left join lead_metrics lm on lm.organisation_id = o.id
left join sale_metrics sm on sm.organisation_id = o.id
left join activity_metrics am on am.organisation_id = o.id
where o.deleted_at is null;

create trigger platform_admins_touch_updated_at
before update on public.platform_admins
for each row execute function public.touch_updated_at();
create trigger dealership_subscriptions_touch_updated_at
before update on public.dealership_subscriptions
for each row execute function public.touch_updated_at();
create trigger dealership_entitlements_touch_updated_at
before update on public.dealership_entitlements
for each row execute function public.touch_updated_at();
create trigger website_themes_touch_updated_at
before update on public.website_themes
for each row execute function public.touch_updated_at();
create trigger dealership_sites_touch_updated_at
before update on public.dealership_sites
for each row execute function public.touch_updated_at();
create trigger dealership_domains_touch_updated_at
before update on public.dealership_domains
for each row execute function public.touch_updated_at();
create trigger social_posts_touch_updated_at
before update on public.social_posts
for each row execute function public.touch_updated_at();
create trigger social_post_targets_touch_updated_at
before update on public.social_post_targets
for each row execute function public.touch_updated_at();
create trigger social_conversations_touch_updated_at
before update on public.social_conversations
for each row execute function public.touch_updated_at();

alter table public.platform_admins enable row level security;
alter table public.dealership_subscriptions enable row level security;
alter table public.dealership_entitlements enable row level security;
alter table public.website_themes enable row level security;
alter table public.dealership_sites enable row level security;
alter table public.dealership_domains enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_targets enable row level security;
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;

create policy platform_admins_select_self
on public.platform_admins for select to authenticated
using (user_id = auth.uid());

create policy dealership_subscriptions_read_owner
on public.dealership_subscriptions for select to authenticated
using (public.has_org_role(organisation_id, array['owner']));

create policy dealership_entitlements_read_member
on public.dealership_entitlements for select to authenticated
using (public.is_org_member(organisation_id));

create policy website_themes_read_active
on public.website_themes for select to anon, authenticated
using (is_active = true);

create policy dealership_sites_read_content_staff
on public.dealership_sites for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);

create policy dealership_sites_read_public_projection
on public.dealership_sites for select to anon, authenticated
using (
  status in ('draft', 'live')
  and exists (
    select 1
    from public.organisations o
    where o.id = dealership_sites.organisation_id
      and o.status = 'active'
      and o.deleted_at is null
  )
);

create policy dealership_domains_read_content_staff
on public.dealership_domains for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'website_editor']
  )
);

create policy social_posts_read_engagement_staff
on public.social_posts for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy social_post_targets_read_engagement_staff
on public.social_post_targets for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy social_conversations_read_engagement_staff
on public.social_conversations for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

create policy social_messages_read_engagement_staff
on public.social_messages for select to authenticated
using (
  public.has_org_role(
    organisation_id,
    array['owner', 'manager', 'salesperson']
  )
);

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.dealership_subscriptions from anon, authenticated;
revoke all on public.dealership_entitlements from anon, authenticated;
revoke all on public.website_themes from anon, authenticated;
revoke all on public.dealership_sites from anon, authenticated;
revoke all on public.dealership_domains from anon, authenticated;
revoke all on public.social_posts from anon, authenticated;
revoke all on public.social_post_targets from anon, authenticated;
revoke all on public.social_conversations from anon, authenticated;
revoke all on public.social_messages from anon, authenticated;

grant select on public.platform_admins to authenticated;
grant select on public.dealership_subscriptions to authenticated;
grant select on public.dealership_entitlements to authenticated;
grant select on public.website_themes to anon, authenticated;
grant select (
  organisation_id,
  theme_id,
  status
) on public.dealership_sites to anon, authenticated;
grant select (
  id,
  organisation_id,
  site_id,
  hostname,
  domain_type,
  status,
  last_checked_at,
  verified_at,
  created_at,
  updated_at,
  created_by
) on public.dealership_domains to authenticated;
grant select on public.social_posts to authenticated;
grant select on public.social_post_targets to authenticated;
grant select on public.social_conversations to authenticated;
grant select on public.social_messages to authenticated;

revoke all on public.platform_dealership_metrics from public, anon, authenticated;
grant select on public.platform_dealership_metrics to service_role;

-- security_invoker views require their callers to hold privileges on the
-- referenced columns. Grant only the public projection—not registrations,
-- VINs, costs, margins, internal notes or other commercial fields. The public
-- RLS policies from 202607290001 still determine which rows are visible.
grant select (
  id,
  slug,
  status,
  deleted_at
) on public.organisations to anon;
grant select (
  organisation_id,
  dealership_name,
  logo_path,
  telephone,
  email,
  address,
  opening_hours,
  social_links,
  company_number,
  vat_number,
  brand_primary_colour,
  brand_accent_colour,
  homepage_wording,
  legal_wording,
  timezone
) on public.dealership_settings to anon;
grant select (
  id,
  organisation_id,
  slug,
  public_title,
  attention_grabber,
  make,
  model,
  derivative,
  trim_level,
  body_type,
  fuel_type,
  transmission,
  colour,
  doors,
  seats,
  engine_size_cc,
  power_bhp,
  co2_emissions_g_km,
  euro_emissions_standard,
  ulez_status,
  year,
  registration_year,
  mot_expiry,
  mot_status,
  mileage,
  service_history,
  warranty,
  retail_price,
  description,
  standard_equipment,
  optional_equipment,
  finance_example_text,
  warranty_wording,
  video_url,
  featured,
  features,
  status,
  created_at,
  is_public,
  deleted_at
) on public.vehicles to anon, authenticated;
grant select (
  id,
  organisation_id,
  vehicle_id,
  storage_bucket,
  storage_path,
  external_url,
  mime_type,
  width,
  height,
  sort_order,
  is_cover,
  alt_text,
  caption,
  is_public,
  deleted_at
) on public.vehicle_images to anon, authenticated;
grant select (
  id,
  vehicle_id,
  name,
  sort_order
) on public.vehicle_features to anon, authenticated;

-- An authenticated browser can inspect connection state but never the
-- server-side secret reference used by provider adapters. Connection writes
-- are server-only so a browser cannot claim a connection or granted scope.
revoke all on public.integration_settings from anon, authenticated;
grant select (
  id,
  organisation_id,
  provider,
  status,
  public_configuration,
  last_connected_at,
  last_successful_sync_at,
  last_error_at,
  last_error_code,
  last_error_message,
  created_at,
  updated_at,
  created_by,
  account_name,
  account_username,
  account_avatar_url,
  capabilities,
  credentials_updated_at
) on public.integration_settings to authenticated;

revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;
revoke all on function public.initialise_motoros_tenant() from public, anon, authenticated;
revoke all on function public.platform_set_dealership_status(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.platform_set_dealership_status(uuid, text, text)
  to authenticated;
revoke all on function public.convert_social_conversation_to_lead(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.convert_social_conversation_to_lead(uuid, uuid, uuid)
  to service_role;

commit;
