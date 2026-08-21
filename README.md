# MotorOS

MotorOS is a Vercel-compatible, multi-tenant UK dealership platform built as
one Next.js application over one Supabase database:

- a premium public website for stock, enquiries, car sourcing and repair-call
  booking;
- a permission-aware operating system for stock, leads, sourcing, repairs,
  diary, customers, tasks, reporting, website content, audit and integrations.

Each dealership has an isolated organisation, staff memberships, stock, leads,
website settings, domains and audit history. A shared theme registry supplies
Direct Motors Classic, Modern Marketplace, Prestige and Performance without
copying tenant data. The separately protected `/platform` area lets MotorOS
owners operate all dealerships; platform support is audited and read-only.

The included privacy, cookie and terms pages are templates and must be
professionally reviewed for every deploying dealership.

## Stack

- Next.js App Router, React and strict TypeScript
- Tailwind CSS and local shadcn/ui-compatible components
- Supabase Postgres, Auth, Storage and Row Level Security
- React Hook Form and Zod
- date-fns/date-fns-tz
- Vitest and Playwright

## Important operating model

Supabase is the source of truth. Public forms are validated on the server and
use a server-only service client to perform narrow customer-matching and
workflow creation operations. Staff requests use an authenticated Supabase
session and server-side permission checks. Operational reads use database RLS
and safe staff views; writes use validated server routes and narrow
transactional functions. The service-role key is never included in browser
code.

When Supabase is absent, public pages show safe empty/configuration states.
Realistic fallback stock and process-memory writes are enabled only when
`DEALEROS_DEMO_MODE=true` outside production. Demo mode must never be treated
as production persistence.

## Quick start

Prerequisites:

- Node.js 20.9 or newer
- npm 11 or newer
- a Supabase project, or the Supabase CLI with Docker

Install and configure:

```powershell
npm install
Copy-Item .env.example .env.local
```

Set at minimum:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DEALEROS_PUBLIC_ORGANISATION_ID=...
MOTOROS_BASE_DOMAIN=localhost
MOTOROS_LOCAL_ORGANISATION_SLUG=direct-motors
MOTOROS_TRUST_PROXY_HOST=false
PLATFORM_ADMIN_EMAILS=
VEHICLE_LOOKUP_PROVIDER=mock
```

Apply the migrations using either:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

or, for a disposable local stack:

```powershell
supabase start
supabase db reset
```

Then create the first Auth user and dealership membership as described in
`docs/DATABASE.md`. Assign the platform owner separately using
`docs/PLATFORM_ADMIN.md`. Start the application:

```powershell
npm run dev
```

Open `http://localhost:3000` for the public site and
`http://localhost:3000/admin` for the dealership workspace. Platform owners use
`http://localhost:3000/platform`; owner-led dealership creation starts at
`http://localhost:3000/onboarding`.

Public tenant routing uses a verified custom domain or a subdomain beneath
`MOTOROS_BASE_DOMAIN`. Localhost deliberately falls back to
`MOTOROS_LOCAL_ORGANISATION_SLUG`. See `docs/MULTITENANCY.md` before enabling
proxy-host trust or production wildcard DNS.

## Development seed

The seed is development-only and contains:

- 12+ vehicles across ready, reserved, preparation and sold states;
- customers, leads, sourcing requests and candidates;
- repair-call appointments and repair jobs;
- availability, repair services, tasks, notifications and activity.

Use:

```powershell
npm run seed
```

The command refuses to target an unsafe production configuration unless its
explicit seed guard is satisfied. `supabase db reset` also applies
`supabase/seed.sql` to a local Supabase stack.

## Quality checks

```powershell
npm run typecheck
npm run lint
npm test
npm run verify:supabase-security
npm run build
```

Critical browser journeys:

```powershell
npx playwright install chromium
npm run test:e2e
```

The public/demo-safe journeys run without external credentials. Set
`E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` against a seeded Supabase test
project to enable the authenticated stock journey. Never run the destructive
test suite against a live dealership database.

## Application routes

Public:

- `/`, `/cars`, `/cars/[slug]`
- `/source-a-car`
- `/repairs`, `/book-repair-call`
- `/contact`
- `/privacy`, `/cookies`, `/terms`

Dealership admin:

- `/admin` overview
- `/admin/stock`, `/admin/leads`, `/admin/sales`
- `/admin/sourcing`, `/admin/repairs`, `/admin/diary`
- `/admin/customers`, `/admin/tasks`, `/admin/documents`
- `/admin/reports`, `/admin/website`
- `/admin/team`, `/admin/integrations`, `/admin/settings`
- `/admin/audit`, `/admin/health`

Platform operations:

- `/platform` network overview and dealership directory
- `/platform/dealerships/[id]` operational detail and audited controls
- `/onboarding` owner-only dealership creation

## External integrations

The core system works without paid providers:

- Vehicle lookup defaults to explicit mock fixtures and always allows manual
  review/entry.
- Email defaults to a structured console adapter.
- SMS defaults to disabled; notifications remain visible inside DealerOS.
- Auto Trader remains manual/CSV until authorised credentials and endpoint
  permissions are verified.

No Auto Trader pages are scraped. A configured credential set is not displayed
as “connected” until the authorised integration is actually verified.

See:

- `docs/MULTITENANCY.md`
- `docs/PLATFORM_ADMIN.md`
- `docs/DIRECT_MOTORS_ROLLOUT.md`
- `docs/INTEGRATIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/LAUNCH_CHECKLIST.md`

## Production responsibilities

Before launch, the dealership must supply and review:

- branding, contact details and opening hours;
- final vehicle advert data and imagery;
- legal-page wording with appropriate professional advice;
- data-retention periods and privacy request handling;
- DVLA/Auto Trader/provider agreements and permissions;
- email sender configuration, communication consent wording, and a separate
  approved SMS implementation if SMS is required;
- staff accounts, roles and least-privilege reviews.

DealerOS provides technical controls to support UK privacy work. It does not
claim that a dealership is legally compliant merely because those controls or
legal page fields exist.
