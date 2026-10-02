import { afterEach, describe, expect, it, vi } from "vitest";
import { postFormData, postJson } from "./form-submit";
afterEach(() => vi.unstubAllGlobals());
function mockResponse(status: number, body: string, type = "application/json") {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status, headers: { "content-type": type } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
describe("bounded form submissions", () => {
  it("sends JSON with a timeout signal and reads confirmation", async () => {
    const fetchMock = mockResponse(200, '{"ok":true}');
    await expect(postJson("/api/enquiries", { name: "Test" })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/enquiries", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal), body: '{"name":"Test"}' }));
  });
  it("shows the API's rate-limit message without retrying", async () => {
    const fetchMock = mockResponse(429, '{"message":"Please wait before submitting again."}');
    await expect(postJson("/api/enquiries", {})).rejects.toThrow("Please wait");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not display an HTML error response", async () => {
    mockResponse(503, '<html>internal diagnostic details</html>', "text/html");
    await expect(postJson("/api/enquiries", {})).rejects.toThrow("could not submit");
  });
  it("does not retry a write after losing the connection", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("private diagnostic"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(postJson("/api/enquiries", {})).rejects.toThrow("unsure whether your request arrived");
    await expect(postFormData("/api/bookings", new FormData())).rejects.toThrow("may already be in the diary");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not treat an unconfirmed successful response as a completed save", async () => {
    mockResponse(200, "", "text/plain");
    await expect(postJson("/api/enquiries", {})).rejects.toThrow("did not confirm");
  });
});
