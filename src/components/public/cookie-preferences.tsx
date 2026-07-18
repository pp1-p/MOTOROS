"use client";

import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const storageKey = "dealeros-cookie-preference";

export function CookiePreferences() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(window.localStorage.getItem(storageKey) === null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const choose = (preference: "necessary" | "all") => {
    window.localStorage.setItem(storageKey, preference);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <section
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-2xl rounded-2xl border bg-white p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] sm:bottom-5 sm:p-6"
    >
      <button
        type="button"
        onClick={() => choose("necessary")}
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-foreground/55 hover:bg-surface-muted"
        aria-label="Close cookie message and use necessary cookies only"
      >
        <X className="size-4" aria-hidden />
      </button>
      <div className="flex gap-4 pr-7">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          <Cookie className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-extrabold">Your privacy, your choice</h2>
          <p className="mt-1 text-sm leading-6 text-foreground/65">
            We use necessary cookies to keep this site working. Optional
            analytics will only be enabled if you accept them.{" "}
            <Link className="font-bold text-brand underline" href="/cookies">
              Read our cookie notice
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => choose("necessary")}
          className="min-h-11 rounded-xl border px-4 text-sm font-bold hover:bg-surface-muted"
        >
          Necessary only
        </button>
        <button
          type="button"
          onClick={() => choose("all")}
          className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong"
        >
          Accept optional cookies
        </button>
      </div>
    </section>
  );
}
