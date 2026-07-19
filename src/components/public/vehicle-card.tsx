import { ArrowUpRight, Fuel, Gauge, Milestone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  getVehiclePresentation,
  type PublicVehicleRecord,
} from "@/lib/data/vehicles";
import { formatCurrency, formatMileage } from "@/lib/utils";

type VehicleCardProps = {
  vehicle: PublicVehicleRecord;
  priority?: boolean;
};

export function VehicleCard({ vehicle, priority = false }: VehicleCardProps) {
  const presentation = getVehiclePresentation(vehicle);

  return (
    <article
      className={`group overflow-hidden rounded-3xl border bg-white transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:border-[#d7ad69]/60 hover:shadow-[0_22px_60px_rgba(15,24,18,0.12)] ${priority ? "" : "reveal"}`}
    >
      <Link
        href={`/cars/${vehicle.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-surface-muted"
        aria-label={`View ${vehicle.publicTitle}`}
      >
        {vehicle.imageUrl ? (
          <Image
            src={vehicle.imageUrl}
            alt={vehicle.imageAlt ?? vehicle.publicTitle}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid size-full place-items-center text-sm font-bold text-foreground/45">
            Photography coming soon
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#171814]/25 via-transparent to-transparent"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <Badge variant={presentation.tone} className="shadow-sm">
            {presentation.label}
          </Badge>
          {vehicle.featured ? (
            <span className="rounded-full bg-[#171814]/85 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              Featured
            </span>
          ) : null}
        </div>
      </Link>

      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold tracking-[0.12em] text-brand uppercase">
              {vehicle.year} · {vehicle.bodyType}
            </p>
            <h3 className="text-lg leading-snug font-extrabold">
              <Link
                href={`/cars/${vehicle.slug}`}
                className="transition hover:text-brand"
              >
                {vehicle.publicTitle}
              </Link>
            </h3>
          </div>
          <p className="shrink-0 tracking-display font-display text-2xl">
            {formatCurrency(vehicle.price)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 border-y py-4 text-xs font-semibold text-foreground/60">
          <span className="flex min-w-0 items-center gap-1.5">
            <Milestone className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="truncate">{formatMileage(vehicle.mileage)}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <Fuel className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="truncate">{vehicle.fuelType}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <Gauge className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="truncate">{vehicle.transmission}</span>
          </span>
        </div>

        <p className="mt-4 min-h-10 text-sm leading-5 text-foreground/55">
          {vehicle.attentionGrabber}
        </p>
        <Link
          href={`/cars/${vehicle.slug}`}
          className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-brand transition hover:text-brand-strong"
        >
          View this car
          <ArrowUpRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </article>
  );
}

