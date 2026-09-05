# MotorOS platform administration

`/platform` is a separate server-protected control plane. A normal dealership
membership never grants access. Unauthorised page requests return a plain 404;
unauthorised platform APIs return a non-enumerating response.

## Create the first platform owner

1. Create the person in Supabase Authentication and copy their Auth user UUID.
2. Apply every migration, including `202608210001_multitenant_foundation.sql`.
3. Run this once in a controlled SQL session, replacing both UUIDs:

```sql
insert into public.platform_user_roles (
  user_id,
  role,
  status,
  created_by
)
values (
  'OWNER-AUTH-USER-UUID',
  'owner',
  'active',
  'OWNER-AUTH-USER-UUID'
)
on conflict (user_id) do update
set role = excluded.role,
    status = 'active',
    updated_at = now();
```

For initial bootstrap only, the same account email may be listed in the
server-only `PLATFORM_ADMIN_EMAILS` variable. Remove that fallback after the
database assignment is verified. Do not put service keys or platform emails in
browser-visible variables.

To create a read-only support operator, insert the Auth UUID with
`role='support'`. Set `status='suspended'` to revoke a platform assignment.

## Capabilities

The overview contains total/active/trial/suspended/cancelled dealerships,
published/unpublished sites, total vehicles, leads and staff, recent creations,
and meaningful audited activity. Its directory searches name, owner, slug,
subdomain and custom domain; filters lifecycle, website and theme; and sorts by
creation, name, activity, vehicle or lead volume.

Each detail page shows business/contact settings, lifecycle and plan, team,
domains, live/draft design, publication history, inventory/leads/invoices/pages,
onboarding state and audit history. Detail access is awaited in the audit log,
including support reads.

Owner-only actions require a reason plus explicit confirmation and include:

- create a dealership;
- invite or re-invite its owner;
- change trial/active/suspended/cancelled/closed lifecycle;
- update plan metadata and website publication state;
- save or publish a design selection;
- record custom-domain verification state.

Support is read-only in both the UI and APIs. The service layer scopes every
mutation to the selected organisation and compensates the data change if the
required audit insert fails.

## Operating cautions

- Suspension and cancellation remove membership access and public availability.
- Plan codes are operational metadata; this release does not implement billing.
- `verified` is an operator assertion after an external domain check, not an
  automated certificate/DNS proof.
- A new email receives a seven-day owner invitation. An email already present
  in Supabase Auth is assigned an owner membership and receives the normal
  password-reset flow. Both require working Auth email configuration; failed
  delivery leaves an audited warning and can be retried from the detail page.
- Audit values intentionally avoid invitation addresses; only the email domain
  and delivery outcome are recorded.
- “Tracking” is operational counts, status and audited events. MotorOS does not
  record keystrokes, page surveillance or private customer content for platform
  analytics.

## Routine access review

At least quarterly, export only the non-sensitive `platform_user_roles` fields,
confirm each operator still needs access, suspend unused assignments, rotate
bootstrap configuration out, and inspect support-view events. Test one owner,
one support user and one normal dealership user in staging after every auth or
RLS change.
