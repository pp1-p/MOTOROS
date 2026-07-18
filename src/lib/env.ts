import "server-only";

import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl.default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DEALEROS_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  DEALEROS_PUBLIC_ORGANISATION_ID: z.uuid().optional(),
  VEHICLE_LOOKUP_PROVIDER: z.enum(["mock", "dvla", "autotrader", "manual"]).default("mock"),
  DVLA_VES_API_KEY: z.string().optional(),
  DVLA_VES_BASE_URL: optionalUrl.default(
    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
  ),
  AUTOTRADER_CLIENT_ID: z.string().optional(),
  AUTOTRADER_CLIENT_SECRET: z.string().optional(),
  AUTOTRADER_ADVERTISER_ID: z.string().optional(),
  AUTOTRADER_API_BASE_URL: optionalUrl,
  AUTOTRADER_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid DealerOS environment: ${z.prettifyError(parsed.error)}`,
    );
  }

  if (
    parsed.data.EMAIL_PROVIDER === "resend" &&
    (!parsed.data.RESEND_API_KEY || !parsed.data.EMAIL_FROM)
  ) {
    throw new Error("Resend is selected but RESEND_API_KEY or EMAIL_FROM is missing.");
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isSupabaseConfigured() {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getEnvironmentHealth() {
  const env = getServerEnv();
  return {
    supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    vehicleLookup:
      env.VEHICLE_LOOKUP_PROVIDER === "mock" ||
      env.VEHICLE_LOOKUP_PROVIDER === "manual" ||
      (env.VEHICLE_LOOKUP_PROVIDER === "dvla" && Boolean(env.DVLA_VES_API_KEY)) ||
      (env.VEHICLE_LOOKUP_PROVIDER === "autotrader" &&
        Boolean(env.AUTOTRADER_CLIENT_ID && env.AUTOTRADER_CLIENT_SECRET)),
    email: env.EMAIL_PROVIDER === "console" || Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    sms: false,
  };
}
