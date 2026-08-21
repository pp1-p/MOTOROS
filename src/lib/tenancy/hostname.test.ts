import { describe, expect, it } from "vitest";

import {
  isLocalHostname,
  normaliseHostname,
  requestHostname,
  requestOrigin,
  subdomainForHostname,
} from "@/lib/tenancy/hostname";

describe("tenant hostname parsing", () => {
  it("normalises case, ports and a final dot", () => {
    expect(normaliseHostname(" Direct-Motors.Example.COM.:443 ")).toBe(
      "direct-motors.example.com",
    );
  });

  it("rejects forwarded lists, credentials and paths", () => {
    expect(normaliseHostname("good.example, attacker.example")).toBeNull();
    expect(normaliseHostname("user@good.example")).toBeNull();
    expect(normaliseHostname("good.example/path")).toBeNull();
  });

  it("extracts exactly one tenant label from the configured base domain", () => {
    expect(
      subdomainForHostname("apex-performance.motoros.co.uk", "motoros.co.uk"),
    ).toBe("apex-performance");
    expect(subdomainForHostname("nested.apex.motoros.co.uk", "motoros.co.uk"))
      .toBeNull();
    expect(subdomainForHostname("motoros.co.uk", "motoros.co.uk")).toBeNull();
  });

  it("supports browser-resolvable localhost subdomains", () => {
    expect(subdomainForHostname("hartwell-prestige.localhost")).toBe(
      "hartwell-prestige",
    );
    expect(isLocalHostname("hartwell-prestige.localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
  });

  it("ignores X-Forwarded-Host unless the deployment explicitly trusts it", () => {
    const headers = new Headers({
      host: "direct-motors.motoros.co.uk",
      "x-forwarded-host": "attacker.example",
    });
    expect(requestHostname(headers)).toBe("direct-motors.motoros.co.uk");
    expect(requestHostname(headers, { trustForwardedHost: true })).toBe(
      "attacker.example",
    );
  });

  it("keeps a safe localhost port in the request origin", () => {
    const headers = new Headers({ host: "apex-performance.localhost:3000" });
    expect(requestOrigin(headers, "apex-performance.localhost")).toBe(
      "http://apex-performance.localhost:3000",
    );
  });
});
