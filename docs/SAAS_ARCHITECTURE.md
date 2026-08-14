# MOTOR.OS SaaS architecture

MOTOR.OS is one multi-tenant application with three explicit product layers.
It does not fork a codebase or database per dealership.

## Product layers and routes

1. **Platform control centre** (`/platform`) — global dealership directory,
   operational KPIs, subscriptions, website state, integration health and
   audited suspend/reactivate controls.
2. **Dealership operating system** (`/admin`) — stock, leads, sales, workshop,
   customers, documents, reporting, website studio and the social hub.
3. **Public dealer website** (the public route group) — one content model and
   inventory source rendered through the dealership's selected design template.

`/admin` remains the dealership workspace to preserve existing bookmarks,
permissions and integrations. Global administration remains isolated under
`/platform`.

## Tenant boundary

`organisations.id` is the tenant key. Operational records carry
`organisation_id`; authenticated membership is resolved server-side and an
organisation ID is never trusted from a browser form. RLS helpers validate an
active membership and role. Service-role routes repeat the organisation
predicate on every read and mutation.

The SaaS foundation adds composite `(organisation_id, id)` constraints and
foreign keys across social posts, targets, conversations, messages, customers,
vehicles and leads. A valid UUID from another dealership therefore cannot be
linked accidentally by privileged application code.

New private tables have RLS enabled. Browser sessions receive read-only,
role-filtered access where required; all social, theme and platform mutations
go through validated server routes. Provider secret references and domain
verification hashes are excluded from authenticated column grants.

## Platform administration

`platform_admins` is separate from dealership membership. An active database
row is required for mutating platform actions. `PLATFORM_ADMIN_EMAILS` is only a
read-only bootstrap path, so an environment typo cannot suspend a dealership.

Bootstrap an authenticated user deliberately through a controlled SQL session:

```sql
insert into public.platform_admins (user_id, status, created_by)
values ('AUTH-USER-UUID', 'active', 'AUTH-USER-UUID')
on conflict (user_id) do update set status = 'active';
```

The `platform_set_dealership_status` RPC checks `auth.uid()` through
`is_platform_admin()`, locks the organisation row, updates website availability
and writes the old/new status to `audit_logs` in one transaction.

## Subscriptions and entitlements

`dealership_subscriptions` stores plan and billing-provider references.
`dealership_entitlements` stores explicit, expiring feature overrides. The
application resolves a known default feature set for Starter, Professional,
Premium and Custom plans, then applies valid overrides.

Entitlement checks occur in both the UI and mutation route. Current gated
capabilities include premium website themes, social connections, social
publishing, unified inbox, custom domains, advanced analytics and automation.
No payment provider is fabricated; billing references remain nullable until an
approved billing adapter exists.

## Dealer websites

`website_themes` contains four stable template IDs: Modern, Performance,
Classic Dealer and Luxury. `dealership_sites` selects one template for a tenant,
and `dealership_domains` models hosted and custom domain verification state.

Templates change presentation tokens only. Homepage content, branding, stock,
lead forms and SEO stay in their existing shared records. Theme selection is
permission-checked, entitlement-checked and audited. Suspended organisations
are excluded from `public_dealerships`.

## Social and communications

The existing `integration_settings` table remains the single account-connection
record. Provider definitions declare capabilities instead of assuming all
networks can publish, schedule, report metrics or exchange messages.

- `social_posts` stores a dealership draft or calendar item.
- `social_post_targets` records delivery state independently per real connection.
- `social_conversations` links a provider thread to a customer, vehicle or lead.
- `social_messages` stores direction and delivery state without exposing tokens.
- `leads` records source campaign, external ID and originating conversation.

The compose route validates the tenant, role, subscription, public vehicle and
connected publishing targets. It can persist drafts and schedules. External
delivery is intentionally not claimed until a provider-specific worker, OAuth
flow and webhook verification have been configured and tested.

## End-to-end operating flow

The canonical growth loop is:

```text
inventory -> dealer website/template -> social draft/schedule
          -> provider target -> enquiry/conversation -> attributed lead
          -> existing sales/invoice/customer history
```

The new tables extend the current DMS instead of replacing stock, customer,
lead, sale or audit records.

## Deployment sequence

1. Apply all migrations to a dedicated staging Supabase project.
2. Create a platform-admin Auth user and database row through a controlled setup.
3. Verify two test organisations cannot read or link each other's records.
4. Configure only the provider environments that have approved credentials and scopes.
5. Exercise draft, schedule, theme selection, suspension and reactivation flows.
6. Add provider delivery workers/webhooks one adapter at a time with sandbox tests.
7. Complete the launch checklist before enabling indexing or production traffic.
