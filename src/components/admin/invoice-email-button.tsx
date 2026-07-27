"use client";

import { useState } from "react";
import { Mail, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function InvoiceEmailButton({
  invoiceId,
  compact = false,
}: {
  invoiceId: string;
  compact?: boolean;
}) {
  const [sending, setSending] = useState(false);

  async function sendInvoice() {
    setSending(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/email`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? "The invoice could not be emailed.");
      }
      toast.success("Invoice emailed to the customer.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The invoice could not be emailed.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={sendInvoice}
      disabled={sending}
      aria-label="Email invoice"
    >
      {sending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <Mail aria-hidden="true" />
      )}
      {compact ? null : sending ? "Sending…" : "Email"}
    </Button>
  );
}
