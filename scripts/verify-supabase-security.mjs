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
