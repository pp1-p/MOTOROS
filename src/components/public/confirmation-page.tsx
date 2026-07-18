import {
  ArrowRight,
  Check,
  Clock3,
  MailCheck,
  Phone,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getPublicSiteConfig } from "@/lib/data/site-config";

export async function ConfirmationPage({
  eyebrow,
  title,
  message,
  steps,
  primaryHref = "/cars",
  primaryLabel = "Browse cars",
}: {
  eyebrow: string;
  title: string;
  message: string;
  steps: string[];
  primaryHref?: string;
  primaryLabel?: string;
}) {
  const publicSiteConfig = await getPublicSiteConfig();
  return (
    <section className="relative overflow-hidden bg-[#15221d] py-16 text-white sm:py-24">
      <div className="absolute top-0 right-0 size-[34rem] rounded-full bg-[#d7ad69]/10 blur-3xl" />
      <div className="container-shell relative max-w-4xl">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-10 lg:p-14">
          <div className="grid size-16 place-items-center rounded-full bg-[#d7ad69] text-[#15221d]">
            <Check className="size-8" strokeWidth={3} aria-hidden />
          </div>
          <p className="mt-8 text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[0.96] tracking-tight text-balance sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/65">
            {message}
          </p>

          <div className="mt-10 grid gap-4 border-y border-white/10 py-8 sm:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = [MailCheck, Clock3, Phone][index] ?? Check;
              return (
                <div key={step} className="flex items-start gap-3">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-[#d7ad69]"
                    aria-hidden
                  />
                  <p className="text-sm leading-6 font-semibold text-white/75">
                    {step}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-[#d7ad69] text-[#171814] hover:bg-[#e3bd7e]"
            >
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 text-white hover:bg-white/10"
            >
              <a href={publicSiteConfig.phoneHref}>
                <Phone aria-hidden />
                {publicSiteConfig.phone}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
