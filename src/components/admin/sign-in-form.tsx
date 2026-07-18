"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "reset">("sign-in");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        mode === "sign-in" ? "/api/auth/sign-in" : "/api/auth/request-password-reset",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: String(form.get("email") ?? ""),
            password: mode === "sign-in" ? String(form.get("password") ?? "") : undefined,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        message?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "We couldn’t complete that request. Check the details and try again.");
        return;
      }
      if (mode === "reset") {
        setMessage("If that address belongs to an account, a secure reset link is on its way.");
      } else {
        router.replace(result?.redirectTo ?? "/admin");
        router.refresh();
      }
    } catch {
      setMessage("DealerOS is temporarily unreachable. Your details were not submitted; please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      {mode === "reset" ? (
        <button
          type="button"
          className="mb-6 flex items-center gap-2 text-xs font-extrabold text-foreground/55 hover:text-foreground"
          onClick={() => {
            setMode("sign-in");
            setMessage("");
          }}
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </button>
      ) : null}
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand">
        Secure staff access
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
        {mode === "sign-in" ? "Welcome back." : "Reset your password."}
      </h1>
      <p className="mt-3 text-sm leading-6 text-foreground/55">
        {mode === "sign-in"
          ? "Sign in to manage stock, customers, workshop activity and your dealership website."
          : "Enter your staff email. We’ll send a time-limited reset link if the account exists."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="text-xs font-extrabold">
            Email address
          </label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@dealership.co.uk"
              className="h-12 pl-10"
            />
          </div>
        </div>

        {mode === "sign-in" ? (
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-extrabold">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setMessage("");
                }}
                className="text-xs font-extrabold text-brand hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative mt-2">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                className="h-12 px-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-foreground/35 hover:bg-surface-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "sign-in" ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground/55">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded border accent-brand"
            />
            Keep me signed in on this trusted device
          </label>
        ) : null}

        {message ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
          >
            {message}
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <LoaderCircle className="animate-spin" /> : null}
          {mode === "sign-in" ? "Sign in to DealerOS" : "Send secure reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[11px] leading-5 text-foreground/42">
        Access is logged and protected by your organisation’s permissions. By continuing, you
        agree to the{" "}
        <Link href="/terms" className="font-bold underline">
          terms of use
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-bold underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
