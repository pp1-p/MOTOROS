export const socialProviderIds = [
  "instagram",
  "facebook",
  "whatsapp",
  "telegram",
  "tiktok",
  "google_business",
  "messenger",
] as const;

export type SocialProviderId = (typeof socialProviderIds)[number];

export type SocialCapability =
  | "account_profile"
  | "image_publish"
  | "video_publish"
  | "schedule_publish"
  | "engagement_metrics"
  | "comments"
  | "conversations"
  | "send_message"
  | "media_messages";

export type SocialConnectionStatus =
  | "not_configured"
  | "connecting"
  | "connected"
  | "token_expired"
  | "action_required"
  | "authentication_failed"
  | "permission_missing"
  | "syncing"
  | "error"
  | "disabled";

export type SocialProviderDefinition = {
  id: SocialProviderId;
  name: string;
  description: string;
  capabilities: readonly SocialCapability[];
  requiredEnvironment: readonly string[];
  setupNote: string;
};

export const socialProviders: readonly SocialProviderDefinition[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Business account publishing, comments and engagement data.",
    capabilities: [
      "account_profile",
      "image_publish",
      "video_publish",
      "engagement_metrics",
      "comments",
    ],
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_REDIRECT_URI",
      "META_WEBHOOK_VERIFY_TOKEN",
    ],
    setupNote: "Requires a Meta app, approved scopes and a professional Instagram account.",
  },
  {
    id: "facebook",
    name: "Facebook Page",
    description: "Page publishing, comments and engagement where approved.",
    capabilities: [
      "account_profile",
      "image_publish",
      "video_publish",
      "engagement_metrics",
      "comments",
    ],
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_REDIRECT_URI",
      "META_WEBHOOK_VERIFY_TOKEN",
    ],
    setupNote: "Requires Meta app review and a Page the connecting user can manage.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Customer conversations and approved business messaging.",
    capabilities: [
      "account_profile",
      "conversations",
      "send_message",
      "media_messages",
    ],
    requiredEnvironment: [
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    ],
    setupNote: "Requires a WhatsApp Business Platform account and approved message workflows.",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot or channel messages and media through a verified webhook.",
    capabilities: [
      "account_profile",
      "conversations",
      "send_message",
      "media_messages",
    ],
    requiredEnvironment: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
    setupNote: "Requires a dealership-owned bot and a secret-validated webhook.",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    description: "Video publishing and performance data where account access permits.",
    capabilities: [
      "account_profile",
      "video_publish",
      "engagement_metrics",
    ],
    requiredEnvironment: [
      "TIKTOK_CLIENT_KEY",
      "TIKTOK_CLIENT_SECRET",
      "TIKTOK_REDIRECT_URI",
    ],
    setupNote: "Requires TikTok developer approval and the relevant Content Posting scopes.",
  },
  {
    id: "google_business",
    name: "Google Business Profile",
    description: "Business profile posts and performance data where supported.",
    capabilities: ["account_profile", "image_publish", "engagement_metrics"],
    requiredEnvironment: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
    ],
    setupNote: "Requires Google OAuth verification and Business Profile API access.",
  },
  {
    id: "messenger",
    name: "Messenger",
    description: "Facebook Page conversations and customer replies.",
    capabilities: [
      "account_profile",
      "conversations",
      "send_message",
      "media_messages",
    ],
    requiredEnvironment: [
      "META_APP_ID",
      "META_APP_SECRET",
      "META_WEBHOOK_VERIFY_TOKEN",
    ],
    setupNote: "Requires a reviewed Meta app and Page messaging permissions.",
  },
] as const;

export function getSocialProvider(provider: string) {
  return socialProviders.find((item) => item.id === provider) ?? null;
}

export function providerSupports(
  provider: SocialProviderDefinition,
  capability: SocialCapability,
) {
  return provider.capabilities.includes(capability);
}

export function getGrantedSocialCapabilities(
  providerId: string,
  capabilities: unknown,
): SocialCapability[] {
  const provider = getSocialProvider(providerId);
  if (!provider || !Array.isArray(capabilities)) return [];
  return capabilities.filter(
    (capability): capability is SocialCapability =>
      typeof capability === "string" &&
      provider.capabilities.includes(capability as SocialCapability),
  );
}

export function connectionGrantsPublishing(
  providerId: string,
  capabilities: unknown,
) {
  const granted = getGrantedSocialCapabilities(providerId, capabilities);
  return (
    granted.includes("image_publish") || granted.includes("video_publish")
  );
}

export function connectionStatusLabel(status: SocialConnectionStatus) {
  const labels: Record<SocialConnectionStatus, string> = {
    not_configured: "Requires API configuration",
    connecting: "Connecting",
    connected: "Connected",
    token_expired: "Token expired",
    action_required: "Action required",
    authentication_failed: "Authentication failed",
    permission_missing: "Permission missing",
    syncing: "Syncing",
    error: "Error",
    disabled: "Disabled",
  };
  return labels[status];
}
