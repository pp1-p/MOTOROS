export type HeaderReader = Pick<Headers, "get">;

const hostnameLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function singleHeaderValue(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(",")) return null;
  return trimmed;
}

/**
 * Returns a lower-case ASCII hostname with ports and a final dot removed.
 * Values containing credentials, paths, control characters or forwarded-host
 * lists are rejected rather than partially parsed.
 */
export function normaliseHostname(value: string | null | undefined) {
  const candidate = singleHeaderValue(value ?? null);
  if (
    !candidate ||
    candidate.includes("://") ||
    candidate.includes("/") ||
    candidate.includes("\\") ||
    candidate.includes("@") ||
    /[\u0000-\u0020\u007f]/.test(candidate)
  ) {
    return null;
  }

  try {
    const parsed = new URL(`http://${candidate}`);
    let hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      hostname = hostname.slice(1, -1);
    }
    if (!hostname || hostname.length > 253) return null;
    if (hostname === "::1") return hostname;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
      return hostname
        .split(".")
        .every((part) => Number(part) >= 0 && Number(part) <= 255)
        ? hostname
        : null;
    }
    return hostname.split(".").every((label) => hostnameLabel.test(label))
      ? hostname
      : null;
  } catch {
    return null;
  }
}

export function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.")
  );
}

export function subdomainForHostname(
  hostname: string,
  baseDomain?: string | null,
) {
  const normalisedHost = normaliseHostname(hostname);
  if (!normalisedHost) return null;

  const normalisedBase = normaliseHostname(baseDomain);
  if (normalisedBase) {
    const suffix = `.${normalisedBase}`;
    if (normalisedHost.endsWith(suffix)) {
      const candidate = normalisedHost.slice(0, -suffix.length);
      return hostnameLabel.test(candidate) ? candidate : null;
    }
  }

  if (normalisedHost.endsWith(".localhost")) {
    const candidate = normalisedHost.slice(0, -".localhost".length);
    return hostnameLabel.test(candidate) ? candidate : null;
  }

  return null;
}

export function requestHostname(
  requestHeaders: HeaderReader,
  options: { trustForwardedHost?: boolean } = {},
) {
  const forwarded = options.trustForwardedHost
    ? singleHeaderValue(requestHeaders.get("x-forwarded-host"))
    : null;
  return normaliseHostname(forwarded ?? requestHeaders.get("host"));
}

function safeAuthority(value: string | null, expectedHostname: string) {
  const candidate = singleHeaderValue(value);
  if (!candidate || normaliseHostname(candidate) !== expectedHostname) {
    return expectedHostname === "::1" ? "[::1]" : expectedHostname;
  }
  try {
    return new URL(`http://${candidate}`).host;
  } catch {
    return expectedHostname === "::1" ? "[::1]" : expectedHostname;
  }
}

export function requestOrigin(
  requestHeaders: HeaderReader,
  hostname: string,
  options: { trustForwardedHost?: boolean } = {},
) {
  const rawHost = options.trustForwardedHost
    ? singleHeaderValue(requestHeaders.get("x-forwarded-host")) ??
      requestHeaders.get("host")
    : requestHeaders.get("host");
  const forwardedProtocol = options.trustForwardedHost
    ? singleHeaderValue(requestHeaders.get("x-forwarded-proto"))
    : null;
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : isLocalHostname(hostname)
        ? "http"
        : "https";

  return `${protocol}://${safeAuthority(rawHost, hostname)}`;
}
