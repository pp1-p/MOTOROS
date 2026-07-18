# Launch-readiness checklist

## Identity and content

- [ ] Replace the working product name where appropriate
- [ ] Upload final logo and set dealership colours
- [ ] Verify telephone, email, address and opening hours
- [ ] Review every home-page, repair service, FAQ and testimonial
- [ ] Add company and VAT numbers where applicable
- [ ] Obtain review of privacy, cookie, terms and consent wording
- [ ] Confirm cookie preferences and necessary-cookie mode
- [ ] Set `SITE_INDEXABLE=true` only after the identity and legal checks pass

## Stock and sales

- [ ] Verify every registration, VIN, specification and mileage
- [ ] Confirm advertised prices and warranty wording
- [ ] Review third-party-data disclaimer on vehicle details
- [ ] Confirm photography rights and useful alt text
- [ ] Test reservation/sold publication behaviour
- [ ] Verify no public response contains cost, margin or internal notes
- [ ] Confirm finance wording is enquiry/referral only

## People and access

- [ ] Create named accounts—no shared staff logins
- [ ] Apply least-privilege roles and test each one
- [ ] Enable owner MFA and review session duration
- [ ] Remove leavers and all seed/test accounts
- [ ] Nominate data, security and integration owners

## Supabase and security

- [ ] Apply migrations to staging, then production
- [ ] Set `DEALEROS_PUBLIC_ORGANISATION_ID` when more than one organisation exists
- [ ] Verify RLS using anonymous and each staff role
- [ ] Test cross-organisation access denial
- [ ] Test private document signed URLs and expiry
- [ ] Rotate service, provider and webhook secrets
- [ ] Configure backups and perform a restore rehearsal
- [ ] Add distributed rate limiting/WAF controls
- [ ] Complete an independent security review

## Workflows

- [ ] Submit a vehicle enquiry and verify lead/notification
- [ ] Submit a sourcing request and verify pipeline/task ownership
- [ ] Book a repair call and verify timezone/confirmation
- [ ] Race two requests for one slot and verify one is rejected
- [ ] Move/cancel an appointment and inspect the audit record
- [ ] Convert a booking to a repair job and complete its timeline
- [ ] Publish, reserve and sell a stock vehicle
- [ ] Export CSV and verify spreadsheet formula neutralisation

## Providers and operations

- [ ] Verify DVLA key, quota, timeout and manual fallback
- [ ] Verify authorised Auto Trader scopes before enabling sync
- [ ] Confirm webhook signature/replay/idempotency in provider sandbox
- [ ] Verify email domain, delivery and bounce handling
- [ ] Verify SMS sender/templates or leave SMS disabled
- [ ] Configure monitoring, alerting and error triage
- [ ] Set `CRON_SECRET` and verify queued storage cleanup, retry and failure monitoring
- [ ] Configure Supabase SMTP, callback allow-list, invitations and password reset
- [ ] Agree data retention and privacy-request procedures
- [ ] Record rollback, outage and provider-failure procedures

## Quality gate

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e` against staging
- [ ] Desktop, iPad and mobile visual/accessibility review
- [ ] Keyboard-only workflow review
- [ ] Performance/Core Web Vitals review
