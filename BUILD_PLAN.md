# DealerOS build plan

This checklist records the delivered local build. External provider and
environment verification remains in `docs/LAUNCH_CHECKLIST.md`.

## Phase 1 — foundation

- [x] Strict Next.js App Router application with Tailwind CSS
- [x] Supabase browser/server clients and authenticated session refresh
- [x] Multi-dealership schema, roles, RLS, storage and audit controls
- [x] Responsive public and DealerOS application shells

## Phase 2 — stock and public showroom

- [x] Safe public vehicle projection and live stock data access
- [x] Registration lookup abstraction with mock, DVLA and manual paths
- [x] Transactional stock create/edit/publish and image management
- [x] Inventory filters, vehicle detail and enquiry journey

## Phase 3 — customers, leads and sourcing

- [x] Customer matching, scoped access, creation, editing and export
- [x] Live lead table/Kanban, notes, stage changes and activity
- [x] Public sourcing request and admin sourcing pipeline
- [x] Live tasks, global search and per-user notification read state

## Phase 4 — repairs and diary

- [x] Configurable public call availability and safe slot discovery
- [x] Transaction-safe booking with duplicate-slot protection
- [x] Live diary management and appointment actions
- [x] Transactional booking-to-repair conversion and repair timeline
- [ ] Repair labour/parts item mutation UI (live rows are read-only)

## Phase 5 — integrations

- [x] Auto Trader adapter boundary, signed/idempotent webhook and manual fallback
- [x] Vehicle/customer/operational exports with formula neutralisation
- [x] Console/Resend email and reliable in-app notification fallback
- [ ] SMS delivery adapter, templates and delivery-status handling
- [ ] Live DVLA/Auto Trader/Resend contract verification (deployment-specific)

## Phase 6 — hardening and handover

- [x] Live reports, settings, website publishing, audit and health surfaces
- [x] Unit tests and public desktop/mobile Playwright journeys
- [x] Typecheck, lint, unit suite, production build and public browser smoke
- [x] Deployment, provider, security and launch-readiness documentation
- [ ] Authenticated Playwright journey against a seeded staging Supabase project
- [ ] Apply and exercise all migrations against staging Postgres/Supabase

## Phase 7 — MotorOS multi-tenancy and themes

- [x] Stable tenant identity, lifecycle, plan, subdomain and website status
- [x] Verified-domain resolver with safe localhost fallback and host validation
- [x] Lifecycle-aware membership helpers, RLS and tenant-scoped public views
- [x] Direct Motors backfill as the first normal tenant
- [x] Shared four-design registry, protected previews and publication history
- [x] Owner-only dealership onboarding with optional owner invitation
- [x] Searchable/filterable/sortable platform directory and operational detail
- [x] Database-backed platform owner/support roles and audited platform actions
- [x] Targeted tenant, hostname, platform-role, onboarding and theme unit tests
- [x] Architecture, platform operation, domain and rollout/rollback documentation
- [ ] Exercise migrations and reciprocal tenant-denial tests against staging
- [ ] Verify wildcard/custom-domain DNS and certificates in the target platform
- [ ] Complete authenticated and four-theme visual/accessibility staging review
