import { describe, expect, it } from "vitest";

import {
  getSocialProvider,
  providerSupports,
  socialProviders,
} from "@/lib/integrations/social-provider";

describe("social provider capabilities", () => {
  it("keeps provider-specific controls capability aware", () => {
    const instagram = getSocialProvider("instagram");
    const whatsapp = getSocialProvider("whatsapp");
    expect(instagram).not.toBeNull();
    expect(whatsapp).not.toBeNull();
    expect(providerSupports(instagram!, "image_publish")).toBe(true);
    expect(providerSupports(instagram!, "send_message")).toBe(false);
    expect(providerSupports(whatsapp!, "send_message")).toBe(true);
    expect(providerSupports(whatsapp!, "image_publish")).toBe(false);
  });

  it("documents server-side configuration for every provider", () => {
    for (const provider of socialProviders) {
      expect(provider.requiredEnvironment.length).toBeGreaterThan(0);
      expect(provider.setupNote.length).toBeGreaterThan(20);
    }
  });
});
