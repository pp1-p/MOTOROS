"use client";

import { useState } from "react";
import { CheckCircle2, Cloud, Eye, LoaderCircle, TriangleAlert } from "lucide-react";

import { StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";

type SyncItem = {
  vehicleId: string;
  stockNumber: string;
  outcome: "created" | "updated" | "unchanged" | "skipped" | "failed";
  operation: string;
  externalStockId: string | null;
  message: string;
  warnings: string[];
};

type SyncResult = {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  halted: boolean;
  haltReason: string | null;
  items: SyncItem[];
};

type RequestState = "idle" | "verifying" | "previewing" | "syncing";

function operationLabel(item: SyncItem) {
  if (item.outcome === "created") return "create";
  if (item.outcome === "updated") return item.operation;
  return item.outcome;
}

export function AutoTraderSyncControls({
  vehicleId,
  compact = false,
}: {
  vehicleId?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<RequestState>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function parseResponse(response: Response) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && response.status !== 207) {
      throw new Error(
        typeof body.message === "string"
          ? body.message
          : "The Auto Trader sandbox request failed.",
      );
    }
    return body;
  }

  async function verify() {
    setState("verifying");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/integrations/autotrader/verify", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = await parseResponse(response);
      setMessage(
        typeof body.message === "string"
          ? body.message
          : "Auto Trader sandbox read access was verified.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setState("idle");
    }
  }

  async function requestSync(dryRun: boolean) {
    setState(dryRun ? "previewing" : "syncing");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/integrations/autotrader/sync", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vehicleId, dryRun }),
      });
      const body = await parseResponse(response);
      const nextResult = (
        body.result && typeof body.result === "object" ? body.result : body
      ) as SyncResult;
      setResult(nextResult);
      setMessage(
        dryRun
          ? "Read-only preview complete. Review every record below before applying it."
          : "Sandbox stock sync complete.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Stock sync failed.");
    } finally {
      setState("idle");
    }
  }

  function applyPreview() {
    if (!result?.dryRun) return;
    const changes = result.items.filter((item) =>
      ["created", "updated"].includes(item.outcome),
    );
    const records = changes
      .map((item) => `${item.stockNumber}: ${operationLabel(item)}`)
      .join("\n");
    const confirmed = window.confirm(
      `Apply these ${changes.length} Auto Trader SANDBOX stock changes?\n\n${records || "No remote changes are required."}\n\nThis may create, update, publish, unpublish, mark sold or withdraw sandbox stock exactly as previewed. It never uses production.`,
    );
    if (confirmed) void requestSync(false);
  }

  const busy = state !== "idle";
  const previewReady = result?.dryRun === true && !result.halted;

  return (
    <section className={compact ? "rounded-xl border bg-surface-muted p-4" : "rounded-2xl border bg-white p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="size-4 text-brand" aria-hidden="true" />
            <h2 className="text-sm font-extrabold">
              Auto Trader sandbox {vehicleId ? "vehicle sync" : "stock sync"}
            </h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground/48">
            Verify with a non-destructive read, then preview the exact records and effects before enabling any sandbox write.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void verify()}>
            {state === "verifying" ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
            Verify read access
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void requestSync(true)}>
            {state === "previewing" ? <LoaderCircle className="animate-spin" /> : <Eye />}
            Preview
          </Button>
          <Button type="button" size="sm" disabled={busy || !previewReady} onClick={applyPreview}>
            {state === "syncing" ? <LoaderCircle className="animate-spin" /> : <Cloud />}
            Apply preview to sandbox
          </Button>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border bg-white p-3 text-xs leading-5 text-foreground/65" role="status">
          {message}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["created", "updated", "unchanged", "skipped", "failed"] as const).map((key) => (
              <span key={key} className="rounded-full border bg-white px-3 py-1 text-[10px] font-extrabold capitalize">
                {key} {result[key]}
              </span>
            ))}
          </div>
          {result.halted ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {result.haltReason ?? "The advertiser sync was halted."}
            </p>
          ) : null}
          <div className="max-h-80 divide-y overflow-y-auto rounded-xl border bg-white">
            {result.items.map((item) => (
              <div key={item.vehicleId} className="grid gap-2 p-3 sm:grid-cols-[minmax(110px,0.4fr)_100px_minmax(0,1fr)] sm:items-start">
                <div>
                  <p className="text-xs font-extrabold">{item.stockNumber}</p>
                  <p className="mt-0.5 break-all text-[9px] text-foreground/35">{item.vehicleId}</p>
                </div>
                <StatusPill status={operationLabel(item)} />
                <div>
                  <p className="text-[11px] leading-5 text-foreground/60">{item.message}</p>
                  {item.warnings.map((warning) => (
                    <p key={warning} className="mt-1 text-[10px] leading-4 text-amber-700">{warning}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
