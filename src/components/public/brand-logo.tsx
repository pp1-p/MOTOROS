"use client";

import { useState } from "react";

import { brandLogoPath, findBrand, type CarBrand } from "@/lib/data/car-brands";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  make: string | null | undefined;
  size?: number;
  ext?: "svg" | "png";
  className?: string;
  monogramClassName?: string;
};

export function BrandLogo({
  make,
  size = 48,
  ext = "svg",
  className,
  monogramClassName,
}: BrandLogoProps) {
  const brand = findBrand(make);
  const [broken, setBroken] = useState(false);

  if (!brand) return null;

  if (broken) {
    return <MonogramBadge brand={brand} size={size} className={monogramClassName} />;
  }

  return (
    // Using a plain <img> so the onError fallback to the monogram badge
    // works without needing every manufacturer domain in next.config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brandLogoPath(brand.slug, ext)}
      alt={`${brand.name} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

function MonogramBadge({
  brand,
  size,
  className,
}: {
  brand: CarBrand;
  size: number;
  className?: string;
}) {
  const textColour = brand.ink === "dark" ? "#0f1216" : "#ffffff";
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-display font-extrabold tracking-tight ring-1 ring-black/10",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: brand.colour,
        color: textColour,
      }}
    >
      <span style={{ fontSize: brand.monogram.length > 1 ? size * 0.32 : size * 0.5 }}>
        {brand.monogram}
      </span>
    </span>
  );
}
