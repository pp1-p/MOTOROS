# Dealership handover review — 2 October 2026

The handover fixes are on `agent/dealership-handover-recovery`, reviewed through
[PR #44](https://github.com/pp1-p/MOTOROS/pull/44). This is a code and isolated-demo
verification pass. It is not approval to launch the dealership or confirmation
that the production database and external providers are working.

## Fixed behaviour

- Customer creation redirects to the customer list only after a confirmed save.
  Administrative forms prevent concurrent submissions, keep entered values and
  focus an error summary with links to invalid fields.
- Vehicle creation requires the returned record ID. An uncertain save blocks a
  second create and tells staff to check stock. A failed photo upload can be
  retried against the same existing vehicle, without creating another car.
- Public enquiries, sourcing, part-exchange, finance and repair-call forms retain
  entries, expose accessible validation errors and use bounded requests. Lost
  responses never cause an automatic write retry or a claim that nothing saved.
  Controls stay disabled until their handlers are ready, preventing early input
  resets and native GET submissions that would put contact data into a URL.
- Invoice email requires configured Resend delivery. Console mode cannot claim
  to have emailed an invoice. Provider acceptance, status-save failure and
  audit-save failure are distinct outcomes; staff are told to check delivery
  before resending when acceptance is uncertain. A concurrent paid-status change
  cannot be overwritten with sent status. Activity details omit recipient email.
- Booking availability fails closed when rules, exceptions or bookings cannot be
  read. Demo availability excludes slots already booked in that process.
  Rate-limit responses include a retry hint.
- General and repair invoice previews follow the existing database's two-decimal
  storage and per-line net/VAT rounding. Notes have zero price and VAT; discounts
  have zero VAT. Charged repair lines require positive quantities. No historical
  invoice data, VAT policy or database schema is changed.
- Stock creation pages require stock-management permission; read-only stock
  views hide creation actions. Managers can reach their existing website-editing
  permission. The team access summary derives from the real permission matrix.
- Mobile public navigation uses the project's Radix dialog primitive for focus
  trapping, Escape, background scroll locking and focus return. Narrow stock
  tables, invoice forms, team tables and long page headings remain contained.
  Phone filters use separate rows so their labels stay readable. Error summaries
  scroll below sticky headers when focused.
- Route-error logging records the digest without copying raw error messages.

The user-requested [UI UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
informed the keyboard, error-summary, responsive containment, touch-target and
reduced-motion review. The existing MOTOR.OS components and visual system were
extended; no application dependency or remote installer was added.

## Automated evidence

The final unit and browser results below come from isolated local verification.
The source contains repeatable tests rather than a claim that demo data persists.

- Unit suite: 216 tests across 38 files passed, including 13 invoice-email route
  tests, seven availability tests, five submission-helper tests, four rounding
  tests, four administrative form tests and two additional permission/UI regression tests.
- ESLint, TypeScript and `git diff --check` passed on the final code tree.
- Supabase static security/parity checks verified all 26 existing migrations,
  technician guards, RPC ACL declarations and customer-audit redaction.
- Browser suite: **83 passed, one skipped** in one clean 84-test run (six minutes).
  The skipped check is authenticated Supabase sign-in/lookup, which requires
  credentials for a dedicated test project. The run had no development-cache
  recovery errors. Six focused browser checks also passed after the final
  sticky-header/error-summary and phone-filter polish, including an explicit
  assertion that the focused error summary is fully visible below the header.
- Production build passed with the existing offline Google-font mock, including
  TypeScript and generation of all 72 static pages. An initial Turbopack
  persistence-cache panic was resolved by moving only the generated production
  cache aside and rerunning the same build command; no source workaround or
  production font change was needed.
- Visual review inspected contact errors and stock at phone/desktop widths,
  with no page runtime errors in those captures. It uses the offline font mock.
- Vercel preview deployment passed for code commit
  `217aacf62e7287313a090638ad068fdbe603765d`. This is a deployment check, not a
  persisted production acceptance test.

Browser coverage includes 52 public/admin routes, phone and desktop containment,
stock layouts at tablet width, accessible dialogs, public form submissions,
customer save/error recovery, uncertain vehicle save, photo retry, vehicle
workspace sections, duplicate booking rejection and all four website previews.
The default suite explicitly clears live provider/database configuration. It
uses process-memory demo writes and mocked admin writes, not production records.
It cannot establish RLS isolation, persistent writes, email delivery, API
entitlements or real-device Safari behaviour.

## Acceptance work required before the dealership receives access

The connected Supabase account does not expose MOTOR.OS, and the connected
Vercel account exposes no accessible teams. No production database migration,
provider write, email, invitation or dealership record was changed in this pass.
Complete these steps in an isolated MOTOR.OS staging project first:

1. Apply the repository's existing migrations and verify migration parity. This
   PR introduces no new SQL migration. Confirm backups and rehearse restoring a
   staging backup; name a person responsible for rollback.
2. Create two test dealerships and separate owner, manager, salesperson, service
   advisor, technician and website-editor accounts. Test reciprocal cross-tenant
   read and mutation denial through the API and database, not just hidden links.
   Verify platform-owner access independently from dealership-owner access.
3. Add a test customer and vehicle; refresh, sign out and sign in to confirm they
   persisted. Upload/reorder/remove photos and verify the public cover. Exercise
   provider/manual lookup fallback without inventing missing specifications.
4. Publish a test vehicle, submit an enquiry, reserve it and mark it sold. Check
   public listing visibility and the audit trail after each transition. Verify
   costs, internal notes, customer data and margins are never public.
5. Raise general, repair and vehicle-sale invoices; check both directions of the
   vehicle link, printed totals, per-line VAT, credit notes and recorded payment.
   Confirm account-specific VAT treatment with the dealership's accountant.
6. Configure verified email delivery securely. Send one explicitly approved test
   invoice to a controlled mailbox, verify receipt and inspect sent/paid status
   and audit records. Exercise provider failure without automatically resending.
7. Submit contact, sourcing, part-exchange, finance enquiry and repair-call forms.
   Confirm saved leads/tasks/diary notifications in the correct dealership. Race
   two bookings for one slot and check cancellation/rescheduling, time-zone and
   daylight-saving transitions. A repair call is not workshop-capacity booking.
8. Verify Auto Trader sandbox authentication and read access non-destructively.
   Resolve advertiser/service entitlement errors with Auto Trader. Review the
   exact stock preview and obtain approval for named sandbox records before any
   create/update/publish/withdraw/delete operation. Production Auto Trader access
   is not enabled by this PR.
9. Verify invitation, password reset, session expiry, staff suspension and owner
   MFA. Check private document signed-URL expiry and leaver access removal.
10. Configure and review real dealership contact details, domain/DNS, branding,
    opening hours, finance/referral wording, legal pages and privacy/cookie copy.
    Verify necessary-only cookie consent and mobile/iPad/Safari/keyboard access.
11. Check monitoring, alert ownership, provider quotas, distributed rate limiting,
    retention and incident procedures. Obtain dealership acceptance, then review
    and merge the PR, deploy and repeat the key read-only production checks.

## Visible limits to communicate to the dealership

See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). Repair job labour/parts are
read-only; their item CRUD interface remains outside this pass. Finance forms
collect an enquiry, not a finance application or approval. SMS delivery and
external social publishing require their own adapters and provider setup.
Auto Trader remains sandbox-only and account-specific read permission must be
verified. Legal/FAQ/testimonial/opening-hours editing screens are not included.
Demo mode is non-production process memory, and automated demo tests must never
be treated as evidence of durable production writes.

## Running the checks

Use Node 22 or newer and `npm ci`, then:

```sh
npm test
npm run lint
npm run typecheck
npm run verify:supabase-security
npx playwright install chromium
npm run test:e2e
npm run build
```

If the environment cannot fetch Google fonts, the existing build-only mock is:

```sh
NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/tests/e2e/next-font-mocks.cjs" npm run build
```

It validates compilation and routing; it does not validate production font
rendering. Do not change production font configuration to use this mock.
Authenticated test credentials belong in protected shell/deployment environment
variables, never tracked files. See the README for the isolated Supabase opt-in.

## Changed files

The PR diff is the authoritative file inventory. Changes cover:

- Admin customer, stock-creation and team pages; invoice-email and availability
  routes; global error handling, layout and responsive CSS.
- Shared administrative forms, vehicle review/workspace, stock tables, invoice
  forms/email control, role navigation and public mobile header.
- All six public enquiry/booking forms, their validation/error summary helpers,
  availability/configuration validation and invoice preview calculation.
- Unit/component tests, isolated Playwright configuration and browser regression
  tests; README, design evidence, limitations and launch/handover instructions.

Exact changed paths (55 files):

```text
README.md
docs/ADMIN_DESIGN.md
docs/DEALERSHIP_HANDOVER.md
docs/KNOWN_LIMITATIONS.md
docs/LAUNCH_CHECKLIST.md
playwright.config.ts
src/app/admin/admin.css
src/app/admin/customers/new/page.tsx
src/app/admin/stock/new/page.tsx
src/app/admin/stock/new/review/page.tsx
src/app/admin/stock/page.tsx
src/app/admin/team/page.tsx
src/app/api/admin/invoices/[id]/email/route.test.ts
src/app/api/admin/invoices/[id]/email/route.ts
src/app/api/availability/route.ts
src/app/error.tsx
src/app/globals.css
src/app/layout.tsx
src/components/admin/admin-design.test.tsx
src/components/admin/admin-shell.tsx
src/components/admin/async-form.test.tsx
src/components/admin/async-form.tsx
src/components/admin/general-invoice-form.tsx
src/components/admin/invoice-email-button.tsx
src/components/admin/record-sale-form.tsx
src/components/admin/repair-invoice-form.tsx
src/components/admin/stock-table.tsx
src/components/admin/vehicle-review-form.tsx
src/components/admin/vehicle-sale-invoice-form.tsx
src/components/admin/vehicle-workspace.tsx
src/components/forms/contact-form.tsx
src/components/forms/finance-enquiry-form.tsx
src/components/forms/form-error-summary.tsx
src/components/forms/form-field.tsx
src/components/forms/form-submit.test.ts
src/components/forms/form-submit.ts
src/components/forms/part-exchange-form.tsx
src/components/forms/repair-booking-form.tsx
src/components/forms/source-car-form.tsx
src/components/forms/vehicle-enquiry-form.tsx
src/components/public/public-header.tsx
src/components/public/themes/theme-chrome.tsx
src/components/public/vehicle-gallery.tsx
src/lib/availability.test.ts
src/lib/availability.ts
src/lib/env.test.ts
src/lib/env.ts
src/lib/invoices/totals.test.ts
src/lib/invoices/totals.ts
src/lib/use-hydrated.ts
tests/e2e/admin-design.spec.ts
tests/e2e/critical-workflows.spec.ts
tests/e2e/handover.spec.ts
tests/e2e/public-smoke.spec.ts
tests/e2e/theme-previews.spec.ts
```

No application package or lockfile change, production configuration change or
new SQL migration is required. Publishing preserves the original GitHub history
and existing image assets; the recovered local snapshot is not a replacement
for the repository's main branch.
