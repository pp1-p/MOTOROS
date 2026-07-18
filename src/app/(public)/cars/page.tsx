import type { Metadata } from "next";
import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { VehicleCard } from "@/components/public/vehicle-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterPublicVehicles,
  getPublicVehicles,
  getVehicleFilterOptions,
  type VehicleSearchFilters,
} from "@/lib/data/vehicles";
import { cn } from "@/lib/utils";

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

  return (
    <>
      <section className="border-b bg-[#15221d] py-14 text-white sm:py-20">
        <div className="container-shell">
          <p className="mb-4 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
            Current stock
          </p>
          <h1 className="max-w-4xl font-display text-5xl leading-[0.96] tracking-tight text-balance sm:text-7xl">
            Find the car that fits your life.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/65">
            Search the full selection, compare the essentials and speak
            directly with the team who knows each car.
          </p>
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
          <form method="get" action="/cars" className="mb-10">
            <input
              type="hidden"
              name="availability"
              value={activeAvailability}
            />
            <div className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <label className="relative block">
                  <span className="sr-only">Search cars</span>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-foreground/40"
                    aria-hidden
                  />
                  <Input
                    name="q"
                    defaultValue={filters.q}
                    className="h-12 pl-11"
                    placeholder="Search make, model or body style"
                  />
                </label>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className={cn(selectClass, "h-12 lg:w-52")}
                  aria-label="Sort vehicles"
                >
                  <option value="newest">Newest first</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="mileage-asc">Lowest mileage</option>
                </select>
                <Button type="submit" className="h-12">
                  <Search aria-hidden />
                  Search stock
                </Button>
              </div>

              <details
                className="group mt-4 border-t pt-4"
                open={activeFilterCount > 0}
              >
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-brand">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  More filters
                  {activeFilterCount > 0 ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs">
                      {activeFilterCount} active
                    </span>
                  ) : null}
                </summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="grid gap-1.5 text-xs font-bold">
                    Make
                    <select
                      name="make"
                      defaultValue={filters.make ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any make</option>
                      {options.makes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Model
                    <select
                      name="model"
                      defaultValue={filters.model ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any model</option>
                      {options.models.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Fuel
                    <select
                      name="fuelType"
                      defaultValue={filters.fuelType ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any fuel</option>
                      {options.fuelTypes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Transmission
                    <select
                      name="transmission"
                      defaultValue={filters.transmission ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any transmission</option>
                      {options.transmissions.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Body type
                    <select
                      name="bodyType"
                      defaultValue={filters.bodyType ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any body type</option>
                      {options.bodyTypes.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Minimum price
                    <select
                      name="minPrice"
                      defaultValue={filters.minPrice ?? ""}
                      className={selectClass}
                    >
                      <option value="">No minimum</option>
                      <option value="10000">£10,000</option>
                      <option value="15000">£15,000</option>
                      <option value="20000">£20,000</option>
                      <option value="25000">£25,000</option>
                      <option value="30000">£30,000</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Maximum price
                    <select
                      name="maxPrice"
                      defaultValue={filters.maxPrice ?? ""}
                      className={selectClass}
                    >
                      <option value="">No maximum</option>
                      <option value="15000">£15,000</option>
                      <option value="20000">£20,000</option>
                      <option value="25000">£25,000</option>
                      <option value="30000">£30,000</option>
                      <option value="40000">£40,000</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Maximum mileage
                    <select
                      name="maxMileage"
                      defaultValue={filters.maxMileage ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any mileage</option>
                      <option value="20000">20,000 miles</option>
                      <option value="30000">30,000 miles</option>
                      <option value="40000">40,000 miles</option>
                      <option value="50000">50,000 miles</option>
                      <option value="75000">75,000 miles</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold">
                    Minimum year
                    <select
                      name="minYear"
                      defaultValue={filters.minYear ?? ""}
                      className={selectClass}
                    >
                      <option value="">Any year</option>
                      <option value="2019">2019</option>
                      <option value="2020">2020</option>
                      <option value="2021">2021</option>
                      <option value="2022">2022</option>
                      <option value="2023">2023</option>
                    </select>
                  </label>
                </div>
                <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  <Button asChild type="button" variant="ghost">
                    <Link href="/cars">
                      <X aria-hidden />
                      Clear filters
                    </Link>
                  </Button>
                  <Button type="submit">Apply filters</Button>
                </div>
              </details>
            </div>
          </form>

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
