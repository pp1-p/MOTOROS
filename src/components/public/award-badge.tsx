"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type AwardBadgeProps = {
  /** Filename slug in /public/images/awards/, without extension */
  slug: string;
  /** Alt / plain-text label used for a11y and the placeholder fallback */
  label: string;
  /** Year to show on the placeholder fallback */
  year: number | string;
  ext?: "png" | "svg" | "jpg";
  size?: number;
  className?: string;
};

export function AwardBadge({
  slug,
  label,
  year,
  ext = "png",
  size = 168,
  className,
}: AwardBadgeProps) {
  const [broken, setBroken] = useState(false);

  if (!broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/images/awards/${slug}.${ext}`}
        alt={label}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn("h-auto max-w-full object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-label={label}
      role="img"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-6 text-center shadow-sm",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="text-[10px] font-extrabold tracking-[0.18em] text-foreground/45 uppercase">
        Award
      </span>
      <span className="font-display text-lg leading-tight font-extrabold text-foreground/85">
        {label}
      </span>
      <span className="font-display text-2xl font-extrabold text-brand">
        {year}
      </span>
    </div>
  );
}
