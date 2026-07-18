# DealerOS database

DealerOS uses Supabase Postgres, Auth and Storage. The migrations are the source
of truth; do not create production tables or policies manually in the Supabase
dashboard.

## Apply migrations

For local development:

```powershell
supabase start
supabase db reset
```

`supabase db reset` applies every file in `supabase/migrations/` in order and
then runs `supabase/seed.sql`.

The package seed command is development-only:

```powershell
npm run seed
```

With no database URL it runs a local Supabase reset. With `DATABASE_URL` (or
`SUPABASE_DB_URL`) it applies only `seed.sql` through `psql`. Remote seeding is
refused unless `ALLOW_REMOTE_SEED=true`; never enable that flag for production.

For a hosted project, link the Supabase CLI to the intended project and run:

```powershell
supabase db push
```

Review the target project reference before approving any hosted database
change. The seed file is for development and test environments only.

## First owner

### New, empty deployment

1. Create the first user in Supabase Authentication.
2. Sign in as that user.
3. Call the authenticated RPC once:

```ts
const { data: organisationId, error } = await supabase.rpc(
  "bootstrap_organisation",
  {
    organisation_name: "Your dealership name",
    organisation_slug: "your-dealership",
  },
);
```

The function creates the organisation, dealership settings and active owner
membership in one transaction. It refuses unauthenticated callers and accounts
that already have an active membership.

### Seeded local database

The development seed creates organisation
`00000000-0000-4000-8000-000000000001`, but deliberately does not create an
Auth user. After creating a local Auth user, copy its UUID and run the following
once in the local SQL editor:

```sql
begin;

insert into public.profiles (id, display_name, full_name)
values ('YOUR-AUTH-USER-UUID', 'Local Owner', 'Local Owner')
on conflict (id) do update
set display_name = excluded.display_name,
    full_name = excluded.full_name;

insert into public.organisation_members (
  organisation_id,
  user_id,
  role_id,
  role,
  status,
  is_primary,
  joined_at,
  created_by
)
select
  '00000000-0000-4000-8000-000000000001',
  'YOUR-AUTH-USER-UUID',
  r.id,
  r.code,
  'active',
  true,
  now(),
  'YOUR-AUTH-USER-UUID'
from public.roles r
where r.code = 'owner'
on conflict (organisation_id, user_id) do update
set role_id = excluded.role_id,
    role = excluded.role,
    status = 'active',
    deleted_at = null;

commit;
```

Do not expose an unauthenticated “claim owner” endpoint. On hosted deployments,
perform owner creation in a controlled setup session and confirm the membership
before sharing the admin URL.

## Security model

- Every operational record carries `organisation_id`.
- Foreign-record triggers reject links across organisations.
- RLS is enabled on all private tables. Anonymous users have no direct access
  to customer, staff, stock-commercial, repair, sales or integration tables.
- `owner` bypass is implemented through role-aware helper functions, not by
  disabling RLS.
- Salespeople are limited to assigned operational records where appropriate.
- Technicians use an assigned-job projection and a narrow update RPC.
- Website editors use presentation-only projections and a field-whitelisting
  update RPC, so financial stock columns remain unavailable.
- Public stock is exposed through `public_vehicle_inventory`,
  `public_vehicle_images` and `public_vehicle_features`. The base `vehicles`
  table is never granted to `anon`.
- Authenticated operational reads use `staff_vehicle_records` and
  `staff_sales_records`; the base vehicle, sales and cost tables are not
  selectable by browser sessions. Operational base-table writes are revoked
  from `authenticated` and go through validated server workflows.
- Public pages and repair services are exposed through filtered views.
- Public form routes should use their server-side service-role client. The
  service-role key must never be bundled into browser code.

The database provides atomic service-role RPCs:

- `submit_public_enquiry(organisation_id, payload)`
- `submit_public_sourcing_request(organisation_id, payload)`
- `book_repair_call(...)`
- `create_vehicle_with_costs(...)` and `update_vehicle_with_costs(...)`
- `attach_vehicle_image(...)`, `reorder_vehicle_images(...)` and
  `soft_delete_vehicle_image(...)`
- `convert_appointment_to_repair(...)` and `record_vehicle_sale(...)`
- `merge_customers(...)` and `accept_team_invitation(...)`
- `update_team_member_access(...)`
- `update_sourcing_request(...)`, `replace_availability_rules(...)` and
  `publish_homepage(...)`

The booking function matches or creates the customer, creates the lead and
appointment, and emits notifications in one transaction. It takes an advisory
transaction lock, re-checks live capacity and inserts through a GiST exclusion
constraint, so concurrent requests cannot occupy the same capacity resource.
`public_available_appointment_slots` exposes timestamps and remaining capacity
only; it never exposes staff or customer diary details.

Public routes should still enforce same-origin checks, input schemas,
application-level rate limits and a honeypot. Database submission counters add
a second, durable throttle and are not directly queryable.

## Audit and integration safety

Audit triggers record changes to vehicles, customers, appointments, repair
jobs, sales, organisation membership and integration settings. Vehicle status
also has a dedicated history table. Audit logs are owner-only.

`integration_settings` stores non-secret configuration and a
`secret_reference`; provider secrets remain environment variables or references
to a suitable secret manager. Webhook events are idempotent through the unique
`(provider, external_event_id)` key. Store only the required payload, verify
signatures before processing, and update the event status retry-safely.

The database does not imply that DVLA, Auto Trader, email or SMS access is
configured. Missing integrations must retain the manual workflows.

## Storage

Migrations create:

- `vehicle-public` — public optimised vehicle photography
- `branding-public` — public logos and branding
- `private-documents` — private business/customer documents
- `repair-uploads` — reserved private repair evidence bucket; the current
  repair-call photo route stores validated files in `private-documents`

Every object path must begin with the organisation UUID:

```text
<organisation-id>/<entity>/<entity-id>/<random-file-name>
```

Database metadata should use the same bucket/path pair. Private files are
served with short-lived signed URLs generated only after an authorised
server-side access check. File type and size limits are enforced by both Storage
bucket configuration and application validation. Image deletion first commits
the database change and queues object removal in `storage_cleanup_jobs`; the
authenticated hourly cleanup route retries failed removals.

Broadcast notification read state is stored per user in
`notification_receipts`; reading a dealership-wide notification never marks it
read for another staff member.

## Seed scope

The seed includes:

- 12 vehicles across ready, forecourt, reserved, preparation, due-in,
  photography and sold states
- public-safe photographs and feature data
- 8 customers and customer vehicles
- sales and sourcing leads, four sourcing requests and candidate vehicles
- repair-call appointment types, weekday availability and a closure
- repair bookings, repair jobs and itemised work
- completed sales, operational tasks, website pages, services, notifications
  and integration states

The organisation name and all contact/brand content remain editable. Seeded
contact details are reserved examples and must be replaced before deployment.
