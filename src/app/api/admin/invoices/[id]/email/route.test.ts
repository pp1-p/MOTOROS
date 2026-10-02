import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), allowed: vi.fn(), invoice: vi.fn(), email: vi.fn(), env: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/permissions", () => ({ getStaffContext: mocks.staff, hasPermission: mocks.allowed }));
vi.mock("@/lib/data/admin-invoices", () => ({ getInvoiceById: mocks.invoice }));
vi.mock("@/lib/communications/email", () => ({ sendConfirmationEmail: mocks.email }));
vi.mock("@/lib/env", () => ({ getServerEnv: mocks.env }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: mocks.client }));
import { POST } from "./route";
const id = "00000000-0000-4000-8000-000000000111";
const organisationId = "00000000-0000-4000-8000-000000000001";
const invoice = { id, status: "draft", customerEmail: "test@example.test", customerName: "Test", lineItems: [], total: 20, balance: 20, currency: "GBP", invoiceNumber: "TEST-1" };
let updateResult: { error: null | { message: string } };
let activityResult: { error: null | { message: string } };
let eq: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let insert: ReturnType<typeof vi.fn>;
function request(origin = "http://localhost:3000") { return new Request(`http://localhost:3000/api/admin/invoices/${id}/email`, { method: "POST", headers: { origin } }); }
function send(req = request()) { return POST(req, { params: Promise.resolve({ id }) }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.staff.mockResolvedValue({ userId: id, organisationId, role: "owner", organisationName: "Test dealership" });
  mocks.allowed.mockReturnValue(true);
  mocks.invoice.mockResolvedValue({ ...invoice });
  mocks.email.mockResolvedValue({ id: "test-message" });
  mocks.env.mockReturnValue({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", EMAIL_PROVIDER: "resend" });
  updateResult = { error: null }; activityResult = { error: null };
  const chain = { eq: vi.fn(), then: (resolve: (value: typeof updateResult) => unknown) => Promise.resolve(updateResult).then(resolve) };
  chain.eq.mockReturnValue(chain); eq = chain.eq;
  update = vi.fn().mockReturnValue(chain);
  insert = vi.fn().mockImplementation(async () => activityResult);
  mocks.client.mockReturnValue({ from: vi.fn((table: string) => table === "invoices" ? { update } : { insert }) });
});
describe("invoice email outcomes", () => {
  it("rejects another request origin", async () => { expect((await send(request("https://other.example"))).status).toBe(403); expect(mocks.email).not.toHaveBeenCalled(); });
  it("requires an authenticated staff account", async () => { mocks.staff.mockResolvedValue(null); expect((await send()).status).toBe(401); });
  it("requires invoice management permission", async () => { mocks.allowed.mockReturnValue(false); expect((await send()).status).toBe(403); });
  it("does not send an inaccessible invoice", async () => { mocks.invoice.mockResolvedValue(null); expect((await send()).status).toBe(404); expect(mocks.email).not.toHaveBeenCalled(); });
  it("cannot report console fallback as delivered", async () => { mocks.env.mockReturnValue({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", EMAIL_PROVIDER: "console" }); expect((await send()).status).toBe(503); expect(mocks.email).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); });
  it.each(["void", "cancelled"])("does not email %s invoices", async (status) => { mocks.invoice.mockResolvedValue({ ...invoice, status }); expect((await send()).status).toBe(409); expect(mocks.email).not.toHaveBeenCalled(); });
  it("requires a customer email", async () => { mocks.invoice.mockResolvedValue({ ...invoice, customerEmail: null }); expect((await send()).status).toBe(400); });
  it("leaves status unchanged on an unconfirmed provider result", async () => { mocks.email.mockResolvedValue(null); const res = await send(); expect(res.status).toBe(502); expect(update).not.toHaveBeenCalled(); expect((await res.json()).message).toContain("Check provider delivery"); });
  it("does not overwrite an already paid invoice", async () => { mocks.invoice.mockResolvedValue({ ...invoice, status: "paid" }); expect((await send()).status).toBe(200); expect(update).not.toHaveBeenCalled(); });
  it("scopes the draft update and redacts the audit detail", async () => { expect((await send()).status).toBe(200); expect(eq).toHaveBeenCalledWith("organisation_id", organisationId); expect(eq).toHaveBeenCalledWith("status", "draft"); expect(JSON.stringify(insert.mock.calls)).not.toContain(invoice.customerEmail); });
  it.each(["status", "audit"])("reports post-delivery %s persistence failure without resending", async (which) => { if (which === "status") updateResult = { error: { message: "database failure" } }; else activityResult = { error: { message: "database failure" } }; const res = await send(); expect(res.status).toBe(500); expect((await res.json()).message).toContain("before sending again"); expect(mocks.email).toHaveBeenCalledOnce(); });
});
