import "server-only";

import { getServerEnv } from "@/lib/env";

export type DomainVerificationChallenge = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type DomainDnsRecommendation = {
  type: "A" | "CNAME";
  name: string;
  value: string;
};

export type VercelDomainProvisioningResult = {
  hostname: string;
  addedToProject: boolean;
  verified: boolean;
  misconfigured: boolean;
  ready: boolean;
  verification: DomainVerificationChallenge[];
  dnsRecommendations: DomainDnsRecommendation[];
};

type ProjectDomain = {
  name?: unknown;
  verified?: unknown;
  verification?: unknown;
};

type DomainConfig = {
  misconfigured?: unknown;
  recommendedIPv4?: unknown;
  recommendedCNAME?: unknown;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type VercelDomainClientConfig = {
  token: string;
  projectIdOrName: string;
  teamId?: string | null;
};

export class VercelDomainProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "VercelDomainProvisioningError";
  }
}

function verificationChallenges(value: unknown): DomainVerificationChallenge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.type !== "string" ||
      typeof candidate.domain !== "string" ||
      typeof candidate.value !== "string"
    ) {
      return [];
    }
    return [
      {
        type: candidate.type,
        domain: candidate.domain,
        value: candidate.value,
        reason: typeof candidate.reason === "string" ? candidate.reason : "",
      },
    ];
  });
}

function recommendationValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [entry.trim()];
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.value === "string" && candidate.value.trim()
      ? [candidate.value.trim()]
      : [];
  });
}

export function normaliseDnsRecommendations(
  hostname: string,
  config: DomainConfig,
): DomainDnsRecommendation[] {
  const records: DomainDnsRecommendation[] = [];
  for (const value of recommendationValues(config.recommendedIPv4)) {
    records.push({ type: "A", name: hostname, value });
  }
  for (const value of recommendationValues(config.recommendedCNAME)) {
    records.push({ type: "CNAME", name: hostname, value });
  }
  return records;
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function providerError(body: Record<string, unknown>) {
  const nested = body.error;
  if (!nested || typeof nested !== "object") return { code: null, message: null };
  const error = nested as Record<string, unknown>;
  return {
    code: typeof error.code === "string" ? error.code : null,
    message: typeof error.message === "string" ? error.message : null,
  };
}

export function createVercelDomainClient(
  config: VercelDomainClientConfig,
  fetchImpl: FetchLike = fetch,
) {
  const project = encodeURIComponent(config.projectIdOrName);
  const scope = (url: URL) => {
    if (config.teamId) url.searchParams.set("teamId", config.teamId);
    return url;
  };

  async function request<T extends Record<string, unknown>>(
    url: URL,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.token}`);
    headers.set("Content-Type", "application/json");
    const response = await fetchImpl(url, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });
    const body = await responseBody(response);
    if (!response.ok) {
      const error = providerError(body);
      throw new VercelDomainProvisioningError(
        error.message ?? `Vercel domain request failed with HTTP ${response.status}.`,
        response.status,
        error.code,
      );
    }
    return body as T;
  }

  async function getProjectDomain(hostname: string): Promise<ProjectDomain | null> {
    const url = scope(
      new URL(
        `https://api.vercel.com/v9/projects/${project}/domains/${encodeURIComponent(hostname)}`,
      ),
    );
    try {
      return await request<ProjectDomain & Record<string, unknown>>(url);
    } catch (error) {
      if (error instanceof VercelDomainProvisioningError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async function addProjectDomain(hostname: string): Promise<ProjectDomain> {
    const url = scope(
      new URL(`https://api.vercel.com/v10/projects/${project}/domains`),
    );
    try {
      return await request<ProjectDomain & Record<string, unknown>>(url, {
        method: "POST",
        body: JSON.stringify({ name: hostname }),
      });
    } catch (error) {
      // A concurrent/repeated provisioning request can lose the race between the
      // GET above and Vercel's create call. Re-read the project domain before
      // surfacing a create conflict; never ignore a conflict belonging elsewhere.
      if (
        error instanceof VercelDomainProvisioningError &&
        (error.status === 400 || error.status === 409)
      ) {
        const existing = await getProjectDomain(hostname);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async function verifyProjectDomain(hostname: string): Promise<ProjectDomain> {
    const url = scope(
      new URL(
        `https://api.vercel.com/v9/projects/${project}/domains/${encodeURIComponent(hostname)}/verify`,
      ),
    );
    return request<ProjectDomain & Record<string, unknown>>(url, { method: "POST" });
  }

  async function getDomainConfig(hostname: string): Promise<DomainConfig> {
    const url = scope(
      new URL(`https://api.vercel.com/v6/domains/${encodeURIComponent(hostname)}/config`),
    );
    url.searchParams.set("projectIdOrName", config.projectIdOrName);
    return request<DomainConfig & Record<string, unknown>>(url);
  }

  return {
    async provision(hostname: string): Promise<VercelDomainProvisioningResult> {
      let domain = await getProjectDomain(hostname);
      const addedToProject = domain === null;
      if (!domain) domain = await addProjectDomain(hostname);

      if (domain.verified !== true) {
        try {
          domain = await verifyProjectDomain(hostname);
          if (domain.verified !== true) {
            domain = (await getProjectDomain(hostname)) ?? domain;
          }
        } catch (error) {
          // Vercel can return a client error while the ownership/DNS challenge is
          // still incomplete. Re-read only expected provisioning conflicts so
          // authentication/permission failures remain visible to the operator.
          if (
            error instanceof VercelDomainProvisioningError &&
            (error.status === 400 || error.status === 409)
          ) {
            domain = (await getProjectDomain(hostname)) ?? domain;
          } else {
            throw error;
          }
        }
      }

      const domainConfig = await getDomainConfig(hostname);
      const verified = domain.verified === true;
      const misconfigured = domainConfig.misconfigured !== false;
      return {
        hostname,
        addedToProject,
        verified,
        misconfigured,
        ready: verified && !misconfigured,
        verification: verificationChallenges(domain.verification),
        dnsRecommendations: normaliseDnsRecommendations(hostname, domainConfig),
      };
    },
  };
}

export function getVercelDomainClient() {
  const env = getServerEnv();
  if (!env.MOTOROS_VERCEL_API_TOKEN || !env.MOTOROS_VERCEL_PROJECT_ID) {
    throw new VercelDomainProvisioningError(
      "Custom-domain provisioning is not configured for this MotorOS deployment.",
    );
  }
  return createVercelDomainClient({
    token: env.MOTOROS_VERCEL_API_TOKEN,
    projectIdOrName: env.MOTOROS_VERCEL_PROJECT_ID,
    teamId: env.MOTOROS_VERCEL_TEAM_ID,
  });
}
