import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Home, LogOut, Plus, ShieldCheck } from "lucide-react";

import {
  canMutatePlatform,
  requirePlatformAdmin,
} from "@/lib/auth/platform-admin";

export const metadata: Metadata = {
  title: {
    template: "%s · Platform admin",
    default: "Platform admin",
  },
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/platform"
            className="flex items-center gap-3 font-extrabold"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#22d3ee]/20 text-[#67e8f9]">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm">MOTOROS platform</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Super-admin
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-extrabold">
            <Link
              href="/platform"
              className="rounded-lg px-3 py-2 hover:bg-white/10"
            >
              <Home className="mr-1.5 inline size-3.5" aria-hidden />
              Overview
            </Link>
            <Link
              href="/platform#dealerships"
              className="rounded-lg px-3 py-2 hover:bg-white/10"
            >
              <Building2 className="mr-1.5 inline size-3.5" aria-hidden />
              Dealerships
            </Link>
            {canMutatePlatform(admin.role) ? (
              <Link
                href="/onboarding"
                className="rounded-lg px-3 py-2 hover:bg-white/10"
              >
                <Plus className="mr-1.5 inline size-3.5" aria-hidden />
                Add dealership
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block" title={admin.email}>
              <span className="block text-[10px] font-extrabold text-slate-300">
                {admin.email}
              </span>
              <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                Platform {admin.role}
                {admin.source === "bootstrap_email" ? " · bootstrap" : ""}
              </span>
            </span>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-slate-700"
            >
              <LogOut className="size-3.5" aria-hidden />
              Leave platform view
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
