import type { Metadata } from "next";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/public/brand-logo";
import { SectionHeading } from "@/components/public/section-heading";
import { VehicleCard } from "@/components/public/vehicle-card";
import { Button } from "@/components/ui/button";
import { carBrands, findBrand } from "@/lib/data/car-brands";
import {
  filterPublicVehicles,
  getPublicVehicles,
  getVehicleFilterOptions,
  type VehicleSearchFilters,
} from "@/lib/data/vehicles";
import { cn } from "@/lib/utils";

// The public stock list must always reflect the newest published state.
// Without this, Next.js can serve a statically cached version and a car
// that was just published in the admin won't show up until the cache
// invalidates.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Used cars for sale",
  description:
    "Browse carefully selected used cars with clear specifications, preparation details and direct access to the dealership team.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: string | undefined) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

const selectClass =
  "h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-foreground shadow-sm";

const availabilityOptions = [
  { value: "all", label: "All stock" },
  { value: "available", label: "Available now" },
  { value: "reserved", label: "Reserved" },
  { value: "coming-soon", label: "Coming soon" },
  { value: "sold", label: "Recently sold" },
] as const;

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const vehicles = await getPublicVehicles();
  const options = getVehicleFilterOptions(vehicles);

  const filters: VehicleSearchFilters = {
    q: first(params.q),
    make: first(params.make),
    model: first(params.model),
    minPrice: positiveNumber(first(params.minPrice)),
    maxPrice: positiveNumber(first(params.maxPrice)),
    fuelType: first(params.fuelType),
    transmission: first(params.transmission),
    bodyType: first(params.bodyType),
    maxMileage: positiveNumber(first(params.maxMileage)),
    minYear: positiveNumber(first(params.minYear)),
    availability:
      (first(params.availability) as VehicleSearchFilters["availability"]) ??
      "all",
    sort:
      (first(params.sort) as VehicleSearchFilters["sort"]) ?? "newest",
  };

  const filteredVehicles = filterPublicVehicles(vehicles, filters);
  const activeAvailability = filters.availability ?? "all";
  const activeFilterCount = [
    filters.q,
    filters.make,
    filters.model,
    filters.minPrice,
    filters.maxPrice,
    filters.fuelType,
    filters.transmission,
    filters.bodyType,
    filters.maxMileage,
    filters.minYear,
    activeAvailability !== "all" ? activeAvailability : undefined,
  ].filter(Boolean).length;

  const brandStockCounts: Record<string, number> = {};
  for (const vehicle of vehicles) {
    const brand = findBrand(vehicle.make);
    if (!brand) continue;
    brandStockCounts[brand.slug] = (brandStockCounts[brand.slug] ?? 0) + 1;
  }

  const makeSelectOptions = Array.from(
    new Set<string>([...options.makes, ...carBrands.map((b) => b.name)]),
  )
    .sort((a, b) => a.localeCompare(b))
    .map((value) => {
      const brand = carBrands.find((b) => b.name === value);
      const inStock = brand ? (brandStockCounts[brand.slug] ?? 0) : 0;
      return { value, label: inStock > 0 ? `${value} (${inStock})` : value };
    });

  return (
    <>
      <section className="border-b bg-[#15221d] py-14 text-white sm:py-20">
        <div className="container-shell">
          <p className="mb-4 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
            Current stock
          </p>
          <h1 className="max-w-4xl tracking-display-lg font-display text-5xl text-balance sm:text-7xl">
            Find the car that fits your life.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/65">
            Search the full selection, compare the essentials and speak
            directly with the team who knows each car.
          </p>
        </div>
      </section>

      <section className="border-b bg-white py-6 sm:py-8">
        <div className="container-shell">
          <form
            method="get"
            action="/cars"
            className="flex flex-col gap-3 rounded-2xl border bg-white p-3 shadow-sm sm:p-4"
          >
            <input
              type="hidden"
              name="availability"
              value={activeAvailability}
            />
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <label className="grid gap-1 text-[10px] font-extrabold tracking-[0.14em] text-foreground/55 uppercase">
                <span className="pl-3">Make</span>
                <select
                  name="make"
                  defaultValue={filters.make ?? ""}
                  className={cn(selectClass, "h-12")}
                >
                  <option value="">All makes</option>
                  {makeSelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold tracking-[0.14em] text-foreground/55 uppercase">
                <span className="pl-3">Model</span>
                <select
                  name="model"
                  defaultValue={filters.model ?? ""}
                  className={cn(selectClass, "h-12")}
                >
                  <option value="">All models</option>
                  {options.models.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold tracking-[0.14em] text-foreground/55 uppercase">
                <span className="pl-3">Min price</span>
                <select
                  name="minPrice"
                  defaultValue={filters.minPrice ?? ""}
                  className={cn(selectClass, "h-12")}
                >
                  <option value="">No minimum</option>
                  <option value="5000">£5,000</option>
                  <option value="10000">£10,000</option>
                  <option value="15000">£15,000</option>
                  <option value="20000">£20,000</option>
                  <option value="25000">£25,000</option>
                  <option value="30000">£30,000</option>
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-extrabold tracking-[0.14em] text-foreground/55 uppercase">
                <span className="pl-3">Max price</span>
                <select
                  name="maxPrice"
                  defaultValue={filters.maxPrice ?? ""}
                  className={cn(selectClass, "h-12")}
                >
                  <option value="">No maximum</option>
                  <option value="10000">£10,000</option>
                  <option value="15000">£15,000</option>
                  <option value="20000">£20,000</option>
                  <option value="25000">£25,000</option>
                  <option value="30000">£30,000</option>
                  <option value="40000">£40,000</option>
                  <option value="60000">£60,000</option>
                </select>
              </label>
              <Button
                type="submit"
                className="h-12 self-end bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e] md:min-w-32"
              >
                <Search aria-hidden />
                Search
              </Button>
            </div>
            {filters.make ? (
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <div className="flex items-center gap-3">
                  <BrandLogo make={filters.make} size={40} />
                  <div>
                    <p className="text-[10px] font-extrabold tracking-[0.14em] text-foreground/50 uppercase">
                      Filtering by make
                    </p>
                    <p className="text-sm font-extrabold">{filters.make}</p>
                  </div>
                </div>
                <Link
                  href="/cars"
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-foreground/60 transition hover:text-brand"
                >
                  Clear
                  <X className="size-3.5" aria-hidden />
                </Link>
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="border-b bg-white py-5">
        <div className="container-shell flex snap-x gap-2 overflow-x-auto pb-1">
          {availabilityOptions.map((option) => (
            <Link
              key={option.value}
              href={
                option.value === "all"
                  ? "/cars"
                  : `/cars?availability=${option.value}`
              }
              className={cn(
                "min-h-10 shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-bold transition",
                activeAvailability === option.value
                  ? "border-brand bg-brand text-white"
                  : "bg-white hover:border-brand hover:text-brand",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-shell">
          <div className="mb-10 flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow="Your results"
              title={`${filteredVehicles.length} ${
                filteredVehicles.length === 1 ? "car" : "cars"
              } to explore`}
              description={
                filteredVehicles.length
                  ? "Open any vehicle for its full specification, preparation details and direct enquiry options."
                  : "Try widening your filters, or send us a brief and we can source the right car."
              }
            />
            <form
              method="get"
              action="/cars"
              className="flex shrink-0 items-center gap-2"
            >
              <input type="hidden" name="availability" value={activeAvailability} />
              {filters.make ? <input type="hidden" name="make" value={filters.make} /> : null}
              {filters.model ? <input type="hidden" name="model" value={filters.model} /> : null}
              {filters.minPrice ? <input type="hidden" name="minPrice" value={String(filters.minPrice)} /> : null}
              {filters.maxPrice ? <input type="hidden" name="maxPrice" value={String(filters.maxPrice)} /> : null}
              <label className="text-[10px] font-extrabold tracking-[0.14em] text-foreground/55 uppercase">
                Sort
              </label>
              <select
                name="sort"
                defaultValue={filters.sort}
                className={cn(selectClass, "h-11 min-w-40")}
                aria-label="Sort vehicles"
              >
                <option value="newest">Newest first</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="mileage-asc">Lowest mileage</option>
              </select>
              <Button type="submit" variant="outline" className="h-11">
                Apply
              </Button>
            </form>
          </div>

          {activeFilterCount > 0 ? (
            <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-bold text-foreground/60">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                <SlidersHorizontal className="mr-1 inline size-3.5 -translate-y-px" aria-hidden />
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
              </span>
              <Link
                href="/cars"
                className="inline-flex items-center gap-1 transition hover:text-brand"
              >
                <X className="size-3.5" aria-hidden />
                Clear all
              </Link>
            </div>
          ) : null}

          {filteredVehicles.length ? (
            <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredVehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  priority={index < 3}
                />
              ))}
            </div>
          ) : (
            <div className="mt-9 rounded-3xl border bg-white px-6 py-14 text-center sm:px-10">
              <h2 className="font-display text-4xl">Nothing exact—yet.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-foreground/60">
                Clear one or two filters, or ask our sourcing team to look
                beyond the cars currently advertised.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/cars">Clear all filters</Link>
                </Button>
                <Button asChild>
                  <Link href="/source-a-car">Ask us to source a car</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
