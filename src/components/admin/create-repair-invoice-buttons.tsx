"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, LoaderCircle, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

async function post(repairJobId: string, kind: "final" | "estimate") {
  const response = await fetch("/api/admin/invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "repair",
      repairJobId,
      options: { type: kind, issue: true },
    }),
  });
  return {
    response,
    result: (await response.json().catch(() => null)) as
      | { ok?: boolean; invoiceId?: string; message?: string }
      | null,
  };
}

export function CreateRepairInvoiceButtons({
  repairJobId,
  canCreateFinal,
}: {
  repairJobId: string;
  canCreateFinal: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"final" | "estimate" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(kind: "final" | "estimate") {
    setBusy(kind);
    setMessage("");
    try {
      const { response, result } = await post(repairJobId, kind);
      if (!response.ok || !result?.ok || !result.invoiceId) {
        const errorMessage = result?.message ?? "Could not create the invoice.";
        setMessage(errorMessage);
        notify.error(errorMessage);
        return;
      }
      notify.success(
        kind === "final" ? "Repair invoice created." : "Estimate created.",
      );
      router.push(`/admin/invoices/${result.invoiceId}`);
      router.refresh();
    } catch {
      const offline = "Could not reach the server. Please retry.";
      setMessage(offline);
      notify.error(offline);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {canCreateFinal ? (
          <Button
            size="sm"
            onClick={() => submit("final")}
            disabled={busy !== null}
          >
            {busy === "final" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Receipt className="size-4" />
            )}
            {busy === "final" ? "Creating…" : "Create invoice"}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("estimate")}
          disabled={busy !== null}
        >
          {busy === "estimate" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          {busy === "estimate" ? "Creating…" : "Create estimate"}
        </Button>
      </div>
      {message ? (
        <p className="text-xs font-semibold text-red-700">{message}</p>
      ) : null}
    </div>
  );
}
