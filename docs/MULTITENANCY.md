# MotorOS multi-tenant architecture

MotorOS runs every dealership from one Next.js application and one Supabase
database. `public.organisations.id` is the stable tenant key. Business-facing
identifiers (`slug`, `subdomain` and domain hostnames) are unique, but they are
never accepted as authorisation evidence.

## Tenant resolution

Public requests resolve a dealership on the server in this order:

1. an exact, verified and enabled row in `dealership_domains`;
2. a subdomain beneath `MOTOROS_BASE_DOMAIN`;
3. the explicit `MOTOROS_LOCAL_ORGANISATION_SLUG` fallback on localhost;
4. the legacy `DEALEROS_PUBLIC_ORGANISATION_ID` only where compatibility is
   required.

Hostnames are lower-cased, have a trailing dot removed, reject protocols,
paths, credentials, ports and malformed labels, and are never taken from an
untrusted forwarded header. Set `MOTOROS_TRUST_PROXY_HOST=true` only behind a
proxy that overwrites `X-Forwarded-Host` and `X-Forwarded-Proto`. Unknown,
unverified, unpublished, suspended, cancelled and deleted tenants fail closed.

For local development, use `http://localhost:3000` for the configured fallback
tenant or `http://<subdomain>.localhost:3000` where the browser supports it.

## Isolation model

All operational tables carry `organisation_id`. Authenticated tenant context is
derived from the current Supabase user and an active
`organisation_members` row. A browser-supplied organisation ID is never used to
grant access. Membership helpers also require the organisation lifecycle to be
`trial` or `active`, so suspension immediately removes tenant access.

The isolation layers are:

- PostgreSQL foreign keys, tenant-pair constraints and cross-tenant guard
  triggers;
- row-level security and tenant-aware role/permission helpers;
- server routes that derive tenant identity from the session;
- service-role workflows with narrow validation and explicit organisation
  predicates;
- tenant-prefixed Storage object paths;
- tenant keys on public data, audit, exports, rate limits and integration data.

The service-role key is server-only. Platform APIs use it only after a separate
platform-role check, input validation, same-origin validation and an awaited
audit write. Cross-tenant and unknown-record requests use non-enumerating error
responses.

## Roles

Tenant roles live in `roles` and `organisation_members`: owner, manager,
salesperson, service adviser, technician and website editor. A membership
applies only to its organisation, and one user may hold memberships in several
organisations.

Platform roles are deliberately separate in `platform_user_roles`:

- `owner` can create and operate dealerships;
- `support` can inspect operational summaries but cannot mutate them.

The stable Auth user UUID is authoritative. `PLATFORM_ADMIN_EMAILS` is an
emergency/bootstrap owner fallback, not the normal long-term role store. A
suspended database assignment cannot be bypassed with that email fallback.

## Domains

`dealership_domains` stores MotorOS subdomains and optional custom hostnames.
Custom domains start in `pending`. They can only become `verified` after the
server-side Vercel workflow confirms both domain ownership and a non-misconfigured
DNS/TLS state. Hostname syntax alone is never treated as ownership verification,
and platform operators cannot manually promote a custom domain to `verified`.
Public tenant resolution consumes only verified records with a verification
timestamp.

Custom-domain provisioning uses a server-only Vercel token and the configured
MotorOS project ID. The platform UI can add a hostname after dealership creation,
attach it to the project when missing, show the current ownership challenge and
recommended DNS values, and re-check it during propagation. A pending or
misconfigured hostname continues to fail closed.

Temporary suspension and provider offboarding are separate operations. Disabling
a custom domain makes it immediately unavailable in MotorOS without detaching it
from Vercel. A provider disconnect is allowed only after the domain is already
disabled; it removes the hostname from the MotorOS Vercel project while keeping
the `dealership_domains` row disabled with `verified_at = null` for audit history.
The operation is idempotent if the project domain was already removed. Reuse of
the hostname requires re-enabling it to `pending` and passing the complete
provisioning/verification flow again.

Recommended production DNS:

- an application hostname such as `platform.motoros.example`;
- wildcard `*.motoros.example` routed to the same deployment;
- individually verified customer domains routed to the same deployment;
- `MOTOROS_BASE_DOMAIN=motoros.example`.

## Themes

The shared theme registry is in `src/lib/themes`. All designs consume the same
tenant, inventory, content and enquiry data. The built-in IDs are:

- `direct-motors-classic`
- `modern-marketplace`
- `prestige`
- `performance`

`dealership_settings.draft_theme_id` is the protected preview selection;
`published_theme_id` is the live selection. Publishing records an immutable
snapshot in `website_theme_publications`. Switching theme does not copy or
delete vehicles, leads, media or pages.

To add a design:

1. add its stable ID and metadata to the registry;
2. implement every registry render surface and responsive state;
3. add the ID to the database theme checks in a forward migration;
4. add preview, publish, accessibility and tenant-data regression tests;
5. verify desktop and mobile screenshots before release.

Do not fork the application or duplicate dealership data for a design.

## New dealership lifecycle

The owner-only `/onboarding` wizard collects identity, unique routing labels,
contact/brand settings, a starting design, optional custom domain and an owner
email. Creation is compensating: if settings, domains or the mandatory creation
audit fail, the incomplete organisation is removed. A requested custom domain
remains pending. Owner invitation delivery failures are reported without
discarding an otherwise valid dealership.

The dealership then uses its normal `/admin` area for branding uploads,
inventory import/entry, content review and website publication. Platform owners
can monitor progress, plan/lifecycle, domain and theme status in `/platform`.

## Data and cache rules

Any new tenant-owned table, query, cache, search document, export, job or object
path must include `organisation_id`. Cache keys must include both organisation
ID and the relevant record/query identifier. Jobs must re-check tenant
lifecycle and permissions at execution time rather than trusting enqueue-time
browser data.
