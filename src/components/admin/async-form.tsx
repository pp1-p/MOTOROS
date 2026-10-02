"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

import { useRouter } from "next/navigation";
import { FormErrorSummary } from "@/components/forms/form-error-summary";
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
  successRedirect,
}: {
  endpoint: string;
  method?: "POST" | "PATCH";
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  buttonClassName?: string;
  onSuccessMessage?: string;
  successRedirect?: string;
}) {
  const router = useRouter();
  const pending = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, { message?: string }>>({});
  const [submitCount, setSubmitCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setMessage("");
    setFailed(false);
    setFieldErrors({});
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
        signal: AbortSignal.timeout(20_000),
      });
      const result = (await response.json().catch(() => null)) as { message?: string; fieldErrors?: Record<string, string[]> } | null;
      if (!response.ok) {
        const errorMessage =
          result?.message ??
          "Changes could not be saved. Your entries remain on screen.";
        setFailed(true);
        setMessage(errorMessage);
        setFieldErrors(Object.fromEntries(Object.entries(result?.fieldErrors ?? {})
          .filter(([, messages]) => Array.isArray(messages) && typeof messages[0] === "string")
          .map(([name, messages]) => [name, { message: messages[0] }])));
        setSubmitCount((count) => count + 1);
        notify.error(errorMessage);
        return;
      }
      const successMessage = result?.message ?? onSuccessMessage;
      setMessage(successMessage);
      notify.success(successMessage);
      if (successRedirect) router.push(successRedirect);
      else router.refresh();
    } catch {
      const offlineMessage =
        "The connection was lost or timed out. Your entries remain on screen. Check the record before submitting again; the server may have saved it.";
      setFailed(true);
      setMessage(offlineMessage);
      setSubmitCount((count) => count + 1);
      notify.error(offlineMessage);
    } finally {
      setSaving(false);
      pending.current = false;
    }
  }

  return (
    <form onSubmit={submit} className={className} aria-busy={saving}>
      {failed ? <FormErrorSummary errors={fieldErrors} submitCount={submitCount} submitError={message} /> : null}
      {children}
      <div className={cn("mt-5 flex flex-wrap items-center justify-end gap-3", buttonClassName)}>
        {!failed && message ? (
          <p
            role="status"
            className="mr-auto flex items-center gap-1.5 text-xs font-bold text-brand"
          >
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

