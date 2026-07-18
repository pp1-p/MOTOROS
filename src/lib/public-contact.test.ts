import { describe, expect, it } from "vitest";

import { getPublicContactDetails } from "@/lib/public-contact";

describe("getPublicContactDetails", () => {
  it("does not create links or rows for blank public settings", () => {
    expect(
      getPublicContactDetails({
        phone: "  ",
        email: "",
        address: "  ",
        hours: [{ days: "Monday", times: " " }],
      }),
    ).toEqual({
      phone: null,
      phoneHref: null,
      email: null,
      emailHref: null,
      address: null,
      hours: [],
    });
  });

  it("trims published details and creates usable contact links", () => {
    expect(
      getPublicContactDetails({
        phone: " +44 (0)20 1234 5678 ",
        email: " hello@example.com ",
        address: " 1 High Street, London ",
        hours: [{ days: " Monday ", times: " 09:00 - 17:00 " }],
      }),
    ).toEqual({
      phone: "+44 (0)20 1234 5678",
      phoneHref: "tel:+4402012345678",
      email: "hello@example.com",
      emailHref: "mailto:hello@example.com",
      address: "1 High Street, London",
      hours: [{ days: "Monday", times: "09:00 - 17:00" }],
    });
  });

  it("rejects unusable phone and email values", () => {
    const details = getPublicContactDetails({
      phone: "not published",
      email: "not published",
    });

    expect(details.phoneHref).toBeNull();
    expect(details.emailHref).toBeNull();
  });
});
