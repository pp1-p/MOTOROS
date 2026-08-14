import { describe, expect, it } from "vitest";

import {
  getWebsiteTheme,
  selectWebsiteTheme,
  websiteThemes,
} from "@/lib/website/themes";

describe("website themes", () => {
  it("provides four stable internal theme identifiers", () => {
    expect(websiteThemes.map((theme) => theme.id)).toEqual([
      "modern",
      "performance",
      "classic",
      "luxury",
    ]);
  });

  it("falls back safely to Modern for unknown stored values", () => {
    expect(getWebsiteTheme("removed-theme").id).toBe("modern");
  });

  it("changes presentation without changing dealership content", () => {
    const content = { name: "Direct Motors", vehicleIds: ["car-1", "car-2"] };
    const result = selectWebsiteTheme(content, "luxury");
    expect(result.themeId).toBe("luxury");
    expect(result.content).toBe(content);
    expect(result.content).toEqual(content);
  });
});
