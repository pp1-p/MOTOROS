import "server-only";

type LogLevel = "info" | "warn" | "error";

const sensitiveKeys = new Set([
  "email",
  "phone",
  "telephone",
  "registration",
  "vin",
  "password",
  "token",
  "secret",
  "address",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redact(item),
      ]),
    );
  }
  return value;
}

export function log(
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {},
) {
  const safeContext = redact(context);
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(safeContext && typeof safeContext === "object" ? safeContext : {}),
  });

  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.info(payload);
}
