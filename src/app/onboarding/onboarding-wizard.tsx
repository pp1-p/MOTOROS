"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

import { themeDefinitions } from "@/lib/themes";

const steps = ["Business", "Brand", "Website", "Owner & review"] as const;
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function OnboardingWizard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [themeId, setThemeId] = useState("direct-motors-classic");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400";
  const textareaClass = "mt-1.5 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400";

  function continueToNextStep() {
    const fieldset = formRef.current?.querySelector<HTMLFieldSetElement>(
      `fieldset[data-step="${step}"]`,
    );
    const controls = Array.from(
      fieldset?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ) ?? [],
    );
    const firstInvalid = controls.find((control) => !control.checkValidity());
    if (firstInvalid) {
      firstInvalid.reportValidity();
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(`Create ${name} as a new MOTOROS dealership?`)) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/platform/dealerships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        subdomain,
        planCode: form.get("planCode"),
        telephone: form.get("telephone"),
        email: form.get("email"),
        address: form.get("address"),
        primaryColour: form.get("primaryColour"),
        accentColour: form.get("accentColour"),
        fontPreset: form.get("fontPreset"),
        themeId,
        customDomain: form.get("customDomain"),
        ownerEmail: form.get("ownerEmail"),
        confirmation: "CONFIRM",
      }),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as {
          message?: string;
          redirectTo?: string;
        } | null)
      : null;
    if (!response?.ok) {
      setBusy(false);
      setMessage(result?.message ?? "The dealership could not be created.");
      return;
    }
    setMessage(result?.message ?? "Dealership created.");
    window.location.assign(result?.redirectTo ?? "/platform");
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
      <ol className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
        {steps.map((label, index) => (
          <li key={label} className={`border-white/10 p-4 text-[10px] font-extrabold uppercase tracking-wider sm:border-r ${index === step ? "bg-cyan-400/10 text-cyan-300" : index < step ? "text-emerald-300" : "text-slate-500"}`}>
            <span className="mr-2 inline-grid size-5 place-items-center rounded-full border border-current">{index < step ? "✓" : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      <div className="p-5 sm:p-7">
        <fieldset data-step="0" hidden={step !== 0} className="space-y-5">
          <legend className="text-xl font-extrabold">Business identity</legend>
          <p className="text-xs leading-5 text-slate-400">Names and host labels are unique across MotorOS. They can be reviewed before creation.</p>
          <label className="block text-xs font-extrabold">Business name<input name="name" required minLength={2} maxLength={120} value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!slug || slug === slugify(name)) setSlug(slugify(next)); if (!subdomain || subdomain === slugify(name)) setSubdomain(slugify(next)); }} className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-extrabold">Unique slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} className={inputClass} /></label>
            <label className="text-xs font-extrabold">MotorOS subdomain<input name="subdomain" required pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" value={subdomain} onChange={(event) => setSubdomain(slugify(event.target.value))} className={inputClass} /></label>
          </div>
          <label className="block text-xs font-extrabold">Plan metadata<select name="planCode" defaultValue="starter" className={inputClass}><option value="starter">Starter</option><option value="growth">Growth</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></label>
        </fieldset>

        <fieldset data-step="1" hidden={step !== 1} className="space-y-5">
          <legend className="text-xl font-extrabold">Contact and brand</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-extrabold">Public telephone<input name="telephone" type="tel" className={inputClass} /></label>
            <label className="text-xs font-extrabold">Public email<input name="email" type="email" className={inputClass} /></label>
          </div>
          <label className="block text-xs font-extrabold">Public address<textarea name="address" className={textareaClass} /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-extrabold">Primary colour<input name="primaryColour" type="color" defaultValue="#172033" className={inputClass} /></label>
            <label className="text-xs font-extrabold">Accent colour<input name="accentColour" type="color" defaultValue="#D4A853" className={inputClass} /></label>
            <label className="text-xs font-extrabold">Font preset<select name="fontPreset" defaultValue="classic" className={inputClass}><option value="classic">Classic</option><option value="modern">Modern</option><option value="editorial">Editorial</option><option value="condensed">Condensed</option></select></label>
          </div>
        </fieldset>

        <fieldset data-step="2" hidden={step !== 2} className="space-y-5">
          <legend className="text-xl font-extrabold">Website design and domain</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {themeDefinitions.map((theme) => (
              <label key={theme.id} className={`cursor-pointer rounded-2xl border p-4 transition ${themeId === theme.id ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 hover:border-white/25"}`}>
                <input type="radio" name="themeId" value={theme.id} checked={themeId === theme.id} onChange={() => setThemeId(theme.id)} className="sr-only" />
                <span className="block text-sm font-extrabold">{theme.name}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{theme.description}</span>
              </label>
            ))}
          </div>
          <label className="block text-xs font-extrabold">Dealership website URL / custom domain<input name="customDomain" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://www.dealership.co.uk" className={inputClass} /><span className="mt-1.5 block font-normal text-slate-500">Paste their current website URL or enter a domain. MotorOS stores the hostname and creates it as pending until ownership and DNS are verified.</span></label>
        </fieldset>

        <fieldset data-step="3" hidden={step !== 3} className="space-y-5">
          <legend className="text-xl font-extrabold">Owner and review</legend>
          <label className="block text-xs font-extrabold">Owner work email<input name="ownerEmail" type="email" placeholder="owner@dealership.co.uk" className={inputClass} /><span className="mt-1.5 block font-normal text-slate-500">If supplied, MotorOS creates a seven-day owner invitation through Supabase Auth.</span></label>
          <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Dealership</dt><dd className="mt-1 font-extrabold">{name || "Not entered"}</dd></div><div><dt className="text-xs text-slate-500">Slug / subdomain</dt><dd className="mt-1 font-extrabold">{slug || "—"} / {subdomain || "—"}</dd></div><div><dt className="text-xs text-slate-500">Initial design</dt><dd className="mt-1 font-extrabold">{themeDefinitions.find((theme) => theme.id === themeId)?.name}</dd></div><div><dt className="text-xs text-slate-500">Initial state</dt><dd className="mt-1 font-extrabold">Trial · website draft</dd></div></dl>
          </div>
          <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-4 text-xs leading-5 text-amber-100">After creation, the dealership owner completes stock import, website content review and publication inside their tenant admin. A custom domain must remain pending until ownership and DNS checks pass.</div>
        </fieldset>

        {message ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-xs font-bold text-red-200">{message}</p> : null}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 p-5">
        <button type="button" disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-extrabold disabled:opacity-40"><ArrowLeft className="size-4" />Back</button>
        {step < steps.length - 1 ? <button type="button" onClick={continueToNextStep} className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-300">Continue<ArrowRight className="size-4" /></button> : <button disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{busy ? "Creating dealership…" : "Confirm and create"}</button>}
      </div>
    </form>
  );
}
