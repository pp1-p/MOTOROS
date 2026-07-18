import Link from "next/link";
import { Command, ShieldCheck } from "lucide-react";

import { ResetPasswordForm } from "@/components/admin/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#10231f] p-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
        <Link href="/" className="flex w-fit items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#10231f] text-[#d6a852]">
            <Command className="size-5" />
          </span>
          <span className="text-lg font-extrabold">DealerOS</span>
        </Link>
        <p className="mt-9 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">
          <ShieldCheck className="size-4" />
          Secure password reset
        </p>
        <h1 className="mt-3 font-display text-4xl">Choose a new password</h1>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
