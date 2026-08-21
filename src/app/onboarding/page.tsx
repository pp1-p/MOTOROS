import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { requirePlatformOwner } from "@/lib/auth/platform-admin";

import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add dealership · MOTOROS platform",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const actor = await requirePlatformOwner();
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/platform" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white">
            <ArrowLeft className="size-3.5" aria-hidden />
            Platform overview
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
            <ShieldCheck className="size-3.5" aria-hidden />
            Owner-only provisioning · {actor.email}
          </span>
        </div>
        <header className="mt-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">Dealership onboarding</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Create a tenant-ready dealership</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Set the business identity, MotorOS subdomain, branding, initial website design, optional custom domain and owner invitation. The site starts in draft on a trial plan.
          </p>
        </header>
        <OnboardingWizard />
      </div>
    </main>
  );
}
