# Known limitations

These are deliberate, visible boundaries rather than fabricated integrations.

- A Supabase project is required for durable production writes. Development
  demo mode is process memory only.
- Auto Trader Connect cannot be declared connected until account-specific
  credentials, scopes, endpoints and signature conventions are supplied.
- DVLA VES does not provide exact model/trim/equipment/valuation.
- Finance is an enquiry/referral only. DealerOS implements no lending,
  underwriting, approval or credit-broking logic.
- Repair booking reserves a discussion call, not workshop capacity.
- Email console mode relies on in-app notifications.
- No SMS delivery adapter is included; selecting SMS as a contact preference
  records the preference but does not send a message.
- The included rate limiter is per application process; use a distributed
  limiter/WAF for multi-instance production.
- Images are validated and delivered through Next/Supabase optimisation, but a
  dedicated ingestion worker for aggressive resizing/virus scanning can be
  added for high-volume dealerships.
- Full Auto Trader stock/deal synchronisation requires the authorised API
  contract and provider sandbox.
- Included legal-page copy is a code template and requires dealership-specific
  editing and professional review.
- Advanced accounting, card payments, finance proposals, parts procurement,
  technician clocking and DMS migration are outside the first release.
- Multi-dealership ownership is represented in the schema/RLS, but cross-site
  group reporting and consolidated billing are not included.
- Browser E2E tests that mutate Supabase require a dedicated seeded test project
  and credentials.
- Labour and parts rows on repair jobs are currently live but read-only in the
  admin UI; dedicated item add/edit/delete operations are not included.
- Website editing currently covers dealership branding and the homepage. Legal,
  FAQ, testimonial and opening-hours editing screens are not included.
- The monthly-budget control on inventory is intentionally disabled until a
  regulated finance/referral calculator is selected and approved.
- Error-monitoring instrumentation such as Sentry is not bundled. Configure an
  approved monitoring service as a separate launch task.
- The SQL migrations were statically reviewed and the application build/tests
  run locally, but migrations and authenticated journeys must still be applied
  and verified against a dedicated staging Supabase project before launch.
