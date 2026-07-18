# Security assumptions and controls

## Trust boundaries

- Browser code receives only the Supabase anonymous key.
- The service-role key exists only in server route handlers.
- Public forms never receive arbitrary table read access.
- Staff requests require a valid Supabase session and a server-side role check.
  Reads use RLS/safe staff views; mutations use validated server routes and
  narrow service-role RPCs.
- Organisation ID is derived from the authenticated membership, not accepted
  from an untrusted form.

## Implemented controls

- strict Zod validation on public, stock, booking and integration inputs;
- same-origin checks on browser mutations;
- short-window request and lookup rate limits;
- honeypot fields on public submissions;
- normalised customer matching;
- database constraints plus transaction-safe booking RPC;
- server-side role/permission matrix;
- RLS on organisation-owned tables and public-safe vehicle projection;
- authenticated sessions are read-only on operational base tables; stock and
  sales views omit cost, margin and internal commercial columns;
- MIME, size and binary-signature image validation;
- private-document bucket and signed-download design;
- webhook HMAC, timestamp replay window and unique event ID;
- structured logs with sensitive-field redaction;
- audit rows/triggers for sensitive changes;
- CSP and common hardening response headers;
- environment validation and no browser service keys.

## Required production additions

The in-process rate limiter limits accidental/low-volume abuse but is not a
distributed bot-control service. Production should add a shared limit store or
edge/WAF rate limiting. Keep the database’s transactional booking constraint as
the definitive concurrency control.

Before launch:

- enable MFA for owners where supported;
- review Supabase Auth password/session settings;
- restrict staff onboarding to owner-managed flows;
- rotate all secrets created during development;
- enable platform logs/alerts without recording customer content;
- configure backup, recovery and incident contacts;
- penetration-test public forms, storage policies, RLS and webhook endpoints;
- review CSP after adding analytics or a finance-referral provider.

## Deferred view hardening

Twelve API-facing views currently rely on PostgreSQL's owner-rights view
behaviour. They have been reviewed as narrow projections, but they must not be
changed mechanically to `security_invoker = true`: `anon` and `authenticated`
do not have the required base-table privileges, and granting those privileges
would expose the base tables through the Data API.

The public group is `public_dealerships`, `public_safe_vehicles`,
`public_vehicle_images`, `public_vehicle_features`, `public_repair_services`,
`public_website_pages`, `public_vehicle_inventory` and
`public_appointment_types`. Move their consumers behind a server-only safe-data
layer first; then revoke direct `anon`/`authenticated` view access and either
set the views to security-invoker mode for the trusted server role or replace
them with tightly scoped public RPCs.

The staff group is `vehicle_presentation_records`,
`technician_repair_jobs`, `staff_vehicle_records` and `staff_sales_records`.
Replace these with authenticated, role-checking set-returning RPCs (or a tested
RLS/column-privilege design) before enabling security-invoker mode. Preserve the
existing columns and organisation/role predicates during a staged cutover, and
cover every staff role plus cross-organisation denial in integration tests.

This redesign is intentionally deferred from migration 0007 because changing
the view option alone would cause a production read outage. Treat it as a
multi-tenant launch gate, not as permission to broaden base-table grants.

## Privacy preparation

The schema records consent source/time, marketing preference, audit history and
retention settings, and supports export/anonymisation workflows. Final lawful
bases, retention periods, processor agreements, legal wording and operational
response procedures require dealership/legal review.

Internal repair notes, cost/profit fields, staff records and private documents
must never be included in customer-facing queries or communications.

## Reporting a vulnerability

Do not include customer data, credentials or full registrations in a ticket.
Provide the route, role, expected boundary and minimal reproduction to the
dealership’s designated security contact.
