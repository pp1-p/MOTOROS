"use client";

import Link from "next/link";
import { LoaderCircle, UserRoundPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";

export function ConversationLeadButton({
  conversationId,
  initialLeadId,
}: {
  conversationId: string;
  initialLeadId: string | null;
}) {
  const [leadId, setLeadId] = useState(initialLeadId);
  const [saving, setSaving] = useState(false);

  if (leadId) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/leads?lead=${leadId}`}>View lead</Link>
      </Button>
    );
  }

  async function convert() {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/social/conversations/${conversationId}/lead`,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as
        | { leadId?: string; message?: string }
        | null;
      if (!response.ok || !result?.leadId) {
        notify.error(result?.message ?? "The conversation could not become a lead.");
        return;
      }
      setLeadId(result.leadId);
      notify.success(result.message ?? "Lead created from conversation.");
    } catch {
      notify.error("MOTOR.OS could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button disabled={saving} size="sm" onClick={() => void convert()}>
      {saving ? <LoaderCircle className="animate-spin" /> : <UserRoundPlus />}
      Create lead
    </Button>
  );
}
