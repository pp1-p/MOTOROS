import Link from "next/link";
import { Command, ShieldCheck, Sparkles } from "lucide-react";

import { SignInForm } from "@/components/admin/sign-in-form";

export default function AdminSignInPage() {
  return (
    <main id="main-content" className="grid min-h-screen bg-white lg:grid-cols-[minmax(420px,.92fr)_1.08fr]">
      <section className="flex flex-col px-6 py-6 sm:px-10 lg:px-14 xl:px-20">
        <Link href="/" className="flex w-fit items-center gap-3" aria-label="DealerOS home">
          <span className="grid size-10 place-items-center rounded-xl bg-[#10231f] text-[#d6a852]">
            <Command className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-[-0.035em]">DealerOS</span>
        </Link>
        <div className="flex flex-1 items-center py-12">
          <SignInForm />
        </div>
        <p className="text-[10px] font-semibold text-foreground/35">
          © 2026 DealerOS · Staff system · Europe/London
        </p>
      </section>

      <aside className="relative hidden overflow-hidden bg-[#10231f] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-[#286e60]/35 blur-3xl" />
        <div className="absolute -bottom-32 left-0 size-[30rem] rounded-full bg-[#d6a852]/10 blur-3xl" />
        <div className="relative flex items-center gap-2 text-xs font-extrabold text-emerald-300">
          <ShieldCheck className="size-4" />
          Protected dealership workspace
        </div>
        <div className="relative max-w-xl">
          <Sparkles className="mb-6 size-7 text-[#d6a852]" />
          <blockquote className="text-balance font-display text-4xl leading-[1.12] tracking-[-0.025em] xl:text-5xl">
            Every vehicle, customer and job. One calm place to run the day.
          </blockquote>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[
              ["24", "vehicles in stock"],
              ["5", "appointments today"],
              ["99.98%", "platform uptime"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xl font-extrabold">{value}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/45">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs leading-5 text-white/35">
          Need access? Ask an owner or manager to invite you from Team settings.
        </p>
      </aside>
    </main>
  );
}

