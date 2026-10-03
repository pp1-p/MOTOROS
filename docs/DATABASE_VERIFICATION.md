# Database permissions and repair verification

The MOTOR.OS Supabase connection was verified on 3 October 2026. The project
reported healthy in London. Required repair columns, generated line totals,
constraints, tenant-reference guards and timestamp triggers were present.
Existing migrations were installed through SQL Editor, so empty migration
history did not establish which migrations were applied. Do not rerun the
combined initial deployment bundle on an existing database.

## Permission correction

`20261003165914_database_permission_hardening.sql` closes these verified gaps:

- Authenticated users had table-wide reads on repair jobs and items. Assigned
  technicians could query commercial fields even though the app omitted them.
  Column grants now permit the operational fields needed by the technician
  view and guarded update RPC. Commercial reads and item writes use the app's
  existing server client, staff checks and explicit dealership/job filters.
- Browser roles had unnecessary TRUNCATE, REFERENCES and TRIGGER permissions.
  The migration removes these without changing unrelated tables' read/write
  access. Future table defaults for its creator get the same restriction.
- Invoice allocation, sequence seeding and total recomputation helpers lacked
  caller/tenant checks yet were directly executable. They now allow the trusted
  service role. Authorised SECURITY DEFINER invoice workflows still call them
  as their owner. Three internal trigger functions get the same restriction.

The intentional anonymous availability RPC and authorised invoice entry points
remain available. Effective privileges, including inherited grants, are checked
before commit. A five-second lock timeout avoids indefinite waits behind active
work. Later migrations and their creator roles must preserve these restrictions.

## Repeatable database test

After applying the focused migration to an isolated Supabase database, run:

```sh
psql "$MOTOROS_TEST_DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=supabase/tests/database/repair_permissions.sql
```

Supply `MOTOROS_TEST_DATABASE_URL` privately through the shell or a secret manager.
Do not commit it, print it or paste it into chat. PostgreSQL client tools are
required; normal mocked application tests do not need database credentials.

The script creates unique synthetic users, two dealerships, customers, jobs,
items and a draft estimate within one transaction. The final ROLLBACK removes
fixtures, profiles, audit entries and sequence changes. It sends no emails or
provider requests. Failed assertions abort the transaction; use ON_ERROR_STOP
and close the failed session so PostgreSQL rolls it back. Do not commit fixtures.
This is an assertion SQL script for psql/SQL execution, not a pgTAP TAP-format file.

Thirty assertions cover server item creation and generated penny rounding,
duplicate IDs, scoped updates, timestamps, stale edits, tenant-reference guards,
invalid quantities, soft removal, activity, tenant reads, helper restrictions,
draft estimate totals, recorded estimates, technician operational reads and
diagnosis updates, commercial read/write denial, cross-dealership invoice denial,
anonymous access and removal of TRUNCATE privileges.

## Recorded evidence and limits

The proposed migration and test ran together in a rollback-only transaction
against MOTOR.OS: all 30 checks passed. A separate read confirmed no verification
dealerships remained, customer count stayed at two, and job/item counts remained
zero. No existing customer values were read. The preflight also rolled back its
permission changes; deploying the focused migration is a separate step.

This proves PostgreSQL behaviour with the real schema, RLS and roles. It does
not prove authenticated browser save/reload/sign-in journeys or simultaneous
HTTP requests. Run those acceptance journeys in a dedicated test project before
dealership handover. Application unit tests cover the route, validation, scoping
and save recovery; demo browser tests cover layout.

Review remaining intentional SECURITY DEFINER entries, public extensions and
disabled leaked-password protection. Availability is intentionally public. The
counter table with RLS and no policies is server-only; do not add public policies
solely to remove an INFO lint.

References: [column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
[database testing](https://supabase.com/docs/guides/local-development/testing/overview),
[public function advice](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
