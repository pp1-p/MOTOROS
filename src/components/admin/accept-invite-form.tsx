"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AcceptInviteForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          redirectTo?: string;
        } | null)
      : null;

    if (!response?.ok) {
      setMessage(
        result?.message ??
          "The invitation could not be accepted. Please try again.",
      );
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setMessage(result?.message ?? "Invitation accepted.");
    window.location.assign(result?.redirectTo ?? "/admin");
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-bold">
          Create password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={submitting || success}
        />
        <p className="text-xs leading-5 text-foreground/50">
          Use at least 12 characters with upper and lowercase letters, a number and a symbol.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-bold">
          Confirm password
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={submitting || success}
        />
      </div>
      {message ? (
        <p
          className={
            success
              ? "rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"
              : "rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
      <Button type="submit" className="h-12 w-full" disabled={submitting || success}>
        {success ? (
          <CheckCircle2 className="size-4" />
        ) : submitting ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <LockKeyhole className="size-4" />
        )}
        {success
          ? "Access activated"
          : submitting
            ? "Activating access…"
            : "Set password and continue"}
      </Button>
    </form>
  );
}
