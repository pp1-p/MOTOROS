import { describe, expect, it } from "vitest";

import { MockVehicleLookupProvider } from "@/lib/vehicle-lookup/mock";

describe("mock vehicle provider", () => {
  it("returns only an explicit fixture and marks it partial", async () => {
    const result = await new MockVehicleLookupProvider().lookupByRegistration(
      "DE24LER",
    );
    expect(result.provider).toBe("mock");
    expect(result.make).toBe("VOLVO");
    expect(result.partial).toBe(true);
    expect(result).not.toHaveProperty("model");
  });

  it("does not invent an unknown vehicle", async () => {
    await expect(
      new MockVehicleLookupProvider().lookupByRegistration("ZZ99ZZZ"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
