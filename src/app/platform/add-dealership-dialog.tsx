"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, X } from "lucide-react";

import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";

type AddDealershipDialogProps = {
  variant?: "primary" | "nav";
};

export function AddDealershipDialog({
  variant = "primary",
}: AddDealershipDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const triggerClass =
    variant === "nav"
      ? "rounded-lg px-3 py-2 hover:bg-white/10"
      : "inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-300";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        <Plus
          className={variant === "nav" ? "mr-1.5 inline size-3.5" : "size-4"}
          aria-hidden
        />
        Add dealership
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-dealership-title"
            className="my-3 w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <Building2 className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                    Platform provisioning
                  </p>
                  <h2 id="add-dealership-title" className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                    Add a dealership to MOTOROS
                  </h2>
                  <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                    Add the dealership&apos;s business details, contact information, website URL, MotorOS address, plan, branding and owner login. The dealership is created as an isolated tenant and starts with its website in draft.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close add dealership dialog"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <OnboardingWizard />
          </section>
        </div>
      ) : null}
    </>
  );
}
