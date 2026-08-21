import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDirectory = join(root, "supabase", "migrations");
const combinedPath = join(root, "supabase", "deploy", "combined_migrations.sql");
const hardeningPath = join(
  migrationsDirectory,
  "202607180001_security_hardening.sql",
);
const technicianStatusGuardPath = join(
  migrationsDirectory,
  "202607180002_technician_status_guard.sql",
);
const multitenantPath = join(
  migrationsDirectory,
  "202608210001_multitenant_foundation.sql",
);

function read(path) {
  return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const combined = read(combinedPath);

for (const [index, name] of migrationFiles.entries()) {
  const marker = `-- ===== ${name} =====`;
  const start = combined.indexOf(marker);
  assert(start >= 0, `Combined migration is missing ${name}`);

  const bodyStart = combined.indexOf("\n", start) + 1;
  const nextMarker = combined.indexOf("-- ===== ", bodyStart);
  const bodyEnd = nextMarker >= 0 ? nextMarker : combined.length;
  const combinedBody = combined.slice(bodyStart, bodyEnd).trim();
  const sourceBody = read(join(migrationsDirectory, name)).trim();

  assert(
    combinedBody === sourceBody,
    `Combined migration differs from ${name}`,
  );
  if (index > 0) {
    const previousMarker = `-- ===== ${migrationFiles[index - 1]} =====`;
    assert(
      combined.indexOf(previousMarker) < start,
      `Combined migration order is incorrect at ${name}`,
    );
  }
}

const workflows = read(
  join(migrationsDirectory, "202607160004_security_workflows.sql"),
);

const multitenant = read(multitenantPath);
const requiredMultitenantControls = [
  "create table public.dealership_domains",
  "create table public.platform_user_roles",
  "create table public.website_theme_publications",
  "alter table public.dealership_domains enable row level security;",
  "alter table public.platform_user_roles enable row level security;",
  "alter table public.website_theme_publications enable row level security;",
  "using (user_id = auth.uid());",
  "revoke update on public.organisations from authenticated;",
  "create or replace function public.publish_website_theme(",
  "grant execute on function public.publish_website_theme(uuid, text)",
  "create unique index vehicles_org_slug_unique",
  "on public.vehicles (organisation_id, slug)",
];

for (const control of requiredMultitenantControls) {
  assert(
    multitenant.includes(control),
    `Multi-tenant migration is missing control: ${control}`,
  );
}

for (const table of [
  "dealership_domains",
  "platform_user_roles",
  "website_theme_publications",
]) {
  assert(
    multitenant.includes(
      `revoke all on public.${table} from public, anon, authenticated;`,
    ),
    `Multi-tenant migration does not revoke browser writes on ${table}`,
  );
}

for (const helper of [
  "is_org_member",
  "has_org_role",
  "has_org_permission",
  "current_member_role",
]) {
  const start = multitenant.indexOf(`create or replace function public.${helper}`);
  assert(start >= 0, `Multi-tenant migration is missing ${helper}`);
  const end = multitenant.indexOf("\n$$;", start);
  assert(end > start, `Multi-tenant helper ${helper} is incomplete`);
  const body = multitenant.slice(start, end);
  assert(
    body.includes("o.status in ('trial', 'active')") &&
      body.includes("o.deleted_at is null"),
    `Multi-tenant helper ${helper} does not enforce dealership lifecycle`,
  );
}

assert(
  multitenant.includes("check (status <> 'verified' or verified_at is not null)"),
  "Verified dealership domains do not require a verification timestamp",
);
const invitationConstraintStart = multitenant.indexOf(
  "add constraint team_invitations_role_check check (",
);
const invitationConstraintEnd = multitenant.indexOf(
  ");",
  invitationConstraintStart,
);
assert(
  invitationConstraintStart >= 0 &&
    invitationConstraintEnd > invitationConstraintStart &&
    multitenant
      .slice(invitationConstraintStart, invitationConstraintEnd)
      .includes("'owner'"),
  "Team invitation constraint does not allow platform-provisioned owners",
);
const vehiclePolicyStart = multitenant.indexOf(
  "create policy vehicles_public_read",
);
const vehiclePolicyEnd = multitenant.indexOf(
  "create policy vehicle_images_public_read",
  vehiclePolicyStart,
);
assert(
  vehiclePolicyStart >= 0 && vehiclePolicyEnd > vehiclePolicyStart,
  "Could not locate the public vehicle policy",
);
const vehiclePublicPolicy = multitenant.slice(
  vehiclePolicyStart,
  vehiclePolicyEnd,
);
assert(
  vehiclePublicPolicy.includes("to anon") &&
    !vehiclePublicPolicy.includes("to authenticated"),
  "Public vehicle policy is not restricted to the anonymous role",
);

for (const view of [
  "public_dealerships",
  "public_safe_vehicles",
  "public_vehicle_images",
  "public_vehicle_features",
  "public_vehicle_inventory",
]) {
  const signature = `create or replace view public.${view}\nwith (security_invoker = on, security_barrier = true)`;
  assert(
    multitenant.includes(signature),
    `Public tenant view ${view} is not security-invoker/barrier protected`,
  );
}
assert(
  !/(?<!extensions\.)\bdigest\(/u.test(workflows),
  "A public workflow still has an unqualified digest call",
);

const technicianStatuses = [
  "awaiting_inspection",
  "diagnosing",
  "estimate_preparing",
  "approved",
  "parts_ordered",
  "parts_received",
  "work_in_progress",
  "quality_check",
  "ready_for_collection",
];

function assertTechnicianCurrentStatusGuard(sql, label) {
  const signature = `create or replace function public.update_assigned_repair_job(
  p_repair_job_id uuid,
  p_changes jsonb
)`;
  const functionStart = sql.indexOf(signature);
  assert(functionStart >= 0, `${label} is missing the guarded repair RPC`);

  const functionEnd = sql.indexOf("\n$$;", functionStart);
  assert(functionEnd >= 0, `${label} has an incomplete guarded repair RPC`);
  const functionBody = sql.slice(functionStart, functionEnd);
  const lockIndex = functionBody.indexOf("for update;");
  const guardIndex = functionBody.indexOf(
    "if p_changes ? 'status'\n    and target_job.status not in (",
  );
  const updateIndex = functionBody.indexOf(
    "update public.repair_jobs",
    guardIndex,
  );

  assert(lockIndex >= 0, `${label} does not lock the target repair row`);
  assert(
    guardIndex > lockIndex,
    `${label} does not guard the current repair status after locking the row`,
  );
  assert(
    updateIndex > guardIndex,
    `${label} does not guard the current repair status before updating`,
  );

  const guardEnd = functionBody.indexOf("  then", guardIndex);
  assert(guardEnd > guardIndex, `${label} has an incomplete current-status guard`);
  const guardBody = functionBody.slice(guardIndex, guardEnd);
  for (const status of technicianStatuses) {
    assert(
      guardBody.includes(`'${status}'`),
      `${label} current-status guard is missing ${status}`,
    );
  }
  for (const managerStatus of [
    "awaiting_customer_approval",
    "collected",
    "cancelled",
  ]) {
    assert(
      !guardBody.includes(`'${managerStatus}'`),
      `${label} lets technicians move a manager-controlled ${managerStatus} repair`,
    );
  }
  assert(
    functionBody.includes("raise exception 'A manager must change this repair status'"),
    `${label} is missing the manager-controlled status rejection`,
  );
}

assertTechnicianCurrentStatusGuard(workflows, "Canonical workflow migration");

const technicianStatusGuard = read(technicianStatusGuardPath);
assertTechnicianCurrentStatusGuard(
  technicianStatusGuard,
  "Technician status follow-up migration",
);
assert(
  technicianStatusGuard.includes(
    "from public, anon, authenticated, service_role;\ngrant execute on function public.update_assigned_repair_job(uuid, jsonb)\n  to authenticated;",
  ),
  "Technician status follow-up migration does not restate the guarded RPC ACL",
);
assert(
  technicianStatusGuard.includes("do $verify_technician_repair_acl$"),
  "Technician status follow-up migration is missing its ACL verification",
);

const hardening = read(hardeningPath);
const serviceOnlyFunctions = [
  "attach_vehicle_image",
  "claim_storage_cleanup_jobs",
  "convert_appointment_to_repair",
  "create_vehicle_with_costs",
  "merge_customers",
  "publish_homepage",
  "record_vehicle_sale",
  "reorder_vehicle_images",
  "replace_availability_rules",
  "soft_delete_vehicle_image",
  "update_sourcing_request",
  "update_team_member_access",
  "update_vehicle_with_costs",
];

const assertedServiceOnlySignatures = [
  "public.consume_public_rate_limit(uuid,text,text,integer,integer)",
  "public.submit_public_enquiry(uuid,jsonb)",
  "public.submit_public_sourcing_request(uuid,jsonb)",
  "public.book_repair_call(text,text,timestamp with time zone,text,text,text,text,text,text,text,text,boolean,boolean,text,text,boolean,text,text)",
  "public.book_repair_call(uuid,timestamp with time zone,text,text,text,text,text,text,text,text,text,text)",
  "public.accept_team_invitation(uuid)",
];

for (const name of serviceOnlyFunctions) {
  assert(
    hardening.includes(`revoke execute on function public.${name}`),
    `Hardening migration does not explicitly revoke ${name}`,
  );
  assert(
    hardening.includes(`grant execute on function public.${name}`),
    `Hardening migration does not restore service access to ${name}`,
  );
}

const serviceOnlyAssertionBody = hardening.match(
  /service_only regprocedure\[\] := array\[([\s\S]*?)\n  \];/u,
)?.[1];
assert(
  serviceOnlyAssertionBody,
  "Could not locate the service-only ACL assertion list",
);

for (const signature of assertedServiceOnlySignatures) {
  assert(
    serviceOnlyAssertionBody.includes(`'${signature}'::regprocedure`),
    `Service-only ACL assertion is missing ${signature}`,
  );
}

assert(
  hardening.includes("do $deny_security_definers$"),
  "Hardening migration is missing the SECURITY DEFINER deny-by-default pass",
);
assert(
  hardening.includes("do $verify_security_definer_acl$"),
  "Hardening migration is missing its transactional ACL verification",
);
assert(
  hardening.includes("audit_logs_sanitise_customer_values"),
  "Hardening migration is missing the customer audit guard trigger",
);

const snapshotBody = hardening.match(
  /create or replace function public\.customer_audit_snapshot[\s\S]*?as \$\$([\s\S]*?)\$\$;/u,
)?.[1];
assert(snapshotBody, "Could not locate the customer audit allow-list");

for (const key of [
  "title",
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "normalised_email",
  "normalised_phone",
  "email_normalised",
  "phone_normalised",
  "address",
  "notes",
  "consent_source",
  "marketing_consent_source",
]) {
  assert(
    !snapshotBody.includes(`p_row -> '${key}'`),
    `Customer audit allow-list contains sensitive key ${key}`,
  );
}

console.log(
  `Verified ${migrationFiles.length} migrations, combined parity, technician status guard, digest qualification, service RPC ACL declarations and customer audit redaction.`,
);
