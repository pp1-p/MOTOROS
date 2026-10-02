# MOTOR.OS workspace design

This pass applies the design-system approach found through the user-supplied
[codex-design topic](https://github.com/topics/codex-design), especially
[Better Design](https://github.com/marvkr/better-design). Precision Light informed
the neutral surfaces, spacing, layered card depth and focus treatment. The code
is an original adaptation of MOTOR.OS components; no remote installer, MCP
connection, account or new project dependency is required.

## Scope

- Admin-only tokens in `src/app/admin/admin.css`; public themes are unchanged.
- MOTOR.OS navigation, readable descriptions, consistent card and header rhythm.
- Existing Radix Dialog manages keyboard focus, Escape, background scroll and
  focus return for search, quick create, notifications and mobile navigation.
- Skip-to-content link and keyboard-scrollable table regions.
- Phone-sized stock cards, accessible native status/sort controls, deterministic
  sorting, explicit inactive-stock access and matching empty states in both views.
- Dashboard metrics link to their existing workflows. Data-mode labels describe
  the loaded data, not an unverified system-health claim.

Permissions, API contracts, database schemas and external integrations are not
changed. No SQL migration is needed. All verification uses development demo
fixtures rather than production records or credentials.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`.
Run `npm run test:e2e -- tests/e2e/admin-design.spec.ts --project=chromium` for
desktop/phone/tablet overflow, stock controls, modal focus, Escape, focus return
and navigation checks. Browser binaries must be installed locally first.

Results for this design pass:

- Unit/component suite: **180 tests passed across 32 files**, including seven
  DOM-level design regression tests and four stock-filter tests.
- TypeScript, ESLint and `git diff --check`: passed.
- Production build: passed with the existing offline Google-font test mock:
  `NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$PWD/tests/e2e/next-font-mocks.cjs" npm run build`.
  No production font configuration was changed. A subsequent Turbopack cache
  crash was resolved by moving the generated cache aside and rebuilding cleanly.
- Playwright discovery: three design browser tests are listed successfully.
  **These browser tests have not run.** Chrome could not be installed in this
  managed workspace: Playwright received an invalid download archive, and the
  alternate installer failed certificate validation (`UnknownIssuer`). TLS
  verification was not disabled.

DOM tests verify navigation semantics, focus capture/trapping/return, modal
replacement, background scroll locking, stale search cancellation, stock
controls and commercial-data visibility. They do not verify rendered spacing,
responsive overflow, visual contrast or browser behaviour. Run the three
Playwright tests and a visual review in a browser-capable environment before
merging/deploying this change.

## Handover verification update — 2 October 2026

The browser-installation limitation above describes the earlier design pass.
The follow-up [dealership handover review](DEALERSHIP_HANDOVER.md) has now run
Chromium successfully: **83 browser checks passed, one authenticated Supabase
check skipped**, including all three admin-design tests at phone, tablet and
desktop widths. Public navigation, forms, all 15 vehicle sections, galleries,
reduced-motion/enlarged-text containment and all four theme previews are also
covered. Six focused browser checks also passed after the final filter-label
and sticky-header/error-summary polish. The unit/component suite now has **216 passing tests across 38 files**.

These are isolated demo and mocked-write checks, with the existing font mock.
Real-device Safari, live tenant content, persistent writes, cross-tenant RLS,
provider delivery and the handover acceptance steps still need staging review.
No database migration or application dependency was added by the follow-up.

## Changed files

- `src/app/admin/admin.css`
- `src/components/admin/admin-shell.tsx`
- `src/components/admin/dashboard.tsx`
- `src/components/admin/dealership-switcher.tsx`
- `src/components/admin/page-kit.tsx`
- `src/components/admin/stock-table.tsx`
- `src/components/admin/stock-filters.ts`
- `src/components/admin/workspace-dialog.tsx`
- `src/components/admin/admin-design.test.tsx`
- `src/components/admin/stock-filters.test.ts`
- `tests/e2e/admin-design.spec.ts`
- `docs/ADMIN_DESIGN.md`

## Publishing the recovered source

The current source was recovered from GitHub main commit
`4e7fce768e38f16b41f23ee8d2cbcb370df9dea8` after workspace maintenance. Publishing
must apply only this design diff to that GitHub tree, preserving existing assets
and history; the local recovery snapshot is not a replacement main branch.
