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

For a shared MotorOS deployment also set:

- `MOTOROS_BASE_DOMAIN` to the parent used for dealership subdomains, without a
  protocol or path;
- `MOTOROS_LOCAL_ORGANISATION_SLUG` only for the explicit localhost fallback;
- `MOTOROS_TRUST_PROXY_HOST=false` unless the deployed edge overwrites forwarded
  host/protocol headers;
- `PLATFORM_ADMIN_EMAILS` only during controlled bootstrap, then remove it after
  assigning `platform_user_roles` by Auth UUID;
- `MOTOROS_VERCEL_API_TOKEN` to a server-only token permitted to manage domains
  on the MotorOS Vercel project;
- `MOTOROS_VERCEL_PROJECT_ID` to the production MotorOS project ID or project name;
- `MOTOROS_VERCEL_TEAM_ID` when that project belongs to a Vercel team.

Route the MotorOS base domain and its wildcard to the application so every
created dealership can receive its MotorOS subdomain without a separate deploy.
Do not expose the Vercel token to client code.

### Dealer custom-domain go-live

Custom dealership hostnames use the platform-admin domain workflow rather than
manual database promotion:

1. In `/platform`, open the dealership and add its hostname. The database row is
   created as `pending` and is not public yet.
2. Select **Provision / check DNS**. MotorOS checks whether the hostname is
   already attached to the configured Vercel project and adds it only when
   missing.
3. MotorOS asks Vercel to verify the ownership challenge and reads Vercel's
   current DNS/TLS configuration. Any TXT ownership challenge and recommended A
   or CNAME values are returned to the platform UI for the operator to copy to
   the dealer's DNS provider.
4. Repeat the check after DNS propagates. MotorOS changes the database domain to
   `verified` only when Vercel reports both ownership verification and a
   non-misconfigured DNS/TLS state.
5. Public hostname resolution continues to fail closed for pending, failed or
   disabled custom domains.

If both `dealership.co.uk` and `www.dealership.co.uk` should resolve directly,
add and verify both hostnames. Keep the dealership as the owner of its domain;
MotorOS only needs DNS records pointed at the shared Vercel project.

Never mark a custom domain `verified` by editing the database or using a manual
status control. A syntactically valid hostname is not proof of ownership. See
`docs/MULTITENANCY.md` and `docs/PLATFORM_ADMIN.md`.

### Dealer custom-domain offboarding

Disconnecting a customer hostname is deliberately separate from temporarily
disabling it:

1. Disable the custom domain in `/platform`. Tenant resolution immediately fails
   closed for that hostname while the dealership's stock, leads and content stay
   untouched.
2. Once the domain is disabled, use **Disconnect from Vercel** and provide an
   audit reason. MotorOS removes the hostname from the configured Vercel project
   only; it does not delete the dealership's domain registration or account-level
   domain ownership.
3. The `dealership_domains` row remains present with `status = disabled` and
   `verified_at = null` so the audit trail and original tenant association remain
   explicit.
4. A repeated disconnect is safe if another operator already removed the
   hostname from the project.
5. To use the hostname again, re-enable it to `pending`, then run
   **Provision / check DNS** and complete verification again before it can become
   public.

Do not disconnect a still-live hostname as a shortcut. The API rejects provider
detach until the MotorOS domain is already disabled.

Keep `SITE_INDEXABLE=false` until the contact details and professionally reviewed
legal wording are complete. Set it to `true` only at launch; this enables search
indexing and publishes the sitemap while continuing to block admin and API routes.

## 6. Webhooks and scheduled work

Point authorised Auto Trader webhooks to:

`https://YOUR_DOMAIN/api/webhooks/autotrader`

Configure `AUTOTRADER_WEBHOOK_SECRET` from the sandbox notification setup. The
endpoint accepts the documented HTTPS `PUT` request and
`AutoTrader-Signature: t=...,v1=...` header. Do not expose it without the replay,
duplicate-delivery and out-of-order tests described in `docs/INTEGRATIONS.md`.

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
npm run verify:supabase-security
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
13. Direct Motors and two test dealerships resolve through distinct hosts.
14. Reciprocal cross-tenant reads and mutations are denied.
15. Platform owner can operate `/platform`, support is read-only, and a normal
    dealership user receives no platform access.
16. All four themes preview and publish without changing tenant stock or leads.
17. A test custom domain remains non-public while pending, displays the provider
    DNS/ownership instructions, becomes verified only after the provider passes,
    and resolves to the correct dealership after TLS is ready.
18. A verified custom domain can be disabled without exposing another tenant or
    changing dealership stock, leads or website content.
19. A disabled custom domain can be disconnected from the Vercel project, stays
    disabled in MotorOS with `verified_at = null`, and can only return to service
    through the normal pending/provision/verify flow.

## Rollback

Database migrations are forward-only in production. Take a Supabase backup
before schema changes and write a reviewed compensating migration if rollback
is required. Roll back application code through a prior Vercel deployment only
when it remains compatible with the current schema.
