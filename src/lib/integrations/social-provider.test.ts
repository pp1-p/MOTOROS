import { describe, expect, it } from "vitest";

import {
  connectionGrantsPublishing,
  getGrantedSocialCapabilities,
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

  it("requires a real granted publishing capability", () => {
    expect(connectionGrantsPublishing("instagram", [])).toBe(false);
    expect(connectionGrantsPublishing("instagram", ["comments"])).toBe(false);
    expect(
      connectionGrantsPublishing("instagram", ["image_publish"]),
    ).toBe(true);
    expect(
      connectionGrantsPublishing("whatsapp", ["image_publish"]),
    ).toBe(false);
    expect(
      getGrantedSocialCapabilities("instagram", [
        "image_publish",
        "send_message",
      ]),
    ).toEqual(["image_publish"]);
  });
});
