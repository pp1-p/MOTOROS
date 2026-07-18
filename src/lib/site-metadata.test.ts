import { describe, expect, it } from "vitest";

import {
  buildPublicSeoTitle,
  getSiteLogoInitial,
  isSiteIndexable,
} from "@/lib/site-metadata";

describe("public site metadata", () => {
  it("replaces a legacy DealerOS suffix with the public dealership name", () => {
    expect(
      buildPublicSeoTitle(
        "Used Cars, Car Sourcing & Repairs | DealerOS",
        "MOTOROS",
      ),
    ).toBe("Used Cars, Car Sourcing & Repairs | MOTOROS");
  });

  it("does not duplicate an existing public brand suffix", () => {
    expect(buildPublicSeoTitle("Used cars | MOTOROS", "MOTOROS")).toBe(
      "Used cars | MOTOROS",
    );
  });

  it("normalises en-dash and em-dash brand suffixes", () => {
    expect(buildPublicSeoTitle("Used cars \u2013 DealerOS", "MOTOROS")).toBe(
      "Used cars | MOTOROS",
    );
    expect(buildPublicSeoTitle("Used cars \u2014 MOTOROS", "MOTOROS")).toBe(
      "Used cars | MOTOROS",
    );
  });

  it("uses the configured dealership initial", () => {
    expect(getSiteLogoInitial("  MOTOROS ")).toBe("M");
    expect(getSiteLogoInitial("Direct Motors")).toBe("D");
  });

  it("requires an explicit true value before indexing", () => {
    expect(isSiteIndexable(undefined)).toBe(false);
    expect(isSiteIndexable("false")).toBe(false);
    expect(isSiteIndexable(" TRUE ")).toBe(true);
  });
});
