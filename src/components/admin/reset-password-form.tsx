"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/update-password", {
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
      setMessage(result?.message ?? "The password could not be updated.");
      setSubmitting(false);
      return;
    }
    setSuccess(true);
    setMessage("Password updated. Opening DealerOS…");
    window.location.assign(result?.redirectTo ?? "/admin");
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block text-sm font-bold" htmlFor="resetPassword">
        New password
        <Input
          id="resetPassword"
          name="password"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
          className="mt-2"
        />
      </label>
      <label className="block text-sm font-bold" htmlFor="resetPasswordConfirm">
        Confirm new password
        <Input
          id="resetPasswordConfirm"
          name="confirmPassword"
          type="password"
          minLength={12}
          autoComplete="new-password"
          required
          className="mt-2"
        />
      </label>
      <p className="text-xs leading-5 text-foreground/50">
        Use 12 or more characters with upper and lowercase letters, a number and a symbol.
      </p>
      {message ? (
        <p
          role="status"
          className={`rounded-xl p-3 text-sm font-semibold ${
            success
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={submitting || success}>
        {success ? (
          <CheckCircle2 />
        ) : submitting ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <LockKeyhole />
        )}
        {submitting ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}
