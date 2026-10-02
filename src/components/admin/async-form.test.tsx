// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AsyncForm } from "./async-form";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
vi.mock("@/lib/notify", () => ({ notify: mocks }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function showForm() {
  return render(<AsyncForm endpoint="/api/customers" method="POST" successRedirect="/admin/customers"><label>Name<input name="name" defaultValue="Test customer" /></label></AsyncForm>);
}
it("redirects after a confirmed save without refreshing the old page", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"ok":true}', { headers: { "content-type": "application/json" } })));
  showForm(); fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/customers"));
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("keeps entries and focuses an error when the successful response has no confirmation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
  showForm(); fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(screen.getByRole("alert")).toHaveTextContent("Check the record before submitting again");
  expect(screen.getByLabelText("Name")).toHaveValue("Test customer");
  expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.success).not.toHaveBeenCalled();
});
it("blocks concurrent submit events while a write is pending", async () => {
  let resolve!: (response: Response) => void;
  const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", fetchMock);
  const view = showForm(); const form = view.container.querySelector("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  resolve(new Response('{"ok":true}', { headers: { "content-type": "application/json" } }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalled());
});

it("keeps server-rendered controls disabled and uses POST before JavaScript attaches", () => {
  const html = renderToString(<AsyncForm endpoint="/api/customers"><input name="email" /><button type="submit">Submit</button></AsyncForm>);
  const container = document.createElement("div"); container.innerHTML = html;
  expect(container.querySelector("form")).toHaveAttribute("method", "post");
  expect(container.querySelector("input")!.matches(":disabled")).toBe(true);
  expect(container.querySelector('button[type="submit"]')!.matches(":disabled")).toBe(true);
});
