# One-shot hosted setup helpers

Helpers for deploying DealerOS to a fresh Supabase project from the dashboard,
without installing the Supabase CLI. The CLI flow in `docs/DEPLOYMENT.md`
remains the recommended path for teams that use it.

Run in the Supabase SQL Editor, in this order:

1. `combined_migrations.sql` — all migrations from `supabase/migrations/`
   (0001–0008) concatenated in order. Run once on an empty project. If new
   migration files are added to the repository later, apply those individually;
   do not re-run this file.
2. `first_owner_setup.sql` — after creating your first user in
   Authentication → Users, edit the three values at the top and run once. It
   creates the organisation, dealership settings and the active owner
   membership, then returns the organisation ID needed for the
   `DEALEROS_PUBLIC_ORGANISATION_ID` environment variable.

Never run `supabase/seed.sql` against a production project.

Running the combined file in the SQL Editor does not populate the Supabase CLI
migration-history table. Before adopting `supabase db push` for a project set up
this way, compare the live schema with every listed migration and then mark only
the confirmed versions as applied with `supabase migration repair`. Never repair
history by assumption: an incorrect applied marker can hide a partially applied
schema.

For a project that already ran the older 0001–0006 combined file, apply
`../migrations/202607180001_security_hardening.sql` and then
`../migrations/202607180002_technician_status_guard.sql` as separate forward
migrations. If 0007 is already applied, run only 0008. Do not re-run the
combined file.

The invoicing foundation lives in
`../migrations/202607200001_invoicing_foundation.sql`. Projects already on 0008
should run that file individually next. Fresh installs get it automatically
via `combined_migrations.sql`.
