"use client";

import { useState } from "react";
import { CircleAlert, LoaderCircle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export function AsyncForm({
  endpoint,
  method = "PATCH",
  children,
  submitLabel = "Save changes",
  className,
  buttonClassName,
  onSuccessMessage = "Changes saved.",
}: {
  endpoint: string;
  method?: "POST" | "PATCH";
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  buttonClassName?: string;
  onSuccessMessage?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setFailed(false);
    const form = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue | boolean> = {};
    form.forEach((value, key) => {
      if (key in payload) {
        const current = payload[key];
        payload[key] = `${String(current)},${String(value)}`;
      } else {
        payload[key] = value;
      }
    });

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        const errorMessage =
          result?.message ??
          "Changes could not be saved. Your entries remain on screen.";
        setFailed(true);
        setMessage(errorMessage);
        notify.error(errorMessage);
        return;
      }
      const successMessage = result?.message ?? onSuccessMessage;
      notify.success(successMessage);
    } catch {
      const offlineMessage =
        "DealerOS could not reach the server. Your entries remain on screen.";
      setFailed(true);
      setMessage(offlineMessage);
      notify.error(offlineMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className={className}>
      {children}
      <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-3", buttonClassName)}>
        {failed && message ? (
          <p
            role="status"
            className="mr-auto flex items-center gap-1.5 text-xs font-bold text-danger"
          >
            <CircleAlert className="size-3.5" />
            {message}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

