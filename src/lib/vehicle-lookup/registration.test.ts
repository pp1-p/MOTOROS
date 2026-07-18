import { describe, expect, it } from "vitest";

import { validateAndNormaliseRegistration } from "@/lib/vehicle-lookup/registration";

describe("UK registration validation", () => {
  it.each([
    ["ab12 cde", "AB12CDE"],
    ["A123 BCD", "A123BCD"],
    ["ABC 123D", "ABC123D"],
    ["1234 AB", "1234AB"],
  ])("normalises %s", (input, expected) => {
    expect(validateAndNormaliseRegistration(input)).toBe(expected);
  });

  it.each(["", "HELLO!", "123456789", "A"])("rejects %s", (input) => {
    expect(() => validateAndNormaliseRegistration(input)).toThrow(
      "valid UK registration",
    );
  });
});
