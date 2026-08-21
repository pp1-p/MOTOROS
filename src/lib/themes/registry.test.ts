import { describe, expect, it } from "vitest";

import {
  THEME_IDS,
  contrastRatio,
  getThemeDefinition,
  getThemeStyle,
  isThemeId,
  resolveDraftThemeId,
  resolvePublishedThemeId,
  themeDefinitions,
} from "./registry";

describe("public theme registry", () => {
  it("registers exactly the four supported stable theme IDs", () => {
    expect(THEME_IDS).toEqual([
      "direct-motors-classic",
      "modern-marketplace",
      "prestige",
      "performance",
    ]);
    expect(themeDefinitions.map((theme) => theme.id)).toEqual(THEME_IDS);
    expect(new Set(themeDefinitions.map((theme) => theme.layout.home)).size).toBe(4);
    expect(new Set(themeDefinitions.map((theme) => theme.layout.header)).size).toBe(4);
  });

  it("falls back safely when stored theme values are unknown", () => {
    expect(isThemeId("prestige")).toBe(true);
    expect(isThemeId("copied-template")).toBe(false);
    expect(getThemeDefinition("copied-template").id).toBe("direct-motors-classic");
    expect(resolvePublishedThemeId({ publishedThemeId: "performance" })).toBe(
      "performance",
    );
    expect(resolveDraftThemeId({
      publishedThemeId: "prestige",
      draftThemeId: "unknown",
    })).toBe("prestige");
  });

  it("rejects an inaccessible tenant primary colour in favour of theme defaults", () => {
    const style = getThemeStyle("modern-marketplace", {
      primaryColour: "#ffffff",
      accentColour: "#ffb000",
    }) as Record<string, string>;
    expect(style["--brand"]).toBe("#155eef");
    expect(
      contrastRatio(style["--brand"]!, style["--background"]!),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(style["--text-on-brand"]!, style["--brand"]!),
    ).toBeGreaterThan(3);
  });
});
