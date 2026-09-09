import { describe, expect, it } from "vitest";

import {
  createVercelDomainClient,
  normaliseDnsRecommendations,
} from "./vercel-domains";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Vercel custom-domain provisioning", () => {
  it("adds a missing domain and only reports ready after verification and DNS/TLS pass", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const responses = [
      json({ error: { code: "not_found", message: "Domain not found" } }, 404),
      json({
        name: "www.dealer.example",
        projectId: "project",
        verified: false,
        verification: [
          {
            type: "TXT",
            domain: "_vercel.www.dealer.example",
            value: "verification-value",
            reason: "ownership",
          },
        ],
      }),
      json({ name: "www.dealer.example", projectId: "project", verified: true }),
      json({
        misconfigured: false,
        recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns.com" }],
      }),
    ];
    const client = createVercelDomainClient(
      { token: "secret", projectIdOrName: "motoros", teamId: "team_123" },
      async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "GET",
        });
        const response = responses.shift();
        if (!response) throw new Error("Unexpected fetch");
        return response;
      },
    );

    const result = await client.provision("www.dealer.example");

    expect(result).toMatchObject({
      addedToProject: true,
      verified: true,
      misconfigured: false,
      ready: true,
    });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "POST", "GET"]);
    expect(calls.every((call) => call.url.includes("teamId=team_123"))).toBe(true);
    expect(calls[3]?.url).toContain("projectIdOrName=motoros");
  });

  it("keeps a domain non-live when ownership is verified but DNS/TLS is misconfigured", async () => {
    const responses = [
      json({ name: "dealer.example", projectId: "project", verified: true }),
      json({
        misconfigured: true,
        recommendedIPv4: [{ rank: 1, value: "76.76.21.21" }],
      }),
    ];
    const client = createVercelDomainClient(
      { token: "secret", projectIdOrName: "motoros" },
      async () => {
        const response = responses.shift();
        if (!response) throw new Error("Unexpected fetch");
        return response;
      },
    );

    const result = await client.provision("dealer.example");

    expect(result.verified).toBe(true);
    expect(result.misconfigured).toBe(true);
    expect(result.ready).toBe(false);
    expect(result.dnsRecommendations).toEqual([
      { type: "A", name: "dealer.example", value: "76.76.21.21" },
    ]);
  });

  it("returns Vercel ownership challenges while verification is pending", async () => {
    const challenge = {
      type: "TXT",
      domain: "_vercel.dealer.example",
      value: "verify-me",
      reason: "ownership",
    };
    const responses = [
      json({
        name: "dealer.example",
        projectId: "project",
        verified: false,
        verification: [challenge],
      }),
      json({
        name: "dealer.example",
        projectId: "project",
        verified: false,
        verification: [challenge],
      }),
      json({
        misconfigured: true,
        recommendedCNAME: ["cname.vercel-dns.com"],
      }),
    ];
    const client = createVercelDomainClient(
      { token: "secret", projectIdOrName: "motoros" },
      async () => {
        const response = responses.shift();
        if (!response) throw new Error("Unexpected fetch");
        return response;
      },
    );

    const result = await client.provision("dealer.example");

    expect(result.ready).toBe(false);
    expect(result.verification).toEqual([challenge]);
    expect(result.dnsRecommendations).toEqual([
      { type: "CNAME", name: "dealer.example", value: "cname.vercel-dns.com" },
    ]);
  });
});

describe("DNS recommendation normalisation", () => {
  it("ignores malformed provider values rather than showing unsafe instructions", () => {
    expect(
      normaliseDnsRecommendations("dealer.example", {
        misconfigured: true,
        recommendedIPv4: [null, {}, { value: "1.2.3.4" }],
        recommendedCNAME: [{ value: 123 }, "target.vercel-dns.com"],
      }),
    ).toEqual([
      { type: "A", name: "dealer.example", value: "1.2.3.4" },
      {
        type: "CNAME",
        name: "dealer.example",
        value: "target.vercel-dns.com",
      },
    ]);
  });
});
