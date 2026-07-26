import Link from "next/link";

import { carBrands, findBrand } from "@/lib/data/car-brands";
import { cn } from "@/lib/utils";

type BrandStockCounts = Record<string, number>;

export function BrandBadge({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const brand = carBrands.find((b) => b.slug === slug);
  if (!brand) return null;
  const textColour = brand.ink === "dark" ? "#0f1216" : "#ffffff";
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-14 shrink-0 place-items-center rounded-2xl font-display font-extrabold tracking-tight shadow-inner shadow-black/20 ring-1 ring-black/10",
        className,
      )}
      style={{ backgroundColor: brand.colour, color: textColour }}
    >
      <span
        className={cn(
          "leading-none",
          brand.monogram.length > 1 ? "text-[15px]" : "text-2xl",
        )}
      >
        {brand.monogram}
      </span>
    </span>
  );
}

export function BrandPicker({
  activeMake,
  stockCounts,
}: {
  activeMake?: string | null;
  stockCounts?: BrandStockCounts;
}) {
  const active = findBrand(activeMake);
  const counts = stockCounts ?? {};
  return (
    <section className="border-b bg-white py-10 sm:py-12">
      <div className="container-shell">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-brand uppercase">
              Shop by brand
            </p>
            <h2 className="mt-2 tracking-display font-display text-3xl text-balance sm:text-4xl">
              Pick your make.
            </h2>
          </div>
          {active ? (
            <Link
              href="/cars"
              className="inline-flex h-9 items-center gap-2 self-start rounded-full border px-4 text-xs font-extrabold text-foreground/70 transition hover:border-brand hover:text-brand sm:self-auto"
            >
              Clear filter · {active.name}
              <span aria-hidden>×</span>
            </Link>
          ) : null}
        </div>

        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {carBrands.map((brand) => {
            const isActive = active?.slug === brand.slug;
            const count = counts[brand.slug] ?? 0;
            return (
              <li key={brand.slug}>
                <Link
                  href={`/cars?make=${encodeURIComponent(brand.name)}`}
                  className={cn(
                    "group flex h-full flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_24px_rgba(15,24,18,0.08)]",
                    isActive && "border-brand ring-2 ring-brand/40",
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  <BrandBadge
                    slug={brand.slug}
                    className="size-12 transition group-hover:scale-105 sm:size-14"
                  />
                  <span className="text-xs font-extrabold text-foreground/80 group-hover:text-brand">
                    {brand.name}
                  </span>
                  {count > 0 ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand">
                      {count} in stock
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
