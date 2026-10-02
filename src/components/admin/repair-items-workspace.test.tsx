// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { RepairItemsWorkspace } from "./repair-items-workspace";
import type { RepairJobItem } from "@/lib/data/admin-repairs";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
const item: RepairJobItem = {
  id: "00000000-0000-4000-8000-000000000111",
  description: "Diagnostic inspection",
  itemType: "labour",
  quantity: 1.5,
  unitPrice: 78,
  vatRate: 20,
  lineTotal: 117,
  status: "planned",
  updatedAt: "2026-10-02T17:00:00+00:00",
};
const props = {
  jobId: "00000000-0000-4000-8000-000000000222",
  items: [item],
  canManage: true,
  canViewCommercial: true,
  isDemo: false,
  closed: false,
};
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function input(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function fillCreate() {
  fireEvent.click(screen.getByRole("button", { name: "Add labour or part" }));
  input("Description", "Oil service");
  input("Selling rate excluding VAT", "50");
  input("Reason for change", "Agreed with customer");
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

it("uses the stored per-line rounding for item totals and identifies the separate estimate", () => {
  render(<RepairItemsWorkspace {...props} />);
  expect(screen.getByText("£140.40")).toBeInTheDocument();
  expect(
    screen.getByText(/Item changes do not change the approved estimate/),
  ).toBeInTheDocument();
});
it.each([{ isDemo: true }, { canManage: false }, { closed: true }])(
  "hides mutation controls for read-only access: %j",
  (changes) => {
    render(<RepairItemsWorkspace {...props} {...changes} />);
    expect(
      screen.queryByRole("button", { name: "Add labour or part" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit Diagnostic/ }),
    ).not.toBeInTheDocument();
  },
);
it("does not render commercial information for a technician", () => {
  render(
    <RepairItemsWorkspace
      {...props}
      canManage={false}
      canViewCommercial={false}
      items={[{ ...item, unitPrice: null, vatRate: null, lineTotal: null }]}
    />,
  );
  expect(screen.queryByText(/£/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Item total including VAT/),
  ).not.toBeInTheDocument();
});
it("disables the add button until hydration", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<RepairItemsWorkspace {...props} />);
  expect(container.querySelector("button")).toBeDisabled();
});
it("sends a stable create ID, requires confirmation and refreshes the job", async () => {
  const fetchMock = vi
    .fn()
    .mockImplementation(async (_url: string, options: RequestInit) =>
      response(
        {
          ok: true,
          item: { id: JSON.parse(String(options.body)).id },
          message: "Item created.",
        },
        201,
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fillCreate();
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe(`/api/repair-jobs/${props.jobId}/items`);
  expect(options.method).toBe("POST");
  expect(JSON.parse(options.body)).toMatchObject({
    itemType: "labour",
    quantity: 1,
    unitPrice: 50,
    changeReason: "Agreed with customer",
  });
  expect(JSON.parse(options.body).id).toMatch(/^[0-9a-f-]{36}$/);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("keeps invalid entries, focuses validation and does not send an empty price", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fillCreate();
  input("Selling rate excluding VAT", "");
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus());
  expect(screen.getByLabelText("Description")).toHaveValue("Oil service");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("retains the create ID across a recoverable validation response", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        {
          message: "Review the quantity.",
          fieldErrors: { quantity: ["Choose a quantity."] },
        },
        400,
      ),
    )
    .mockImplementation(async (_url: string, options: RequestInit) =>
      response({ ok: true, item: { id: JSON.parse(String(options.body)).id } }),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fillCreate();
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await screen.findByText("Review the quantity.");
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).id).toBe(
    JSON.parse(fetchMock.mock.calls[1]![1].body).id,
  );
});
it("blocks concurrent submissions while saving and does not let Escape dismiss the pending form", async () => {
  let finish!: (value: Response) => void;
  const fetchMock = vi.fn().mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fillCreate();
  const form = screen.getByRole("dialog").querySelector("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledOnce();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  finish(
    response({
      ok: true,
      item: { id: JSON.parse(fetchMock.mock.calls[0]![1].body).id },
    }),
  );
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
});
it.each(["lost", "empty", "conflict"])(
  "requires a reload after a %s result without another write",
  async (scenario) => {
    const fetchMock =
      scenario === "lost"
        ? vi.fn().mockRejectedValue(new Error("offline"))
        : vi
            .fn()
            .mockResolvedValue(
              scenario === "empty"
                ? response({})
                : response(
                    { message: "This item changed. Refresh the job." },
                    409,
                  ),
            );
    vi.stubGlobal("fetch", fetchMock);
    render(<RepairItemsWorkspace {...props} />);
    fillCreate();
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));
    await screen.findByRole("button", { name: "Reload job" });
    expect(screen.getByRole("button", { name: "Save item" })).toBeDisabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(fetchMock).toHaveBeenCalledOnce();
  },
);
it("edits a row with its loaded version", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(response({ ok: true, item: { id: item.id } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit Diagnostic inspection" }),
  );
  input("Selling rate excluding VAT", "90");
  input("Reason for change", "Updated after diagnosis");
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0]![1].method).toBe("PATCH");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({
    id: item.id,
    expectedUpdatedAt: item.updatedAt,
    unitPrice: 90,
  });
});
it("requires an explicit removal confirmation and reason", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      response({ ok: true, item: { id: item.id }, message: "Item removed." }),
    );
  vi.stubGlobal("fetch", fetchMock);
  render(<RepairItemsWorkspace {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Diagnostic inspection" }),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  input("Reason for change", "Part no longer needed");
  fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(fetchMock.mock.calls[0]![1].method).toBe("DELETE");
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
    id: item.id,
    expectedUpdatedAt: item.updatedAt,
    changeReason: "Part no longer needed",
  });
});
it("traps focus in the item dialog and closes on Escape", async () => {
  render(<RepairItemsWorkspace {...props} />);
  const trigger = screen.getByRole("button", { name: "Add labour or part" });
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() =>
    expect(document.body).toHaveAttribute("data-scroll-locked"),
  );
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
    true,
  );
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
});
