# One-shot hosted setup helpers

Helpers for deploying DealerOS to a fresh Supabase project from the dashboard,
without installing the Supabase CLI. The CLI flow in `docs/DEPLOYMENT.md`
remains the recommended path for teams that use it.

Run in the Supabase SQL Editor, in this order:

1. `combined_migrations.sql` — all migrations from `supabase/migrations/`
   (0001–0006) concatenated in order. Run once on an empty project. If new
   migration files are added to the repository later, apply those individually;
   do not re-run this file.
2. `first_owner_setup.sql` — after creating your first user in
   Authentication → Users, edit the three values at the top and run once. It
   creates the organisation, dealership settings and the active owner
   membership, then returns the organisation ID needed for the
   `DEALEROS_PUBLIC_ORGANISATION_ID` environment variable.

Never run `supabase/seed.sql` against a production project.
