# Known limitations

These are deliberate, visible boundaries rather than fabricated integrations.

- A Supabase project is required for durable production writes. Development
  demo mode is process memory only.
- Auto Trader stock sync is sandbox-only and remains unverified until
  account-specific credentials and capabilities pass the read-only check.
  Images require the separate Images API flow, and automated scheduling is
  deliberately disabled in favour of an operator-reviewed preview.
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
- Auto Trader deal workflows are not included; the integration covers stock
  baseline, updates, availability, pricing and signed Stock Notifications.
- Included legal-page copy is a code template and requires dealership-specific
  editing and professional review.
- Advanced accounting, card payments, finance proposals, parts procurement,
  technician clocking and DMS migration are outside the first release.
- Multi-dealership isolation and platform summaries are included, but cross-site
  group accounting and consolidated billing are not. Plan codes are metadata.
- Custom-domain ownership, DNS and certificate checks are operational launch
  steps; MotorOS records pending/verified/failed/disabled state but does not
  automate DNS-provider challenges in this release.
- Platform onboarding creates the tenant, routing, contact/brand settings,
  design and owner invitation. Logo upload, inventory import/entry, content
  review and final website publication use the existing dealership admin after
  creation rather than being embedded in the platform wizard.
- Browser E2E tests that mutate Supabase require a dedicated seeded test project
  and credentials.
- Labour and parts rows on repair jobs are currently live but read-only in the
  admin UI; dedicated item add/edit/delete operations are not included.
- Website editing covers dealership branding, theme selection/preview/publication
  and the homepage. Legal, FAQ, testimonial and opening-hours editing screens
  are not included.
- The monthly-budget control on inventory is intentionally disabled until a
  regulated finance/referral calculator is selected and approved.
- Error-monitoring instrumentation such as Sentry is not bundled. Configure an
  approved monitoring service as a separate launch task.
- The SQL migrations were statically reviewed and the application build/tests
  run locally, but migrations and authenticated journeys must still be applied
  and verified against a dedicated staging Supabase project before launch.
