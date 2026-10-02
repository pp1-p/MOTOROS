"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Download, Grid2X2, List, Plus, Search, X } from "lucide-react";

import { useHydrated } from "@/lib/use-hydrated";

import type { AdminVehicle } from "./admin-data";
import { EmptyState, StatusPill } from "./page-kit";
import { filterAndSortStock, type StockSort } from "./stock-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatMileage } from "@/lib/utils";

const statuses = [
  "All active stock", "All stock", "Available", "Due in", "Preparation",
  "Photography required", "Reserved", "Sold", "Returned", "Archived",
];

function StockCard({ vehicle, canViewCommercial }: {
  vehicle: AdminVehicle;
  canViewCommercial: boolean;
}) {
  return (
    <Link href={"/admin/stock/" + vehicle.id}
      className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-colors hover:border-brand/40">
      <div className="aspect-[16/9] bg-surface-muted bg-cover bg-center"
        style={{ backgroundImage: "url(" + JSON.stringify(vehicle.image) + ")" }} aria-hidden="true" />
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-md bg-[#f2e6bd] px-2 py-1 font-mono text-xs font-bold tracking-wide text-black">
            {vehicle.registration}
          </span>
          <StatusPill status={vehicle.status} />
        </div>
        <h2 className="mt-3 text-sm font-bold leading-6">{vehicle.title}</h2>
        <p className="mt-1 text-xs leading-5 text-foreground/70">
          {vehicle.year} · {formatMileage(vehicle.mileage)} · {vehicle.stockNumber}
        </p>
        <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-xs text-foreground/70">Retail price</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight tabular-nums">{formatCurrency(vehicle.price)}</p>
          </div>
          <span className={cn("text-xs font-semibold", vehicle.age > 20 ? "text-amber-800" : "text-foreground/70")}>
            {vehicle.age} days
          </span>
        </div>
        {canViewCommercial ? (
          <p className="mt-2 text-xs font-medium text-emerald-800">
            Est. margin {formatCurrency(vehicle.price - vehicle.cost)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

export function StockTable({ vehicles, canViewCommercial, canManageStock = false }: {
  vehicles: AdminVehicle[];
  canViewCommercial: boolean;
  canManageStock?: boolean;
}) {
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All active stock");
  const [sort, setSort] = useState<StockSort>("stock-number");
  const [view, setView] = useState<"table" | "grid">("table");
  const filtered = useMemo(
    () => filterAndSortStock(vehicles, query, status, sort),
    [query, status, sort, vehicles],
  );
  const hasFilters = query.trim().length > 0 || status !== "All active stock";

  function clearFilters() {
    setQuery("");
    setStatus("All active stock");
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <fieldset disabled={!hydrated} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
        <div className="relative min-w-0 basis-full md:flex-1 md:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/70" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Registration, stock number or model"
            className="h-11 bg-surface-muted/50 pl-9 pr-10 shadow-none" aria-label="Search stock" />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear stock search"
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-foreground/70 hover:bg-surface-muted">
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <label className="min-w-0 flex-1 basis-[calc(50%-0.375rem)] sm:basis-auto sm:flex-none">
          <span className="sr-only">Stock status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}
            className="h-11 w-full rounded-lg border bg-white px-3 text-xs font-semibold sm:w-44">
            {statuses.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-[calc(50%-0.375rem)] sm:basis-auto sm:flex-none">
          <span className="sr-only">Sort stock</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as StockSort)}
            className="h-11 w-full rounded-lg border bg-white px-3 text-xs font-semibold sm:w-40">
            <option value="stock-number">Stock number</option>
            <option value="age">Oldest stock first</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </label>
        <Button asChild variant="outline" size="sm" className="h-11 w-full sm:w-auto">
          <a href="/api/admin/vehicles/export" download><Download className="size-4" />Export CSV</a>
        </Button>
        <div className="hidden rounded-lg border bg-surface-muted p-1 md:flex" role="group" aria-label="Stock layout">
          {([{ value: "table", label: "Table view", icon: List }, { value: "grid", label: "Grid view", icon: Grid2X2 }] as const).map((item) => (
            <button key={item.value} type="button" onClick={() => setView(item.value)}
              className={cn("grid size-9 place-items-center rounded-md text-foreground/70", view === item.value && "bg-white text-brand shadow-sm")}
              aria-label={item.label} aria-pressed={view === item.value}>
              <item.icon className="size-4" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <p className="font-medium text-foreground/70" role="status" aria-live="polite" aria-atomic="true">
          Showing <span className="font-bold text-foreground">{filtered.length}</span> of {vehicles.length} vehicles
        </p>
        {hasFilters ? (
          <button type="button" onClick={clearFilters} className="min-h-9 rounded-lg px-2 font-semibold text-brand hover:bg-brand-soft">
            Clear filters
          </button>
        ) : null}
      </div>

      {filtered.length ? (
        <>
          {view === "table" ? (
            <div className="workspace-data-card hidden min-w-0 overflow-hidden md:block">
              <div className="workspace-table-scroll relative w-full overflow-x-auto overscroll-x-contain"
                role="region" aria-label="Stock inventory table" tabIndex={0}>
                <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                  <caption className="sr-only">Vehicle stock with status, mileage, retail price and age</caption>
                  <thead className="border-b bg-surface-muted/60 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                    <tr>
                      {["Vehicle", "Registration", "Status", "Mileage", "Retail price", ...(canViewCommercial ? ["Est. margin"] : []), "Age"].map((label) => (
                        <th key={label} scope="col" className="px-4 py-3">{label}</th>
                      ))}
                      <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Open vehicle</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((vehicle) => (
                      <tr key={vehicle.id} className="transition-colors hover:bg-surface-muted/40">
                        <td className="px-4 py-4">
                          <Link href={"/admin/stock/" + vehicle.id} className="flex min-w-[220px] items-center gap-3 rounded-md">
                            <span className="h-12 w-16 shrink-0 rounded-lg bg-surface-muted bg-cover bg-center"
                              style={{ backgroundImage: "url(" + JSON.stringify(vehicle.image) + ")" }} aria-hidden="true" />
                            <span>
                              <span className="block text-sm font-semibold leading-5">{vehicle.title}</span>
                              <span className="mt-1 block text-xs text-foreground/70">{vehicle.year} · {vehicle.stockNumber}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-4"><span className="rounded-md bg-[#f2e6bd] px-2 py-1 font-mono text-xs font-bold tracking-wide text-black">{vehicle.registration}</span></td>
                        <td className="px-4 py-4"><StatusPill status={vehicle.status} /></td>
                        <td className="px-4 py-4 text-xs font-medium tabular-nums text-foreground/70">{formatMileage(vehicle.mileage)}</td>
                        <td className="px-4 py-4 text-sm font-semibold tabular-nums">{formatCurrency(vehicle.price)}</td>
                        {canViewCommercial ? <td className="px-4 py-4 text-xs font-semibold tabular-nums text-emerald-800">{formatCurrency(vehicle.price - vehicle.cost)}</td> : null}
                        <td className="whitespace-nowrap px-4 py-4"><span className={cn("text-xs font-medium tabular-nums", vehicle.age > 20 ? "text-amber-800" : "text-foreground/70")}>{vehicle.age} days</span></td>
                        <td className="px-2 py-4"><Link href={"/admin/stock/" + vehicle.id}
                          className="grid size-10 place-items-center rounded-lg text-foreground/70 hover:bg-brand-soft hover:text-brand"
                          aria-label={"Open " + vehicle.title}><ArrowUpRight className="size-4" aria-hidden="true" /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", view === "table" && "md:hidden")} aria-label="Vehicle cards">
            {filtered.map((vehicle) => <StockCard key={vehicle.id} vehicle={vehicle} canViewCommercial={canViewCommercial} />)}
          </div>
        </>
      ) : vehicles.length === 0 ? (
        <EmptyState title="No cars in stock yet" description="Add your first vehicle using a registration lookup or manual entry."
          actionHref={canManageStock ? "/admin/stock/new" : undefined} actionLabel={canManageStock ? "Add your first vehicle" : undefined} />
      ) : (
        <div className="rounded-xl border bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-bold">No vehicles match those filters</h2>
          <p className="mt-2 text-sm text-foreground/70">Try another status or search term.</p>
          <button type="button" onClick={clearFilters} className="mt-4 min-h-10 rounded-lg border px-4 text-sm font-semibold text-brand hover:bg-brand-soft">Clear filters</button>
        </div>
      )}

      {canManageStock ? <div className="fixed bottom-5 right-5 z-20 sm:hidden">
        <Button asChild size="icon" className="size-12 rounded-full shadow-xl">
          <Link href="/admin/stock/new" aria-label="Add a vehicle"><Plus /></Link>
        </Button>
      </div> : null}
    </div>
  );
}
