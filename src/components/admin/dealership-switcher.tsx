"use client";

import { Building2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type DealershipOption = {
  id: string;
  name: string;
  role: string;
  isPrimary: boolean;
};

type DealershipAccess = {
  activeOrganisationId: string | null;
  organisations: DealershipOption[];
};

export function DealershipSwitcher() {
  const router = useRouter();
  const [access, setAccess] = useState<DealershipAccess | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/active-organisation", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as DealershipAccess;
      })
      .then((result) => {
        if (result) setAccess(result);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAccess(null);
        }
      });
    return () => controller.abort();
  }, []);

  if (!access || access.organisations.length < 2) return null;

  async function switchDealership(organisationId: string) {
    if (!organisationId || organisationId === access?.activeOrganisationId) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/auth/active-organisation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organisationId }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.message ?? "The dealership could not be changed.");
      }
      router.push("/admin");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The dealership could not be changed.",
      );
      setSwitching(false);
    }
  }

  return (
    <div className="border-b border-white/10 px-3 py-3">
      <label
        htmlFor="active-dealership"
        className="mb-1.5 flex items-center gap-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/40"
      >
        <Building2 className="size-3.5" aria-hidden="true" />
        Active dealership
      </label>
      <div className="relative">
        <select
          id="active-dealership"
          value={access.activeOrganisationId ?? ""}
          disabled={switching}
          onChange={(event) => void switchDealership(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-white/12 bg-white/[0.07] px-3 pr-9 text-xs font-bold text-white outline-none transition focus:border-[#d6a852] disabled:opacity-60"
        >
          {access.organisations.map((organisation) => (
            <option key={organisation.id} value={organisation.id} className="text-foreground">
              {organisation.name}{organisation.isPrimary ? " · Primary" : ""}
            </option>
          ))}
        </select>
        {switching ? (
          <LoaderCircle className="pointer-events-none absolute right-3 top-3 size-4 animate-spin text-white/60" />
        ) : null}
      </div>
    </div>
  );
}
