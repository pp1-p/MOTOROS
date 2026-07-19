"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      }}
      className={cn("spotlight-card", className)}
    >
      {children}
    </div>
  );
}
