"use client";

import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type CarouselReview = {
  quote: string;
  author: string;
  source: string;
  rating?: number;
};

export function ReviewsCarousel({
  reviews,
  intervalMs = 6000,
  className,
}: {
  reviews: CarouselReview[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const total = reviews.length;
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [reviews.length],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || reviews.length < 2) return;
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % reviews.length);
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, reviews.length, intervalMs]);

  if (reviews.length === 0) return null;

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-3xl border bg-white shadow-[0_18px_50px_rgba(15,24,18,0.06)]"
        aria-roledescription="carousel"
        aria-label="Customer reviews"
      >
        <ul
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {reviews.map((review, i) => (
            <li
              key={`${review.author}-${i}`}
              className="w-full shrink-0 px-6 py-10 sm:px-12 sm:py-14"
              aria-hidden={i !== index}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${reviews.length}`}
            >
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <Quote className="size-10 text-brand/30" aria-hidden />
                <p className="mt-5 text-lg leading-8 text-foreground/80 sm:text-xl sm:leading-9">
                  &ldquo;{review.quote}&rdquo;
                </p>
                <div
                  className="mt-6 flex items-center gap-1 text-[#f27021]"
                  aria-label={`${review.rating ?? 5} out of 5 stars`}
                >
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={cn(
                        "size-4",
                        s < (review.rating ?? 5)
                          ? "fill-[#f27021] stroke-[#f27021]"
                          : "stroke-[#f27021]/40",
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm font-extrabold text-foreground/85">
                  {review.author}
                </p>
                <p className="mt-1 text-xs font-bold text-foreground/50">
                  via {review.source}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {reviews.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous review"
              className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border bg-white/90 text-foreground/70 shadow-sm transition hover:border-brand hover:text-brand sm:left-6"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next review"
              className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border bg-white/90 text-foreground/70 shadow-sm transition hover:border-brand hover:text-brand sm:right-6"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {reviews.length > 1 ? (
        <div
          className="mt-5 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Choose review"
        >
          {reviews.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show review ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-8 bg-brand"
                  : "w-3 bg-foreground/20 hover:bg-foreground/35",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
