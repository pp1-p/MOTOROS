"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import type { AdminVehicle } from "@/components/admin/admin-data";
import { StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatMileage } from "@/lib/utils";

export function StockTable({
  vehicles,
  canViewCommercial,
}: {
  vehicles: AdminVehicle[];
  canViewCommercial: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All active stock");
  const [view, setView] = useState<"table" | "grid">("table");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const queryMatch = `${vehicle.registration} ${vehicle.stockNumber} ${vehicle.title}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const statusMatch =
          status === "All active stock" ||
          (status === "Available" && vehicle.status === "On forecourt") ||
          vehicle.status === status;
        return queryMatch && statusMatch;
      }),
    [query, status, vehicles],
  );

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stock number, registration or model…"
            className="h-10 border-0 bg-surface-muted pl-9 shadow-none"
            aria-label="Search stock"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((value) => !value)}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-xs font-extrabold sm:w-auto"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal className="size-4 text-foreground/40" />
            {status}
            <ChevronDown className="size-3.5 text-foreground/35" />
          </button>
          {filterOpen ? (
            <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border bg-white p-1.5 shadow-xl">
              {[
                "All active stock",
                "Available",
                "Due in",
                "Preparation",
                "Photography required",
                "Reserved",
                "Sold",
              ].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setStatus(option);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "block w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-surface-muted",
                    option === status && "bg-brand-soft text-brand-strong",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/vehicles/export" download>
            <Download className="size-4" />
            Export CSV
          </a>
        </Button>
        <div className="flex rounded-xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setView("table")}
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              view === "table" ? "bg-white shadow-sm" : "text-foreground/35",
            )}
            aria-label="Table view"
            aria-pressed={view === "table"}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              view === "grid" ? "bg-white shadow-sm" : "text-foreground/35",
            )}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <Grid2X2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-xs">
        <p className="font-bold text-foreground/45">
          Showing <span className="text-foreground">{filtered.length}</span> vehicles
        </p>
        <p className="hidden text-foreground/35 sm:block">Stock updated moments ago</p>
      </div>

      {view === "table" ? (
        <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white">
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-[0.11em] text-foreground/38">
                <tr>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Mileage</th>
                  <th className="px-4 py-3">Retail price</th>
                  {canViewCommercial ? (
                    <th className="px-4 py-3">Est. margin</th>
                  ) : null}
                  <th className="px-4 py-3">Age</th>
                  <th className="w-12 px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((vehicle) => (
                  <tr key={vehicle.id} className="group transition hover:bg-[#fafaf8]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/stock/${vehicle.id}`}
                        className="flex min-w-[230px] items-center gap-3"
                      >
                        <span
                          className="h-12 w-16 shrink-0 rounded-lg bg-surface-muted bg-cover bg-center"
                          style={{ backgroundImage: `url("${vehicle.image}")` }}
                          role="img"
                          aria-label=""
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-extrabold">
                            {vehicle.title}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-foreground/42">
                            {vehicle.year} · {vehicle.stockNumber}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-[#f2e6bd] px-2 py-1 font-mono text-xs font-black tracking-wide text-black">
                        {vehicle.registration}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={vehicle.status} />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground/58">
                      {formatMileage(vehicle.mileage)}
                    </td>
                    <td className="px-4 py-3 text-xs font-extrabold tabular-nums">
                      {formatCurrency(vehicle.price)}
                    </td>
                    {canViewCommercial ? (
                      <td className="px-4 py-3 text-xs font-extrabold tabular-nums text-emerald-700">
                        {formatCurrency(vehicle.price - vehicle.cost)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          vehicle.age > 20 ? "text-amber-700" : "text-foreground/55",
                        )}
                      >
                        {vehicle.age} days
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <Link
                        href={`/admin/stock/${vehicle.id}`}
                        className="grid size-8 place-items-center rounded-lg text-foreground/35 hover:bg-surface-muted hover:text-foreground"
                        aria-label={`Open ${vehicle.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length ? (
            <div className="border-t px-6 py-16 text-center">
              <p className="font-extrabold">No vehicles match those filters</p>
              <p className="mt-1 text-sm text-foreground/45">Try another status or clear the search.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("All active stock");
                }}
                className="mt-4 text-xs font-extrabold text-brand hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vehicle) => (
            <Link
              key={vehicle.id}
              href={`/admin/stock/${vehicle.id}`}
              className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div
                className="aspect-[16/9] bg-surface-muted bg-cover bg-center"
                style={{ backgroundImage: `url("${vehicle.image}")` }}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{vehicle.title}</p>
                    <p className="mt-1 text-xs text-foreground/45">
                      {vehicle.registration} · {formatMileage(vehicle.mileage)}
                    </p>
                  </div>
                  <StatusPill status={vehicle.status} />
                </div>
                <div className="mt-4 flex items-end justify-between border-t pt-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-foreground/35">Retail</p>
                    <p className="font-extrabold">{formatCurrency(vehicle.price)}</p>
                  </div>
                  {canViewCommercial ? (
                    <p className="text-xs font-bold text-emerald-700">
                      +{formatCurrency(vehicle.price - vehicle.cost)} est.
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-20 sm:hidden">
        <Button asChild size="icon" className="size-12 rounded-full shadow-xl">
          <Link href="/admin/stock/new" aria-label="Add a vehicle">
            <Plus />
          </Link>
        </Button>
      </div>
    </div>
  );
}
