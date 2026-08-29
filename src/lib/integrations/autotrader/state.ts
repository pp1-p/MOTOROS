import "server-only";

import {
  getAutoTraderConfigurationStatus,
  getAutoTraderCredentialBinding,
  getAutoTraderCredentials,
  type AutoTraderConnectionStatus,
} from "@/lib/integrations/autotrader";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import type { AutoTraderCredentials } from "@/lib/integrations/autotrader/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type StoredStatus =
  | "not_configured"
  | "connected"
  | "authentication_failed"
  | "permission_missing"
  | "syncing"
  | "error"
  | "disabled";

type JsonRecord = Record<string, unknown>;

const statusMessages: Record<StoredStatus, string> = {
  not_configured: "Auto Trader sandbox is not configured.",
  connected: "Auto Trader sandbox authentication and stock-read access were verified.",
  authentication_failed: "Auto Trader sandbox authentication failed.",
  permission_missing: "The configured advertiser cannot access the required Auto Trader service.",
  syncing: "An Auto Trader sandbox stock sync is in progress.",
  error: "The latest Auto Trader sandbox operation failed.",
  disabled: "Auto Trader sandbox sync is disabled for this dealership.",
};

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function matchesCredentialBinding(
  configuration: unknown,
  credentials: AutoTraderCredentials,
) {
  return (
    asObject(configuration).credential_binding ===
    getAutoTraderCredentialBinding(credentials)
  );
}

export async function getAutoTraderConnectionStatus(
  organisationId: string,
): Promise<{ status: AutoTraderConnectionStatus; message: string }> {
  const configuration = getAutoTraderConfigurationStatus();
  if (configuration.status !== "configured_unverified") return configuration;
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return configuration;
  }

  const result = await createAdminSupabaseClient()
    .from("integration_settings")
    .select("status,public_configuration,last_connected_at")
    .eq("organisation_id", organisationId)
    .eq("provider", "autotrader")
    .maybeSingle();
  if (result.error || !result.data) return configuration;
  if (
    !result.data.last_connected_at ||
    !matchesCredentialBinding(
      result.data.public_configuration,
      getAutoTraderCredentials(),
    )
  ) {
    return {
      status: "configured_unverified",
      message:
        "The current Auto Trader sandbox credentials have not been verified for this dealership.",
    };
  }
  const status = result.data.status as StoredStatus;
  if (status === "not_configured" || status === "disabled") return configuration;
  return {
    status: status as AutoTraderConnectionStatus,
    message: statusMessages[status] ?? configuration.message,
  };
}

export async function assertAutoTraderOrganisationBinding(input: {
  organisationId: string;
  credentials?: AutoTraderCredentials;
}) {
  const credentials = input.credentials ?? getAutoTraderCredentials();
  const binding = getAutoTraderCredentialBinding(credentials);
  const result = await createAdminSupabaseClient()
    .from("integration_settings")
    .select("status,public_configuration,last_connected_at")
    .eq("organisation_id", input.organisationId)
    .eq("provider", "autotrader")
    .maybeSingle();
  if (result.error) {
    throw new Error("The Auto Trader dealership binding could not be checked.");
  }
  if (
    !result.data?.last_connected_at ||
    asObject(result.data.public_configuration).credential_binding !== binding
  ) {
    throw new Error(
      "Verify Auto Trader sandbox read access for this dealership before syncing.",
    );
  }
}

export async function updateAutoTraderIntegrationState(input: {
  organisationId: string;
  status: Exclude<StoredStatus, "not_configured" | "disabled">;
  errorCode?: string | null;
  errorMessage?: string | null;
  connected?: boolean;
  synced?: boolean;
}) {
  const credentials = getAutoTraderCredentials();
  const credentialBinding = getAutoTraderCredentialBinding(credentials);
  const now = new Date().toISOString();
  const supabase = createAdminSupabaseClient();
  const existing = await supabase
    .from("integration_settings")
    .select("public_configuration,last_connected_at,last_successful_sync_at")
    .eq("organisation_id", input.organisationId)
    .eq("provider", "autotrader")
    .maybeSingle();
  if (existing.error) {
    throw new Error("The Auto Trader integration state could not be read.");
  }

  const publicConfiguration = { ...asObject(existing.data?.public_configuration) };
  delete publicConfiguration.advertiser_id;
  const alreadyBound =
    publicConfiguration.credential_binding === credentialBinding;
  if (input.connected) {
    const conflicts = await supabase
      .from("integration_settings")
      .select("organisation_id")
      .eq("provider", "autotrader")
      .contains("public_configuration", {
        credential_binding: credentialBinding,
      })
      .neq("organisation_id", input.organisationId)
      .limit(1);
    if (conflicts.error) {
      throw new Error("The Auto Trader dealership binding could not be checked.");
    }
    if ((conflicts.data ?? []).length > 0) {
      throw new Error(
        "These Auto Trader sandbox credentials are already bound to another dealership.",
      );
    }
    publicConfiguration.credential_binding = credentialBinding;
  } else if (!alreadyBound) {
    delete publicConfiguration.credential_binding;
  }

  const result = await supabase.from("integration_settings").upsert(
    {
      organisation_id: input.organisationId,
      provider: "autotrader",
      status: input.status,
      public_configuration: {
        ...publicConfiguration,
        environment: "sandbox",
        credential_source: "environment",
      },
      secret_reference: "environment",
      last_connected_at: input.connected
        ? now
        : existing.data?.last_connected_at ?? null,
      last_successful_sync_at: input.synced
        ? now
        : existing.data?.last_successful_sync_at ?? null,
      last_error_at: input.errorCode ? now : null,
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage ?? null,
    },
    { onConflict: "organisation_id,provider" },
  );
  if (result.error) {
    throw new Error("The Auto Trader integration state could not be saved.");
  }
}
