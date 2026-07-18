import Link from "next/link";
import { Command, ShieldCheck } from "lucide-react";

import { AcceptInviteForm } from "@/components/admin/accept-invite-form";

export default function AcceptInvitePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#10231f] p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-2xl sm:p-9">
        <Link href="/" className="flex w-fit items-center gap-3" aria-label="DealerOS home">
          <span className="grid size-10 place-items-center rounded-xl bg-[#10231f] text-[#d6a852]">
            <Command className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-[-0.035em]">DealerOS</span>
        </Link>
        <div className="mt-9 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand">
          <ShieldCheck className="size-4" />
          Secure team invitation
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.035em]">
          Activate your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/55">
          Create a strong password to accept the dealership invitation and open your role-aware workspace.
        </p>
        <AcceptInviteForm />
      </section>
    </main>
  );
}
