import { describe, expect, it } from "vitest";

import { createConfigurationRequiredSocialAdapter } from "@/lib/integrations/social-adapter";
import { socialProviders } from "@/lib/integrations/social-provider";

describe("social provider adapter contract", () => {
  it("exposes only capabilities declared by each provider", () => {
    const instagram = createConfigurationRequiredSocialAdapter(
      socialProviders.find((provider) => provider.id === "instagram")!,
    );
    const whatsapp = createConfigurationRequiredSocialAdapter(
      socialProviders.find((provider) => provider.id === "whatsapp")!,
    );

    expect(instagram.publishPost).toBeTypeOf("function");
    expect(instagram.sendMessage).toBeUndefined();
    expect(whatsapp.publishPost).toBeUndefined();
    expect(whatsapp.sendMessage).toBeTypeOf("function");
  });

  it("fails closed rather than manufacturing a connection", async () => {
    const telegram = createConfigurationRequiredSocialAdapter(
      socialProviders.find((provider) => provider.id === "telegram")!,
    );

    await expect(telegram.beginConnection("signed-state")).resolves.toMatchObject({
      ok: false,
      code: "not_configured",
      retryable: false,
    });
  });
});
