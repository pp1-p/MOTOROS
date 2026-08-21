"use client";

import { Check, ExternalLink, Eye, LoaderCircle, Palette, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import {
  getThemeDefinition,
  themeDefinitions,
  type ThemeId,
} from "@/lib/themes";
import { cn } from "@/lib/utils";

function ThemeArtwork({ themeId }: { themeId: ThemeId }) {
  const theme = getThemeDefinition(themeId);
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[16/10] overflow-hidden border-b p-3",
        theme.previewClassName,
      )}
      style={{ background: "var(--preview-bg)" }}
    >
      {themeId === "direct-motors-classic" ? (
        <><div className="mx-auto h-2 w-1/3 rounded-full bg-white/70" /><div className="mt-2 flex justify-center gap-2">{Array.from({ length: 5 }).map((_, index) => <span key={index} className="h-1 w-7 rounded bg-white/35" />)}</div><div className="absolute inset-x-5 bottom-5"><div className="h-3 w-1/2 rounded bg-white/85" /><div className="mt-2 h-1.5 w-3/4 rounded bg-white/35" /><div className="mt-4 h-5 w-20 rounded bg-[var(--preview-accent)]" /></div></>
      ) : themeId === "modern-marketplace" ? (
        <><div className="flex items-center justify-between"><div className="h-3 w-20 rounded bg-slate-900/75" /><div className="h-5 w-16 rounded bg-[var(--preview-accent)]" /></div><div className="mt-5 grid grid-cols-[1fr_0.7fr] gap-3"><div><div className="h-4 w-3/4 rounded bg-slate-900/75" /><div className="mt-2 h-2 w-full rounded bg-slate-900/20" /></div><div className="rounded-lg bg-white p-2 shadow"><div className="h-2 rounded bg-slate-900/15" /><div className="mt-2 h-4 rounded bg-[var(--preview-accent)]" /></div></div><div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-9 rounded-lg bg-white shadow" />)}</div></>
      ) : themeId === "prestige" ? (
        <><div className="flex items-center justify-between text-[var(--preview-accent)]"><span className="h-px w-12 bg-current" /><span className="size-4 border border-current" /><span className="h-px w-12 bg-current" /></div><div className="absolute inset-x-6 top-1/3 text-center"><div className="mx-auto h-4 w-3/4 bg-white/80" /><div className="mx-auto mt-2 h-px w-1/2 bg-[var(--preview-accent)]" /></div><div className="absolute inset-x-4 bottom-3 grid grid-cols-[1.4fr_0.6fr] gap-2"><div className="h-10 border border-white/20 bg-white/10" /><div className="h-10 border border-white/20 bg-white/5" /></div></>
      ) : (
        <><div className="absolute inset-y-0 right-6 w-20 skew-x-[-14deg] bg-[var(--preview-accent)]/70" /><div className="relative flex items-center justify-between"><ZapMark /><div className="h-2 w-1/2 bg-white/25" /></div><div className="absolute left-4 top-1/3"><div className="h-5 w-36 bg-white/90" /><div className="mt-2 h-5 w-24 bg-white/90" /><div className="mt-4 h-5 w-20 bg-[var(--preview-accent)]" /></div><div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-1">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-5 border-t-2 border-[var(--preview-accent)] bg-white/10" />)}</div></>
      )}
    </div>
  );
}

function ZapMark() {
  return <div className="flex items-center gap-1"><span className="h-4 w-1 bg-[var(--preview-accent)]" /><span className="h-3 w-16 bg-white/80" /></div>;
}

export function ThemeStudio({
  initialPublishedThemeId,
  initialDraftThemeId,
}: {
  initialPublishedThemeId: ThemeId;
  initialDraftThemeId: ThemeId;
}) {
  const [publishedThemeId, setPublishedThemeId] = useState(initialPublishedThemeId);
  const [draftThemeId, setDraftThemeId] = useState(initialDraftThemeId);
  const [workingThemeId, setWorkingThemeId] = useState<ThemeId | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");

  async function selectTheme(themeId: ThemeId) {
    setWorkingThemeId(themeId);
    setMessage("");
    const response = await fetch("/api/admin/website/theme", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ themeId }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setWorkingThemeId(null);
    if (!response?.ok) {
      const failure = result?.message ?? "The design selection could not be saved.";
      setMessage(failure);
      notify.error(failure);
      return;
    }
    setDraftThemeId(themeId);
    const success = result?.message ?? "Design selected as the draft.";
    setMessage(success);
    notify.success(success);
  }

  async function publishTheme() {
    const theme = getThemeDefinition(draftThemeId);
    if (!window.confirm(`Publish ${theme.name} to the live dealership website?`)) return;
    setPublishing(true);
    setMessage("");
    const response = await fetch("/api/admin/website/theme/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ themeId: draftThemeId }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setPublishing(false);
    if (!response?.ok) {
      const failure = result?.message ?? "The website design could not be published.";
      setMessage(failure);
      notify.error(failure);
      return;
    }
    setPublishedThemeId(draftThemeId);
    const success = result?.message ?? `${theme.name} is now live.`;
    setMessage(success);
    notify.success(success);
  }

  return (
    <section className="rounded-2xl border bg-white" aria-labelledby="website-design-heading">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.14em] text-brand uppercase"><Palette className="size-4" aria-hidden />Website designs</p>
          <h2 id="website-design-heading" className="mt-1 text-lg font-extrabold">Choose how the public website feels</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground/55">Preview each design with this dealership’s real public content. Selecting a draft does not change the live website.</p>
        </div>
        <div className="shrink-0 rounded-xl bg-surface-muted px-4 py-3 text-xs"><span className="block font-bold text-foreground/50">Live design</span><span className="mt-0.5 block font-extrabold">{getThemeDefinition(publishedThemeId).name}</span></div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-4">
        {themeDefinitions.map((theme) => {
          const selected = draftThemeId === theme.id;
          const live = publishedThemeId === theme.id;
          const saving = workingThemeId === theme.id;
          return (
            <article key={theme.id} className={cn("overflow-hidden rounded-2xl border bg-white transition", selected ? "border-brand ring-2 ring-brand/15" : "hover:border-brand/40")}>
              <ThemeArtwork themeId={theme.id} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">{theme.name}</h3><p className="mt-1 text-[10px] font-bold text-brand">{theme.bestFor}</p></div>{live ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-extrabold text-emerald-800">Live</span> : selected ? <span className="rounded-full bg-brand-soft px-2 py-1 text-[9px] font-extrabold text-brand">Draft</span> : null}</div>
                <p className="mt-3 min-h-12 text-xs leading-5 text-foreground/58">{theme.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/website/preview/${theme.id}`} target="_blank"><Eye aria-hidden />Preview<span className="sr-only"> {theme.name}</span><ExternalLink className="size-3" aria-hidden /></Link></Button>
                  <Button size="sm" variant={selected ? "outline" : "default"} disabled={selected || saving || publishing} onClick={() => void selectTheme(theme.id)}>{saving ? <LoaderCircle className="animate-spin" aria-hidden /> : selected ? <Check aria-hidden /> : null}{selected ? "Selected" : saving ? "Saving…" : "Select"}</Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t bg-surface-muted/45 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-extrabold">Draft: {getThemeDefinition(draftThemeId).name}</p><p className="mt-1 text-[10px] text-foreground/55">Publishing changes presentation only. Inventory, leads and dealership content stay in place.</p>{message ? <p role="status" aria-live="polite" className="mt-2 text-xs font-bold text-brand">{message}</p> : null}</div>
        <Button type="button" disabled={publishing || draftThemeId === publishedThemeId} onClick={() => void publishTheme()}>{publishing ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}{publishing ? "Publishing…" : draftThemeId === publishedThemeId ? "Already live" : "Publish selected design"}</Button>
      </div>
    </section>
  );
}
