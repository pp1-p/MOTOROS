# Repair job labour and parts

Open **Workshop → a repair job → Labour & parts**. Owners, managers and service
advisors with the existing `repairs:manage` permission can:

1. Choose **Add labour or part**, enter a description, quantity or hours, selling
   rate excluding VAT and recorded VAT rate. Parts can also have a supplier and
   part number. Enter a reason and save.
2. Use the row's **Edit** action to change its details or planned/ordered/received/
   in-progress/completed status. Another staff member's intervening edit causes a
   conflict instead of silently overwriting their work; reload and review it.
3. Use **Remove**, enter a reason, then explicitly confirm. This soft-removes the
   row from future invoice creation and the current job, preserving its history.

Technicians keep their existing operational view without prices, VAT totals or
item-management actions. Demo jobs are read-only. Collected or cancelled jobs
must be reopened by staff with repair-management permission before item changes.
Fee, inspection, discount, note and legacy cancelled items remain read-only in
this editor. No roles or database policies are broadened.

## Totals and invoices

Item net and VAT totals use the same per-line penny rounding as invoice previews
and display two decimal places. They are labelled separately from **Recorded
estimate**, which remains the value saved in Job details. A change to the work
list does not implicitly change the amount agreed with the customer.

New repair invoices and estimates use the existing database workflow to copy
current, non-deleted items. Existing invoices keep their saved lines. Review the
new invoice and its VAT treatment before sending it: the displayed item VAT is
at recorded rates, while the invoice has its own VAT treatment. This editor does
not change VAT policy, previous payments, approval state or existing invoices.

## Save recovery and activity

The form blocks concurrent submissions and uses a 20-second timeout. A new row
gets a stable random UUID when the form opens. The server's primary-key check
recognises an identical repeated create without inserting another row; it never
upserts into a different job, reuses another dealership's row or revives a
removed record. Payloads cannot supply organisation IDs or generated line totals.

If the response is lost, unconfirmed, or conflicts with a newer version, the UI
blocks further item changes and offers **Reload job**. Check the current rows
after reloading before adding anything again. Writes are not automatically retried.
Recoverable validation errors keep entered values and link to the affected fields.

Each confirmed mutation records the internal item ID, operation, actor and reason
in the job's activity timeline. The row mutation and application activity insert
are separate operations, following the existing schema. If activity recording
fails after a confirmed save, the form reports that the item saved, warns that
activity was not recorded and tells staff not to repeat it. There is no claim of
transactional row-plus-audit persistence. Parent job status is checked before
the write; changing it concurrently is not locked together with the item write.

## Deployment and verification

This feature uses existing `repair_job_items` columns and `updated_at` triggers;
**no new SQL migration or application dependency is required**. Updates and
removals match the loaded timestamp to reject stale versions. Reads and writes
are explicitly scoped to the signed-in staff member's dealership and parent job.

Automated route tests mock the database to exercise authentication, role checks,
tenant/job scoping, soft deletion, duplicate IDs, stale changes, validation and
database/audit failures. DOM tests cover add/edit/remove requests, validation,
pending-write guards, uncertain results, dialog focus and hidden commercial data.
Browser tests check the read-only demo at phone, tablet and desktop widths.

Verification on this change: 270 unit tests across 41 files passed (54 new route,
validation and DOM tests), four targeted browser checks passed, ESLint and
TypeScript passed, the 26-migration security/parity check passed, and the
production build passed with the repository's existing offline Google-font mock.
Screenshots of the repair items at phone and desktop widths were reviewed; the
browser check covers 390, 768 and 1440 pixels with no page runtime errors.

The follow-up [database verification](DATABASE_VERIFICATION.md) passed 30
rollback-only checks against MOTOR.OS's real schema, covering item changes,
tenant/technician isolation and draft estimate creation. No test fixtures remain.
This does not verify an authenticated browser's complete save journey.
Before dealership acceptance, use an isolated project to add,
edit and remove a test row; reload and sign in again, race two staff edits, verify
the job activity and create an estimate from the remaining rows. Verify that
another dealership and an assigned technician cannot change item pricing.
No production repair record, invoice or provider message was changed during
implementation.
