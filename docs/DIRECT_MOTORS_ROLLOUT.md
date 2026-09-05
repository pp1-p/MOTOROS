# Direct Motors multi-tenant rollout and rollback

The multi-tenant migration treats every existing organisation as an established
tenant. Existing rows already carry `organisation_id`; Direct Motors retains
its stable UUID, slug, data and URLs. The migration backfills its subdomain from
the slug, marks its existing website published, records onboarding complete and
sets `direct-motors-classic` as both draft and published design.

## Staged rollout

1. Freeze schema changes and take a tested Supabase database backup plus a
   Storage inventory. Record row counts by `organisation_id` for vehicles,
   leads, customers, pages, media metadata, memberships, settings and audits.
2. Restore a production-like copy into staging. Apply all migrations in order
   and run `npm run verify:supabase-security`.
3. Confirm Direct Motors still has the same organisation UUID and counts. Check
   that its slug/subdomain are unique, its MotorOS subdomain domain row exists,
   the site is published and the Classic theme is selected.
4. Seed or create two additional dealerships with different users, stock,
   leads, branding and themes. Prove reciprocal read/write denial through the
   application and direct authenticated Supabase requests.
5. Configure `MOTOROS_BASE_DOMAIN`, wildcard DNS and the trusted-host setting.
   Keep proxy-host trust off unless the edge overwrites forwarded headers.
6. Run typecheck, lint, unit tests, production build and Playwright. Visually
   inspect all four themes at mobile and desktop widths with Direct Motors and
   at least one non-Direct tenant.
7. Deploy the compatible application before enabling new customer hostnames.
   Smoke-test legacy Direct Motors URLs, canonical metadata, stock details and
   enquiry submission.
8. Create the first database-backed platform owner, remove bootstrap email
   access, then onboard additional dealerships gradually while monitoring audit
   and error rates.

## Rollback

The migration is forward-only. Do not drop tenant columns or domain/theme
history in production.

- If application behaviour regresses but the schema is healthy, route traffic
  to the previous compatible deployment. The additive columns and tables can
  remain unused.
- If migration verification fails before traffic is enabled, stop and restore
  the pre-migration backup into a new project or write a reviewed compensating
  migration. Do not edit an applied migration.
- If hostname routing fails, disable the affected custom-domain row and route
  Direct Motors through its known canonical/legacy hostname while DNS is fixed.
- If tenant isolation fails, remove public traffic and staff access immediately;
  preserve audit evidence, rotate exposed credentials and follow the incident
  process. Do not attempt a partial UI-only workaround.

Rollback success means the stable Direct Motors tenant UUID and all pre-rollout
row counts remain intact, its original URLs serve the Classic design, and no
new dealership data is visible to another tenant.

## Production evidence to retain

Retain the backup identifier, migration list, before/after per-tenant counts,
quality-command output, hostname resolution matrix, representative screenshots,
cross-tenant denial results, platform-role review and the person approving the
go-live. Do not retain raw customer or vehicle-sensitive payloads in rollout
notes.
