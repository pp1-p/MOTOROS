"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("DealerOS route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <main className="container-shell grid min-h-[70vh] place-items-center py-24">
      <div className="max-w-lg rounded-2xl border bg-surface p-8 text-center surface-shadow">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
          Something went wrong
        </p>
        <h1 className="mt-3 font-display text-4xl">We could not load this page.</h1>
        <p className="mt-4 text-foreground/65">
          Your information has not been discarded. Please try again, or contact the
          dealership if the problem continues.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-strong"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
