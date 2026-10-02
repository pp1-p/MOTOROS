import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("optional environment configuration", () => {
  it("treats deliberately empty Supabase credentials as unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", " "); vi.stubEnv("EMAIL_PROVIDER", "console");
    const { getServerEnv, isSupabaseConfigured } = await import("./env");
    expect(getServerEnv().SUPABASE_SERVICE_ROLE_KEY).toBeUndefined(); expect(getServerEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined(); expect(isSupabaseConfigured()).toBe(false);
  });
});
