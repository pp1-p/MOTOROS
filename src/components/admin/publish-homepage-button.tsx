"use client";

import { useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PublishHomepageButton() {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function publish() {
    setPublishing(true);
    setPublished(false);
    setMessage(null);

    const form = buttonRef.current?.closest("form");
    if (!form) {
      setMessage("The homepage form could not be found.");
      setPublishing(false);
      return;
    }
    const formData = new FormData(form);
    const draftPayload: Record<string, FormDataEntryValue> = {};
    formData.forEach((value, key) => {
      draftPayload[key] = value;
    });
    const draft = await fetch("/api/admin/website", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPayload),
    }).catch(() => null);
    if (!draft?.ok) {
      const draftResult = draft
        ? ((await draft.json().catch(() => null)) as { message?: string } | null)
        : null;
      setMessage(
        draftResult?.message ??
          "Save the homepage fields before publishing.",
      );
      setPublishing(false);
      return;
    }

    const response = await fetch("/api/admin/website/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;

    if (!response?.ok) {
      setMessage(
        result?.message ??
          "The homepage could not be published. The live website is unchanged.",
      );
      setPublishing(false);
      return;
    }

    setPublished(true);
    setMessage(result?.message ?? "Homepage published.");
    setPublishing(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? (
        <p
          role="status"
          className={`basis-full text-right text-[10px] font-bold ${
            published ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {message}
        </p>
      ) : null}
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        onClick={() => void publish()}
        disabled={publishing}
      >
        {published ? (
          <CheckCircle2 className="size-4" />
        ) : publishing ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {published ? "Published" : publishing ? "Publishing…" : "Review & publish"}
      </Button>
    </div>
  );
}
