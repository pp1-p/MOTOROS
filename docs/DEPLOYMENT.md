# Supabase and Vercel deployment

## 1. Create separate environments

Use separate Supabase projects for development/staging and production. Never
seed the production database with development data.

## 2. Apply database migrations

Link the CLI and review the target project before pushing:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push
```

Verify every migration in staging first. RLS must remain enabled on all
organisation-owned tables.

If the project was originally created by pasting
`supabase/deploy/combined_migrations.sql` into the SQL Editor, stop before
`supabase db push`: the database objects may exist while the CLI migration
history is empty. First compare the live schema with migrations
`202607160001` through `202607160006`, then mark each confirmed version as
applied, for example:

```powershell
supabase migration repair 202607160001 --status applied
supabase migration repair 202607160002 --status applied
supabase migration repair 202607160003 --status applied
supabase migration repair 202607160004 --status applied
supabase migration repair 202607160005 --status applied
supabase migration repair 202607160006 --status applied
supabase migration list
```

Only after that history matches should `supabase db push` apply
`202607180001_security_hardening.sql` and
`202607180002_technician_status_guard.sql`, in that order. If either migration
was already run manually, verify its ACL and function changes, then repair that
specific version as applied instead of running it twice.

## 3. Create the first owner

Create the user through Supabase Authentication, then follow the bootstrap
procedure in `docs/DATABASE.md`. Do not create Auth passwords through ad-hoc SQL
or store passwords in the repository.

## 4. Configure Storage

The migrations create:

- public `vehicle-public`, with writes restricted to the validated server upload route;
- public `branding-public`, with writes restricted to the validated logo route;
- private `private-documents` for repair/customer documents and booking photos;
- private `repair-uploads`, reserved for a future dedicated repair-media flow.

Test upload, signed download, deletion and cross-organisation denial in staging.

## 5. Create the Vercel project

Import the `dealeros` directory as the Vercel project root. The framework preset
is Next.js. Use:

- install: `npm install`
- build: `npm run build`
- output: Next.js default

Add all required environment variables for Preview and Production separately.
`SUPABASE_SERVICE_ROLE_KEY`, provider secrets and webhook secrets must be
server-only—never prefix them with `NEXT_PUBLIC_`.

Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS URL and add that URL to
Supabase Auth redirect allow-lists.

Keep `SITE_INDEXABLE=false` until the contact details and professionally reviewed
legal wording are complete. Set it to `true` only at launch; this enables search
indexing and publishes the sitemap while continuing to block admin and API routes.

## 6. Webhooks and scheduled work

Point authorised Auto Trader webhooks to:

`https://YOUR_DOMAIN/api/webhooks/autotrader`

Configure its secret only after confirming the provider’s signing convention.
Do not expose a webhook endpoint without a replay test and duplicate event test.

`vercel.json` schedules `/api/cron/storage-cleanup` daily at 03:17 (Vercel
Hobby rejects sub-daily schedules; increase the cadence on paid plans if
image-deletion volume warrants it). Set a strong
`CRON_SECRET`; the endpoint returns 503 without it. In staging, delete a vehicle
image, confirm a `storage_cleanup_jobs` row is queued, invoke the cron with the
secret, and verify completion/retry behaviour. Monitor failed or repeatedly
retried cleanup rows. Any future reminder/retention jobs must use the same
authenticated-scheduler pattern.

## 7. Configure Auth email flows

Configure Supabase SMTP and review the invitation and password-reset templates.
Allow the canonical HTTPS application URL and `/auth/callback` in Supabase Auth
redirect settings. Test invite, acceptance, expired invitation, reset request,
reset callback and password update in staging.

## 8. Post-deploy verification

Run against staging:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Then manually verify:

1. Owner sign-in and sign-out.
2. Each staff role sees only its authorised navigation and data.
3. RLS blocks direct unauthorised Supabase queries.
4. Vehicle lookup failure leaves manual entry available.
5. A reviewed stock record can accept/reorder images and publish.
6. The public projection contains no cost/profit/internal fields.
7. Enquiry, sourcing and booking records appear in DealerOS.
8. Two concurrent requests cannot take a capacity-one booking slot.
9. Private documents require signed URLs.
10. Audit records exist for price, status, booking, repair and role changes.
11. Anonymous and authenticated roles cannot execute server-only RPCs.
12. Customer audit JSON contains only the approved metadata allow-list.

## Rollback

Database migrations are forward-only in production. Take a Supabase backup
before schema changes and write a reviewed compensating migration if rollback
is required. Roll back application code through a prior Vercel deployment only
when it remains compatible with the current schema.
