// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "./admin-shell";
import type { AdminVehicle } from "./admin-data";
import { StockTable } from "./stock-table";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/stock",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("./dealership-switcher", () => ({ DealershipSwitcher: () => null }));

function renderShell() {
  return render(
    <AdminShell role="owner" organisationName="Demo dealership" displayName="Demo owner">
      <h1>Stock workspace</h1>
    </AdminShell>,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ notifications: [] }),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin design semantics and modal behaviour (DOM, not visual layout)", () => {
  it("marks only the matching navigation route current and provides a main-content skip link", async () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Stock" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("focuses search, locks background scrolling, traps focus and restores its trigger on Escape", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Search MOTOR.OS" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Global search" });
    const search = within(dialog).getByRole("textbox", { name: "Search" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(document.body).toHaveAttribute("data-scroll-locked");
    act(() => trigger.focus());
    expect(search).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("keeps the outside trigger across repeated shortcuts and dialog replacement", async () => {
    renderShell();
    const trigger = screen.getAllByRole("button", { name: "Quick create" })[0]!;
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Quick create" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const search = screen.getByRole("textbox", { name: "Search" });
    await waitFor(() => expect(search).toHaveFocus());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dismisses on the backdrop but not for interaction inside the dialog", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: "Search MOTOR.OS" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Global search" });
    fireEvent.mouseDown(within(dialog).getByRole("textbox", { name: "Search" }));
    expect(dialog).toBeInTheDocument();
    fireEvent.mouseDown(dialog);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not display an aborted search response or stop the newer loading state", async () => {
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("q=Focus")) return first;
      if (String(input).includes("q=Golf")) return second;
      return new Response(JSON.stringify({ notifications: [] }));
    });
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search MOTOR.OS" }));
    const input = screen.getByRole("textbox", { name: "Search" });
    fireEvent.change(input, { target: { value: "Focus" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/search?q=Focus", expect.anything()));
    fireEvent.change(input, { target: { value: "Golf" } });
    await act(async () => {
      resolveFirst(new Response(JSON.stringify({ data: [{ label: "Stale Focus", href: "/admin/stock/demo-1" }] })));
    });
    expect(screen.queryByRole("link", { name: "Stale Focus" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/search?q=Golf", expect.anything()));
    await act(async () => {
      resolveSecond(new Response(JSON.stringify({ data: [{ label: "Current Golf", href: "/admin/stock/demo-2" }] })));
    });
    expect(screen.getByRole("link", { name: "Current Golf" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 matching results");
  });
});

describe("stock controls", () => {
  const vehicles: AdminVehicle[] = [
    { id: "demo-1", stockNumber: "ST-1", registration: "AB12CDE", title: "Ford Focus", year: 2020,
      mileage: 20_000, price: 12_000, cost: 9_000, age: 5, image: "", status: "On forecourt" },
    { id: "demo-2", stockNumber: "ST-2", registration: "XY20ZAB", title: "Volkswagen Golf", year: 2021,
      mileage: 15_000, price: 18_000, cost: 14_000, age: 20, image: "", status: "Sold" },
  ];

  it("exposes labelled controls and matching empty states for table and grid views", () => {
    render(<StockTable vehicles={vehicles} canViewCommercial={false} />);
    expect(screen.getByLabelText("Stock status")).toHaveValue("All active stock");
    expect(screen.getByLabelText("Sort stock")).toHaveValue("stock-number");
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "not-a-vehicle" } });
    expect(screen.getByRole("heading", { name: "No vehicles match those filters" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "No vehicles match those filters" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" }).at(-1)!);
    expect(screen.getByLabelText("Search stock")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 2 vehicles");
  });

  it("shows inactive stock only when requested and preserves commercial-data visibility", () => {
    const { rerender } = render(<StockTable vehicles={vehicles} canViewCommercial={false} />);
    expect(screen.queryByText("Volkswagen Golf")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Est. margin" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Est\. margin/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Stock status"), { target: { value: "All stock" } });
    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 of 2 vehicles");
    rerender(<StockTable vehicles={vehicles} canViewCommercial={true} />);
    expect(screen.getByRole("columnheader", { name: "Est. margin" })).toBeInTheDocument();
  });
});
