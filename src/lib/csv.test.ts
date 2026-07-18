import { describe, expect, it } from "vitest";

import { neutraliseSpreadsheetFormula, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quoted commas and escaped quotes", () => {
    const rows = parseCsv(
      'registration,make,description\r\nAB12CDE,Ford,"Smart, clean and ""ready"""',
    );
    expect(rows).toEqual([
      {
        rowNumber: 2,
        values: {
          registration: "AB12CDE",
          make: "Ford",
          description: 'Smart, clean and "ready"',
        },
      },
    ]);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('registration,description\nAB12CDE,"broken')).toThrow(
      "unterminated",
    );
  });
});

describe("neutraliseSpreadsheetFormula", () => {
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd"])(
    "neutralises formula-like value %s",
    (value) => {
      expect(neutraliseSpreadsheetFormula(value)).toBe(`'${value}`);
    },
  );
});
