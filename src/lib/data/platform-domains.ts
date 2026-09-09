import "server-only";

import type { PlatformAdminContext } from "@/lib/auth/platform-admin";
import {
  changePlatformDomainStatus,
  type PlatformDomainStatus,
} from "@/lib/data/platform-admin";
import { getServerEnv } from "@/lib/env";
import { getVercelDomainClient } from "@/lib/platform/vercel-domains";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normaliseHostname } from "@/lib/tenancy/hostname";

type PlatformActor = Pick<PlatformAdminContext, "userId" | "email" | "role">;

type DomainRow = {
  id: string;
  organisation_id: string;
  hostname: string;
  type: "subdomain" | "custom";
  status: PlatformDomainStatus;
  verified_at: string | null;
  created_at?: string;
};

async function writeDomainAudit(input: {
  organisationId: string;
  actor: PlatformActor;
  action: string;
  entityId: string;
  reason: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const result = await createAdminSupabaseClient().from("audit_logs").insert({
    organisation_id: input.organisationId,
    actor_user_id: input.actor.userId,
    action: input.action,
    entity_type: "dealership_domain",
    entity_id: input.entityId,
    change_reason: input.reason,
    old_values: input.oldValues ?? null,
    new_values: {
      ...(input.newValues ?? {}),
      platform_role: input.actor.role,
    },
  });
  if (result.error) throw new Error("The platform domain action could not be audited.");
}

function assertPlatformOwner(actor: PlatformActor) {
  if (actor.role !== "owner") {
    throw new Error("Platform support access is read-only.");
  }
}

function customHostname(value: string) {
  const hostname = normaliseHostname(value);
  if (
    !hostname ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    throw new Error("Enter a valid public custom hostname.");
  }

  const baseDomain = normaliseHostname(getServerEnv().MOTOROS_BASE_DOMAIN);
  if (
    baseDomain &&
    (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`))
  ) {
    throw new Error("MotorOS platform subdomains cannot be registered as custom domains.");
  }
  return hostname;
}

async function getDomain(input: {
  organisationId: string;
  domainId: string;
}): Promise<DomainRow> {
  const result = await createAdminSupabaseClient()
    .from("dealership_domains")
    .select("id,organisation_id,hostname,type,status,verified_at,created_at")
    .eq("id", input.domainId)
    .eq("organisation_id", input.organisationId)
    .maybeSingle();
  if (result.error || !result.data) throw new Error("Domain not found.");
  return result.data as DomainRow;
}

export async function addPlatformCustomDomain(input: {
  organisationId: string;
  actor: PlatformActor;
  hostname: string;
  reason: string;
}) {
  assertPlatformOwner(input.actor);
  const hostname = customHostname(input.hostname);
  const supabase = createAdminSupabaseClient();

  const organisation = await supabase
    .from("organisations")
    .select("id")
    .eq("id", input.organisationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (organisation.error || !organisation.data) {
    throw new Error("Dealership not found.");
  }

  const existing = await supabase
    .from("dealership_domains")
    .select("id,organisation_id,hostname,type,status,verified_at,created_at")
    .eq("hostname", hostname)
    .maybeSingle();
  if (existing.error) throw new Error("Existing domains could not be checked.");
  if (existing.data) {
    if (String(existing.data.organisation_id) === input.organisationId) {
      throw new Error("That hostname is already attached to this dealership.");
    }
    throw new Error("That hostname is already attached to another dealership.");
  }

  const inserted = await supabase
    .from("dealership_domains")
    .insert({
      organisation_id: input.organisationId,
      hostname,
      type: "custom",
      status: "pending",
      verified_at: null,
    })
    .select("id,organisation_id,hostname,type,status,verified_at,created_at")
    .single();
  if (inserted.error || !inserted.data) {
    throw new Error("The custom domain could not be added.");
  }

  try {
    await writeDomainAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action: "platform.domain.created",
      entityId: String(inserted.data.id),
      reason: input.reason,
      newValues: {
        hostname,
        type: "custom",
        status: "pending",
      },
    });
  } catch (error) {
    await supabase.from("dealership_domains").delete().eq("id", inserted.data.id);
    throw error;
  }

  return inserted.data as DomainRow;
}

export async function provisionPlatformCustomDomain(input: {
  organisationId: string;
  domainId: string;
  actor: PlatformActor;
}) {
  assertPlatformOwner(input.actor);
  const before = await getDomain(input);
  if (before.type !== "custom") {
    throw new Error("MotorOS subdomains do not require Vercel custom-domain verification.");
  }
  if (before.status === "disabled") {
    throw new Error("Re-enable this domain before checking its DNS configuration.");
  }

  const provisioning = await getVercelDomainClient().provision(before.hostname);
  const status: PlatformDomainStatus = provisioning.ready ? "verified" : "pending";
  const verifiedAt = provisioning.ready
    ? before.verified_at ?? new Date().toISOString()
    : null;

  const supabase = createAdminSupabaseClient();
  const changed = await supabase
    .from("dealership_domains")
    .update({ status, verified_at: verifiedAt })
    .eq("id", input.domainId)
    .eq("organisation_id", input.organisationId)
    .select("id,organisation_id,hostname,type,status,verified_at,created_at")
    .single();
  if (changed.error || !changed.data) {
    throw new Error("The verified domain state could not be saved.");
  }

  try {
    await writeDomainAudit({
      organisationId: input.organisationId,
      actor: input.actor,
      action: provisioning.ready
        ? "platform.domain.verified"
        : "platform.domain.verification_checked",
      entityId: input.domainId,
      reason: provisioning.ready
        ? "Vercel confirmed domain ownership and a valid DNS/TLS configuration."
        : "Vercel domain verification was checked; DNS or ownership verification is still pending.",
      oldValues: {
        status: before.status,
        verified_at: before.verified_at,
      },
      newValues: {
        status,
        verified_at: verifiedAt,
        provider: "vercel",
        provider_verified: provisioning.verified,
        provider_misconfigured: provisioning.misconfigured,
      },
    });
  } catch (error) {
    await supabase
      .from("dealership_domains")
      .update({ status: before.status, verified_at: before.verified_at })
      .eq("id", input.domainId)
      .eq("organisation_id", input.organisationId);
    throw error;
  }

  return {
    domain: changed.data as DomainRow,
    provisioning,
  };
}

export async function changePlatformDomainStatusSafely(input: {
  organisationId: string;
  domainId: string;
  actor: PlatformActor;
  status: PlatformDomainStatus;
  reason: string;
}) {
  assertPlatformOwner(input.actor);
  const domain = await getDomain(input);
  if (domain.type === "custom" && input.status === "verified") {
    throw new Error(
      "Custom domains can only become verified after the Vercel ownership and DNS checks pass.",
    );
  }
  return changePlatformDomainStatus(input);
}
