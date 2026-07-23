"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

export function CreateSaleInvoiceButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "sale", saleId }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; invoiceId?: string; message?: string }
        | null;
      if (!response.ok || !result?.ok || !result.invoiceId) {
        const errorMessage = result?.message ?? "Could not create the invoice.";
        setMessage(errorMessage);
        notify.error(errorMessage);
        return;
      }
      notify.success("Invoice created.");
      router.push(`/admin/invoices/${result.invoiceId}`);
      router.refresh();
    } catch {
      const offline = "Could not reach the server. Please retry.";
      setMessage(offline);
      notify.error(offline);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size="sm" onClick={submit} disabled={saving}>
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
        {saving ? "Creating…" : "Create invoice"}
      </Button>
      {message ? (
        <p className="text-xs font-semibold text-red-700">{message}</p>
      ) : null}
    </div>
  );
}
