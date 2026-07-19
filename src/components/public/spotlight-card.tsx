"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const element = ref.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        pending.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        if (frame.current !== null) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          const next = pending.current;
          const el = ref.current;
          if (!next || !el) return;
          el.style.setProperty("--spot-x", `${next.x}px`);
          el.style.setProperty("--spot-y", `${next.y}px`);
        });
      }}
      className={cn("spotlight-card", className)}
    >
      {children}
    </div>
  );
}
