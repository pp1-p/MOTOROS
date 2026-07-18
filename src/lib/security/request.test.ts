import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_APP_URL: "https://motoros.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    DEALEROS_PUBLIC_ORGANISATION_ID: "00000000-0000-4000-8000-000000000001",
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({ rpc: rpcMock }),
}));

import { checkSharedRateLimit } from "@/lib/security/request";

describe("checkSharedRateLimit", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("uses the shared database counter when it is available", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const result = await checkSharedRateLimit("shared-success", {
      action: "auth_sign_in",
      limit: 10,
      windowMs: 15 * 60_000,
    });

    expect(result.allowed).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("consume_public_rate_limit", {
      target_organisation_id: "00000000-0000-4000-8000-000000000001",
      target_action: "auth_sign_in",
      client_token: "shared-success",
      maximum_attempts: 10,
      window_minutes: 15,
    });
  });

  it("returns a shared rate-limit rejection", async () => {
    rpcMock.mockResolvedValue({
      error: { code: "P0001", message: "Too many submissions. Please try again later." },
    });

    const result = await checkSharedRateLimit("shared-denied", {
      action: "auth_password_reset",
      limit: 5,
      windowMs: 30 * 60_000,
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1800,
    });
  });

  it("falls back to the local counter when the database is unavailable", async () => {
    rpcMock.mockRejectedValue(new Error("temporarily unavailable"));
    const options = { action: "auth_sign_in", limit: 1, windowMs: 60_000 };

    expect((await checkSharedRateLimit("shared-fallback", options)).allowed).toBe(true);
    expect((await checkSharedRateLimit("shared-fallback", options)).allowed).toBe(false);
  });
});
