import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  summary,
  lastUpdated = "16 July 2026",
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated?: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="border-b bg-[#15221d] py-14 text-white sm:py-20">
        <div className="container-shell max-w-4xl">
          <p className="text-xs font-extrabold tracking-[0.18em] text-[#d7ad69] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[0.96] tracking-tight sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/65">
            {summary}
          </p>
          <p className="mt-5 text-xs font-bold text-white/45">
            Last updated: {lastUpdated}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-20">
        <div className="container-shell max-w-4xl">
          <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              <strong>Dealership review required.</strong> This operational
              draft supports the website’s privacy controls but is not legal
              advice. The dealership must review it with an appropriately
              qualified adviser and replace any incomplete business details
              before launch.
            </p>
          </div>

          <div className="grid gap-10">
            {sections.map((section) => (
              <section key={section.title} className="border-b pb-10 last:border-0">
                <h2 className="font-display text-3xl tracking-tight">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/68 [&_a]:font-bold [&_a]:text-brand [&_a]:underline [&_li]:pl-1 [&_strong]:text-foreground [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5">
                  {section.content}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

