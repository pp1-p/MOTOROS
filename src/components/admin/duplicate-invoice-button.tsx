"use client";

import { CopyPlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DuplicateInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function duplicate() {
    if (!confirm("Duplicate this invoice as a new draft?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/duplicate`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;
      if (!res.ok || !body?.id) {
        throw new Error(body?.message ?? "Could not duplicate this invoice.");
      }
      toast.success("Draft copy created.");
      router.push(`/admin/invoices/${body.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not duplicate the invoice.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => void duplicate()}
      disabled={saving}
    >
      {saving ? <LoaderCircle className="animate-spin" /> : <CopyPlus />}
      Duplicate
    </Button>
  );
}
