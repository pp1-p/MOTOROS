import "server-only";

import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import {
  connectionStatusLabel,
  getGrantedSocialCapabilities,
  socialProviders,
  type SocialCapability,
  type SocialConnectionStatus,
} from "@/lib/integrations/social-provider";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const connectionStatuses = new Set<SocialConnectionStatus>([
  "not_configured",
  "connecting",
  "connected",
  "token_expired",
  "action_required",
  "authentication_failed",
  "permission_missing",
  "syncing",
  "error",
  "disabled",
]);

function connectionStatus(value: unknown): SocialConnectionStatus {
  const status = String(value) as SocialConnectionStatus;
  return connectionStatuses.has(status) ? status : "not_configured";
}

export type SocialConnectionView = {
  id: string | null;
  provider: string;
  name: string;
  description: string;
  status: SocialConnectionStatus;
  statusLabel: string;
  accountName: string | null;
  accountUsername: string | null;
  capabilities: readonly SocialCapability[];
  setupNote: string;
  requiredEnvironment: readonly string[];
  deploymentConfigured: boolean;
  lastConnectedAt: string | null;
  lastErrorMessage: string | null;
};

export type SocialPostView = {
  id: string;
  caption: string;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  targetProviders: string[];
};

export type SocialConversationView = {
  id: string;
  provider: string;
  subject: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  leadId: string | null;
  customerName: string | null;
  vehicleTitle: string | null;
};

export type SocialVehicleOption = {
  id: string;
  label: string;
  registration: string | null;
};

function providerDeploymentConfigured(requiredEnvironment: readonly string[]) {
  return requiredEnvironment.every((name) => Boolean(process.env[name]?.trim()));
}

export async function getSocialConnections(
  organisationId: string,
): Promise<SocialConnectionView[]> {
  let rows: Record<string, unknown>[] = [];
  if (isSupabaseConfigured() && getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    const result = await createAdminSupabaseClient()
      .from("integration_settings")
      .select(
        "id,provider,status,account_name,account_username,capabilities,last_connected_at,last_error_message",
      )
      .eq("organisation_id", organisationId)
      .in(
        "provider",
        socialProviders.map((provider) => provider.id),
      );
    if (!result.error) rows = result.data ?? [];
  }

  return socialProviders.map((provider) => {
    const row = rows.find((item) => item.provider === provider.id);
    const status = connectionStatus(row?.status);
    const storedCapabilities = getGrantedSocialCapabilities(
      provider.id,
      row?.capabilities,
    );
    return {
      id: row ? String(row.id) : null,
      provider: provider.id,
      name: provider.name,
      description: provider.description,
      status,
      statusLabel: connectionStatusLabel(status),
      accountName: row?.account_name ? String(row.account_name) : null,
      accountUsername: row?.account_username
        ? String(row.account_username)
        : null,
      // A persisted connection must declare the capabilities actually granted
      // by its provider. Falling back to the catalogue for a connected row
      // would turn a missing scope into permission to publish.
      capabilities: row ? storedCapabilities : provider.capabilities,
      setupNote: provider.setupNote,
      requiredEnvironment: provider.requiredEnvironment,
      deploymentConfigured: providerDeploymentConfigured(
        provider.requiredEnvironment,
      ),
      lastConnectedAt: row?.last_connected_at
        ? String(row.last_connected_at)
        : null,
      lastErrorMessage: row?.last_error_message
        ? String(row.last_error_message)
        : null,
    };
  });
}

export async function getSocialPosts(
  organisationId: string,
  limit = 40,
): Promise<SocialPostView[]> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const result = await createAdminSupabaseClient()
    .from("social_posts")
    .select(
      "id,caption,status,scheduled_for,published_at,created_at,social_post_targets(provider)",
    )
    .eq("organisation_id", organisationId)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (result.error) return [];
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    caption: String(row.caption),
    status: String(row.status),
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null,
    createdAt: String(row.created_at),
    targetProviders: Array.isArray(row.social_post_targets)
      ? row.social_post_targets.map((target) => String(target.provider))
      : [],
  }));
}

export async function getSocialConversations(
  organisationId: string,
  limit = 40,
): Promise<SocialConversationView[]> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }
  const result = await createAdminSupabaseClient()
    .from("social_conversations")
    .select(
      "id,provider,subject,status,unread_count,last_message_at,lead_id,customers(full_name),vehicles(public_title,year,make,model)",
    )
    .eq("organisation_id", organisationId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (result.error) return [];
  return (result.data ?? []).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    return {
      id: String(row.id),
      provider: String(row.provider),
      subject: row.subject ? String(row.subject) : "Customer conversation",
      status: String(row.status),
      unreadCount: Number(row.unread_count ?? 0),
      lastMessageAt: (row.last_message_at as string | null) ?? null,
      leadId: (row.lead_id as string | null) ?? null,
      customerName:
        (customer as { full_name?: string } | null)?.full_name ?? null,
      vehicleTitle: vehicle
        ? ((vehicle as { public_title?: string | null }).public_title ??
          `${String((vehicle as { year?: unknown }).year)} ${String((vehicle as { make?: unknown }).make)} ${String((vehicle as { model?: unknown }).model)}`)
        : null,
    };
  });
}

export async function getSocialVehicleOptions(
  organisationId: string,
): Promise<SocialVehicleOption[]> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    if (!isDevelopmentDemoMode()) return [];
    return [];
  }
  const result = await createAdminSupabaseClient()
    .from("vehicles")
    .select("id,public_title,make,model,year,registration")
    .eq("organisation_id", organisationId)
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) return [];
  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    label:
      (row.public_title as string | null) ??
      `${String(row.year)} ${String(row.make)} ${String(row.model)}`,
    registration: (row.registration as string | null) ?? null,
  }));
}

export function connectionCanPublish(connection: SocialConnectionView) {
  return (
    connection.status === "connected" &&
    connection.id !== null &&
    (connection.capabilities.includes("image_publish") ||
      connection.capabilities.includes("video_publish"))
  );
}
