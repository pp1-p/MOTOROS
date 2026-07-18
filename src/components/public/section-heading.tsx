import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "centre";
  action?: ReactNode;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        align === "centre" && "text-center sm:block",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "centre" && "mx-auto")}>
        {eyebrow ? (
          <p className="mb-3 text-xs font-extrabold tracking-[0.18em] text-brand uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-4xl leading-[1.02] font-medium tracking-tight text-balance sm:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 text-base leading-7 text-foreground/65">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

