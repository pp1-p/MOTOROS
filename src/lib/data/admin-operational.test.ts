import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  getStaffContext: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  getStaffContext: mocks.getStaffContext,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ DEALEROS_DEMO_MODE: "false" }),
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

import { getAdminLeadList } from "@/lib/data/admin-operational";

function queryResult(data: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: { data: unknown[]; error: null }) => unknown,
  ) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}

describe("operational admin data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStaffContext.mockResolvedValue({
      userId: "user-1",
      email: "owner@example.test",
      organisationId: "org-1",
      organisationName: "Example Motors",
      role: "owner",
      displayName: "Owner",
    });
  });

  it("uses the session-bound Supabase client so database RLS scopes reads", async () => {
    const supabase = {
      from: vi.fn(() => queryResult([])),
    };
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);

    const result = await getAdminLeadList();

    expect(mocks.createServerSupabaseClient).toHaveBeenCalledOnce();
    expect(supabase.from).toHaveBeenCalledWith("leads");
    expect(result.leads).toEqual([]);
    expect(result.metrics.open).toBe(0);
  });
});
