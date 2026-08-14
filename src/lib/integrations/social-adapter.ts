import {
  providerSupports,
  type SocialProviderDefinition,
} from "@/lib/integrations/social-provider";

export type SocialAdapterErrorCode =
  | "not_configured"
  | "unsupported_capability"
  | "authentication_failed"
  | "permission_missing"
  | "rate_limited"
  | "provider_unavailable"
  | "invalid_request";

export type SocialAdapterResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: SocialAdapterErrorCode;
      message: string;
      retryable: boolean;
    };

export type SocialAccountInformation = {
  externalAccountId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export type SocialMediaInput = {
  sourceUrl: string;
  mediaType: "image" | "video";
  altText?: string;
};

export type SocialPublishInput = {
  idempotencyKey: string;
  caption: string;
  media: readonly SocialMediaInput[];
  callToAction?: string;
};

export type SocialMessageInput = {
  conversationExternalId: string;
  idempotencyKey: string;
  body: string;
  media?: readonly SocialMediaInput[];
};

export interface SocialProviderAdapter {
  readonly definition: SocialProviderDefinition;
  beginConnection(
    state: string,
  ): Promise<SocialAdapterResult<{ authorizationUrl: string }>>;
  disconnect(): Promise<SocialAdapterResult<{ disconnected: true }>>;
  refreshConnection(): Promise<SocialAdapterResult<SocialAccountInformation>>;
  fetchAccountInformation(): Promise<
    SocialAdapterResult<SocialAccountInformation>
  >;
  publishPost?: (
    input: SocialPublishInput,
  ) => Promise<SocialAdapterResult<{ externalPostId: string; publishedAt: string }>>;
  uploadMedia?: (
    input: SocialMediaInput,
  ) => Promise<SocialAdapterResult<{ externalMediaId: string }>>;
  fetchMessages?: (
    cursor?: string,
  ) => Promise<
    SocialAdapterResult<{ messages: readonly unknown[]; nextCursor: string | null }>
  >;
  sendMessage?: (
    input: SocialMessageInput,
  ) => Promise<SocialAdapterResult<{ externalMessageId: string }>>;
  fetchEngagement?: (
    since: string,
  ) => Promise<SocialAdapterResult<{ metrics: Record<string, number> }>>;
}

function configurationRequired<T>(
  provider: SocialProviderDefinition,
): Promise<SocialAdapterResult<T>> {
  return Promise.resolve({
    ok: false,
    code: "not_configured",
    message: `${provider.name} requires an approved provider adapter and server-side API configuration.`,
    retryable: false,
  });
}

/**
 * Fail-closed adapter used until a provider-specific implementation has been
 * installed. It declares only supported operations and can never return a
 * fabricated connection, post, message or metric.
 */
export function createConfigurationRequiredSocialAdapter(
  definition: SocialProviderDefinition,
): SocialProviderAdapter {
  const adapter: SocialProviderAdapter = {
    definition,
    beginConnection: () => configurationRequired(definition),
    disconnect: () => configurationRequired(definition),
    refreshConnection: () => configurationRequired(definition),
    fetchAccountInformation: () => configurationRequired(definition),
  };

  if (
    providerSupports(definition, "image_publish") ||
    providerSupports(definition, "video_publish")
  ) {
    adapter.publishPost = () => configurationRequired(definition);
    adapter.uploadMedia = () => configurationRequired(definition);
  }
  if (providerSupports(definition, "conversations")) {
    adapter.fetchMessages = () => configurationRequired(definition);
  }
  if (providerSupports(definition, "send_message")) {
    adapter.sendMessage = () => configurationRequired(definition);
  }
  if (providerSupports(definition, "engagement_metrics")) {
    adapter.fetchEngagement = () => configurationRequired(definition);
  }

  return adapter;
}
