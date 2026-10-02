import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), demo: vi.fn(), submissions: vi.fn(), client: vi.fn(), tenant: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/demo/store", () => ({ isDevelopmentDemoMode: mocks.demo, getDemoSubmissions: mocks.submissions }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.client }));
vi.mock("@/lib/tenancy/public-tenant", () => ({ getPublicTenant: mocks.tenant }));
import { getAvailableRepairCallSlots } from "./availability";
const rule = { day_of_week: 3, start_time: "09:00:00", end_time: "17:00:00", slot_duration_minutes: 30, buffer_minutes: 10, minimum_notice_hours: 24, maximum_advance_days: 45, maximum_simultaneous: 1, timezone: "Europe/London" };
type Result = { data: unknown; error: null | { message: string } };
let results: Record<string, Result>;
let filters: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  mocks.configured.mockReturnValue(false); mocks.demo.mockReturnValue(true); mocks.submissions.mockReturnValue([]);
  mocks.tenant.mockResolvedValue({ organisationId: "test-tenant" });
  results = { availability_rules: { data: rule, error: null }, availability_exceptions: { data: null, error: null }, appointments: { data: [], error: null } };
  filters = vi.fn();
  mocks.client.mockReturnValue({ from: (table: string) => {
    const chain = { select: vi.fn(), eq: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(), lt: vi.fn(), gt: vi.fn(), not: vi.fn(), then: (resolve: (value: Result | undefined) => unknown) => Promise.resolve(results[table]).then(resolve) };
    for (const method of ["select", "limit", "maybeSingle", "lt", "gt", "not"] as const) chain[method].mockReturnValue(chain);
    chain.eq.mockImplementation((...args: unknown[]) => { filters(table, ...args); return chain; });
    return chain;
  } });
});
afterEach(() => vi.useRealTimers());
describe("repair-call availability", () => {
  it("uses local time and respects weekends and notice", async () => {
    expect((await getAvailableRepairCallSlots("2026-10-07"))[0]?.start).toBe("2026-10-07T08:00:00.000Z");
    expect(await getAvailableRepairCallSlots("2026-10-03")).toEqual([]);
    expect(await getAvailableRepairCallSlots("2026-10-02")).toEqual([]);
  });
  it("removes saved demo bookings from available slots", async () => {
    mocks.submissions.mockReturnValue([{ type: "booking", payload: { timeSlot: "2026-10-07T08:00:00.000Z" } }]);
    const slots = await getAvailableRepairCallSlots("2026-10-07");
    expect(slots.some((slot) => slot.start === "2026-10-07T08:00:00.000Z")).toBe(false);
  });
  it("scopes every database query to the tenant and excludes overlapping appointments", async () => {
    mocks.configured.mockReturnValue(true);
    results.appointments = { data: [{ starts_at: "2026-10-07T08:00:00Z", ends_at: "2026-10-07T08:30:00Z" }], error: null };
    expect((await getAvailableRepairCallSlots("2026-10-07", "tenant-2"))[0]?.start).toBe("2026-10-07T08:40:00.000Z");
    for (const table of Object.keys(results)) expect(filters).toHaveBeenCalledWith(table, "organisation_id", "tenant-2");
  });
  it.each(["availability_rules", "availability_exceptions", "appointments"])("fails closed when %s cannot be read", async (table) => {
    mocks.configured.mockReturnValue(true); results[table] = { data: null, error: { message: "private database diagnostics" } };
    await expect(getAvailableRepairCallSlots("2026-10-07", "tenant-2")).rejects.toThrow(/could not be loaded/);
  });
  it("does not offer a slot on a closed date", async () => { mocks.configured.mockReturnValue(true); results.availability_exceptions = { data: { is_closed: true }, error: null }; expect(await getAvailableRepairCallSlots("2026-10-07", "tenant-2")).toEqual([]); });
});
