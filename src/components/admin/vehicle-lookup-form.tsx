"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normaliseRegistration } from "@/lib/utils";

type LookupResponse = {
  ok: boolean;
  data?: Record<string, unknown>;
  message?: string;
  manualFallback?: boolean;
};

export function VehicleLookupForm() {
  const router = useRouter();
  const [registration, setRegistration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function continueManually() {
    const normalised = normaliseRegistration(registration);
    sessionStorage.setItem(
      "dealeros:vehicle-review",
      JSON.stringify({ registration: normalised, lookupSource: "manual" }),
    );
    router.push(`/admin/stock/new/review?registration=${encodeURIComponent(normalised)}`);
  }

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalised = normaliseRegistration(registration);
    if (normalised.length < 2 || normalised.length > 8) {
      setError("Enter a valid UK registration using 2 to 8 letters and numbers.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/vehicle-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration: normalised }),
      });
      const result = (await response.json().catch(() => null)) as LookupResponse | null;
      if (!response.ok || !result?.ok) {
        setError(
          result?.message ??
            "The lookup provider did not return a vehicle. No details have been invented.",
        );
        return;
      }
      sessionStorage.setItem(
        "dealeros:vehicle-review",
        JSON.stringify({
          ...result.data,
          registration: normalised,
          lookupSource: "provider",
        }),
      );
      router.push(`/admin/stock/new/review?registration=${encodeURIComponent(normalised)}`);
    } catch {
      setError(
        "The lookup service is temporarily unavailable. You can enter the vehicle safely by hand.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-center gap-2" aria-label="Step 1 of 3">
        {([
          ["1", "Lookup", true],
          ["2", "Review", false],
          ["3", "Create", false],
        ] as const).map(([number, label, active], index) => (
          <div key={label} className="contents">
            {index ? <span className="h-px w-8 bg-border sm:w-16" /> : null}
            <span className="flex items-center gap-2">
              <span
                className={`grid size-7 place-items-center rounded-full text-[10px] font-extrabold ${
                  active ? "bg-brand text-white" : "bg-surface-muted text-foreground/35"
                }`}
              >
                {number}
              </span>
              <span
                className={`hidden text-xs font-extrabold sm:inline ${
                  active ? "text-foreground" : "text-foreground/35"
                }`}
              >
                {label}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border bg-white shadow-[0_20px_60px_rgba(20,24,18,.08)]">
        <div className="bg-[#10231f] px-6 py-8 text-white sm:px-10">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#d6a852]">
            <Search className="size-4" />
            Secure registration lookup
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em]">
            Start with the registration.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/52">
            DealerOS will ask the configured vehicle-data provider for factual registration
            details. You will review everything before a stock record is created.
          </p>
        </div>
        <form onSubmit={lookup} className="p-6 sm:p-10">
          <label htmlFor="registration" className="text-xs font-extrabold">
            UK registration number
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="registration"
              name="registration"
              value={registration}
              onChange={(event) => {
                setRegistration(event.target.value.toUpperCase());
                setError("");
              }}
              className="h-16 border-2 border-black bg-[#f3d765] px-5 font-mono text-2xl font-black uppercase tracking-[0.12em] text-black placeholder:text-black/28 sm:flex-1"
              placeholder="AB12 CDE"
              maxLength={10}
              autoComplete="off"
              autoFocus
              required
              aria-describedby="registration-help lookup-error"
            />
            <Button
              type="submit"
              size="lg"
              className="h-16 sm:px-8"
              disabled={loading || !registration}
            >
              {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
              {loading ? "Looking up…" : "Look up vehicle"}
            </Button>
          </div>
          <p id="registration-help" className="mt-2 text-[11px] text-foreground/42">
            Spaces are optional. Registration searches are rate-limited and safely logged.
          </p>

          {error ? (
            <div
              id="lookup-error"
              role="alert"
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
            >
              <div className="flex gap-3">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-xs font-extrabold">Lookup not completed</p>
                  <p className="mt-1 text-xs leading-5 opacity-75">{error}</p>
                  <button
                    type="button"
                    onClick={continueManually}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold underline"
                  >
                    Continue with manual entry
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-3 border-t pt-6 sm:grid-cols-3">
            {[
              [ShieldCheck, "Server-side", "Provider credentials never reach this browser."],
              [CheckCircle2, "Review first", "Nothing is saved until you confirm the details."],
              [CircleAlert, "Safe fallback", "Manual entry stays available if a provider is offline."],
            ].map(([Icon, title, detail]) => {
              const Component = Icon as typeof ShieldCheck;
              return (
                <div key={String(title)} className="flex gap-2.5">
                  <Component className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-[11px] font-extrabold">{String(title)}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-foreground/42">
                      {String(detail)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </form>
      </div>
      <p className="mt-6 text-center text-xs text-foreground/42">
        Prefer not to use a lookup?{" "}
        <button type="button" onClick={continueManually} className="font-extrabold text-brand underline">
          Enter all details manually
        </button>
      </p>
      <p className="mt-3 text-center">
        <Link href="/admin/stock" className="text-xs font-bold text-foreground/45 hover:text-foreground">
          Cancel and return to stock
        </Link>
      </p>
    </div>
  );
}
