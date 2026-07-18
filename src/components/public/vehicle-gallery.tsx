"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import type { PublicVehicleImage } from "@/lib/data/vehicles";
import { cn } from "@/lib/utils";

type VehicleGalleryProps = {
  images: PublicVehicleImage[];
  title: string;
};

export function VehicleGallery({ images, title }: VehicleGalleryProps) {
  const [selected, setSelected] = useState(0);
  const touchStart = useRef<number | null>(null);
  const current = images[selected];

  const show = (next: number) => {
    if (!images.length) return;
    setSelected((next + images.length) % images.length);
  };

  const handleTouchEnd = (x: number) => {
    if (touchStart.current === null) return;
    const distance = x - touchStart.current;
    if (Math.abs(distance) > 45) {
      show(selected + (distance < 0 ? 1 : -1));
    }
    touchStart.current = null;
  };

  if (!current) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-3xl bg-surface-muted text-sm font-bold text-foreground/50">
        Photography coming soon
      </div>
    );
  }

  return (
    <Dialog.Root>
      <div>
        <div
          className="group relative aspect-[16/10] overflow-hidden rounded-3xl bg-surface-muted"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            handleTouchEnd(event.changedTouches[0]?.clientX ?? 0);
          }}
        >
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 66vw"
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/65 to-transparent p-4 pt-14 sm:p-6 sm:pt-20">
            <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
              {selected + 1} / {images.length}
            </span>
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-surface-muted"
              >
                <Expand className="size-4" aria-hidden />
                <span className="hidden sm:inline">View full screen</span>
                <span className="sm:hidden">Expand</span>
              </button>
            </Dialog.Trigger>
          </div>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => show(selected - 1)}
                aria-label="Previous image"
                className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow-md transition group-hover:opacity-100 focus:opacity-100 sm:left-5"
              >
                <ChevronLeft aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => show(selected + 1)}
                aria-label="Next image"
                className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 opacity-0 shadow-md transition group-hover:opacity-100 focus:opacity-100 sm:right-5"
              >
                <ChevronRight aria-hidden />
              </button>
            </>
          ) : null}
        </div>

        {images.length > 1 ? (
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
            {images.map((item, index) => (
              <button
                type="button"
                key={`${item.url}-${index}`}
                onClick={() => setSelected(index)}
                aria-label={`Show image ${index + 1} of ${title}`}
                aria-current={selected === index ? "true" : undefined}
                className={cn(
                  "relative aspect-[4/3] w-24 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-surface-muted sm:w-32",
                  selected === index ? "border-brand" : "border-transparent",
                )}
              >
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/95" />
        <Dialog.Content
          className="fixed inset-0 z-[101] grid place-items-center p-4 sm:p-10"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{title} image gallery</Dialog.Title>
          <div className="relative size-full">
            <Image
              src={current.url}
              alt={current.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          <Dialog.Close
            className="fixed top-4 right-4 grid size-12 place-items-center rounded-full bg-white text-foreground shadow-xl"
            aria-label="Close full-screen gallery"
          >
            <X aria-hidden />
          </Dialog.Close>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => show(selected - 1)}
                aria-label="Previous full-screen image"
                className="fixed top-1/2 left-3 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white text-foreground sm:left-8"
              >
                <ChevronLeft aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => show(selected + 1)}
                aria-label="Next full-screen image"
                className="fixed top-1/2 right-3 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white text-foreground sm:right-8"
              >
                <ChevronRight aria-hidden />
              </button>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

