"use client";

import { Check, Eye, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import type {
  WebsiteThemeDefinition,
  WebsiteThemeId,
} from "@/lib/website/themes";

export function WebsiteThemeSelector({
  themes,
  activeThemeId,
  premiumEnabled,
}: {
  themes: readonly WebsiteThemeDefinition[];
  activeThemeId: WebsiteThemeId;
  premiumEnabled: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(activeThemeId);
  const [saving, setSaving] = useState<WebsiteThemeId | null>(null);

  async function selectTheme(theme: WebsiteThemeDefinition) {
    if (theme.requiredEntitlement && !premiumEnabled) return;
    setSaving(theme.id);
    try {
      const response = await fetch("/api/admin/website/theme", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        notify.error(result?.message ?? "The website design could not be changed.");
        return;
      }
      setActive(theme.id);
      notify.success(result?.message ?? `${theme.name} selected.`);
      router.refresh();
    } catch {
      notify.error("MOTOR.OS could not reach the server. The current design is unchanged.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {themes.map((theme) => {
        const selected = active === theme.id;
        const locked = Boolean(theme.requiredEntitlement && !premiumEnabled);
        return (
          <article
            key={theme.id}
            className={`overflow-hidden rounded-2xl border bg-white ${
              selected ? "border-brand ring-2 ring-brand/15" : ""
            }`}
          >
            <div
              className="relative aspect-[16/9] overflow-hidden border-b p-5"
              style={{ background: theme.surface, color: theme.ink }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">
                  MOTOR.OS dealer
                </span>
                <span className="flex gap-3 text-[8px] font-bold opacity-60">
                  <span>Stock</span>
                  <span>Services</span>
                  <span>Contact</span>
                </span>
              </div>
              <div className="mt-7 max-w-[68%]">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] opacity-55">
                  Independent motoring
                </p>
                <p
                  className={`mt-2 text-2xl font-black leading-none ${
                    ["classic", "luxury"].includes(theme.id) ? "font-display" : ""
                  }`}
                >
                  Find your next car.
                </p>
                <span
                  className="mt-4 inline-block rounded-md px-3 py-1.5 text-[8px] font-extrabold text-white"
                  style={{ background: theme.accent }}
                >
                  Browse stock
                </span>
              </div>
              <div className="absolute -right-8 bottom-[-42%] size-48 rounded-full border-[24px] opacity-15" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold">{theme.name}</h2>
                    {selected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-extrabold text-emerald-800">
                        <Check className="size-3" /> Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs font-bold text-foreground/55">
                    {theme.strapline}
                  </p>
                </div>
                {locked ? <LockKeyhole className="size-4 text-amber-600" /> : null}
              </div>
              <p className="mt-3 text-xs leading-5 text-foreground/48">
                {theme.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/website/themes/preview/${theme.id}`}>
                    <Eye />
                    Preview design
                  </Link>
                </Button>
                <Button
                  disabled={selected || locked || saving !== null}
                  size="sm"
                  onClick={() => void selectTheme(theme)}
                >
                  {saving === theme.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : locked ? (
                    <LockKeyhole />
                  ) : (
                    <Check />
                  )}
                  {locked ? "Premium plan" : selected ? "In use" : "Use design"}
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
