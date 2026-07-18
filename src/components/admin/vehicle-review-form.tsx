"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { Notice } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReviewData = {
  registration?: string;
  make?: string;
  model?: string;
  colour?: string;
  fuelType?: string;
  engineCapacity?: number | string;
  engineSizeCc?: number | string;
  yearOfManufacture?: number | string;
  year?: number | string;
  monthOfFirstRegistration?: string;
  firstRegistrationDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  motExpiryDate?: string;
  motExpiry?: string;
  co2Emissions?: number | string;
  euroStatus?: string;
  typeApproval?: string;
  markedForExport?: boolean;
  lookupSource?: "provider" | "manual";
};

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-extrabold">
        {label} {required ? <span className="text-danger">*</span> : null}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-2"
      />
      {hint ? <p className="mt-1 text-[10px] leading-4 text-foreground/40">{hint}</p> : null}
    </div>
  );
}

export function VehicleReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lookup, setLookup] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = sessionStorage.getItem("dealeros:vehicle-review");
      if (stored) {
        try {
          setLookup(JSON.parse(stored) as ReviewData);
        } catch {
          setLookup({ registration: searchParams.get("registration") ?? "", lookupSource: "manual" });
        }
      } else {
        setLookup({ registration: searchParams.get("registration") ?? "", lookupSource: "manual" });
      }
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  async function createVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const number = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };
    const make = String(data.get("make") ?? "").trim();
    const model = String(data.get("model") ?? "").trim();
    const derivative = String(data.get("derivative") ?? "").trim();
    const year = number("year");
    const payload = {
      registration: String(data.get("registration") ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      vin: null,
      make,
      model,
      derivative: derivative || null,
      trim: String(data.get("trim") ?? "") || null,
      bodyType: String(data.get("bodyType") ?? "") || null,
      fuelType: String(data.get("fuelType") ?? ""),
      transmission: String(data.get("transmission") ?? ""),
      colour: String(data.get("colour") ?? ""),
      year,
      engineSizeCc: number("engineSizeCc"),
      mileage: number("mileage"),
      firstRegistrationDate: String(data.get("firstRegistrationDate") ?? "") || null,
      motExpiry: String(data.get("motExpiry") ?? "") || null,
      taxStatus: String(data.get("taxStatus") ?? "") || null,
      co2EmissionsGKm: number("co2EmissionsGKm"),
      euroStatus: String(data.get("euroStatus") ?? "") || null,
      typeApproval: String(data.get("typeApproval") ?? "") || null,
      purchasePrice: number("purchasePrice"),
      retailPrice: number("retailPrice"),
      preparationCosts: 0,
      repairCosts: 0,
      otherCosts: 0,
      minimumAcceptablePrice: null,
      depositAmount: 0,
      mileageVerified: data.get("mileageVerified") === "on",
      publicTitle: [year, make, model, derivative].filter(Boolean).join(" "),
      attentionGrabber: null,
      description: "Vehicle details and public presentation are being prepared by our team.",
      features: [],
      standardEquipment: [],
      optionalEquipment: [],
      financeExampleText: null,
      warrantyWording: null,
      videoUrl: null,
      featured: false,
      isPublic: false,
      provider: lookup?.lookupSource ?? "manual",
      lookupRetrievedAt:
        lookup?.lookupSource === "provider" ? new Date().toISOString() : undefined,
      reviewed: true,
      status: "appraisal",
      inspectionNotes: String(data.get("internalNotes") ?? "") || null,
    };

    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            message?: string;
            id?: string;
            data?: { id?: string };
            vehicle?: { id?: string };
          }
        | null;
      if (!response.ok || result?.ok === false) {
        setError(result?.message ?? "The vehicle could not be created. Your review details remain here.");
        return;
      }
      sessionStorage.removeItem("dealeros:vehicle-review");
      const id = result?.vehicle?.id ?? result?.data?.id ?? result?.id ?? "new";
      router.push(`/admin/stock/${id}?created=1`);
      router.refresh();
    } catch {
      setError("DealerOS could not reach the server. Nothing was saved; please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !lookup) {
    return (
      <div className="grid min-h-80 place-items-center">
        <LoaderCircle className="size-6 animate-spin text-brand" aria-label="Loading lookup details" />
      </div>
    );
  }

  const provider = lookup.lookupSource === "provider";

  return (
    <form onSubmit={createVehicle} className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-center gap-2" aria-label="Step 2 of 3">
        {([
          ["1", "Lookup", true],
          ["2", "Review", true],
          ["3", "Create", false],
        ] as const).map(([number, label, complete], index) => (
          <div key={label} className="contents">
            {index ? <span className="h-px w-8 bg-brand/35 sm:w-16" /> : null}
            <span className="flex items-center gap-2">
              <span
                className={`grid size-7 place-items-center rounded-full text-[10px] font-extrabold ${
                  complete ? "bg-brand text-white" : "bg-surface-muted text-foreground/35"
                }`}
              >
                {number === "1" ? <Check className="size-3.5" /> : number}
              </span>
              <span className="hidden text-xs font-extrabold text-foreground/55 sm:inline">
                {label}
              </span>
            </span>
          </div>
        ))}
      </div>

      <Notice title={provider ? "Provider data needs your confirmation" : "Manual entry"}>
        {provider
          ? "The registration service can provide basic vehicle facts, but not a guaranteed model, derivative, gearbox, body style, equipment list or valuation. Check every field against the vehicle and its documents."
          : "The data provider was not used or did not return a result. Enter only details you can verify from the vehicle, V5C or another authorised source."}
      </Notice>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand">
              Registration facts
            </p>
            <h2 className="mt-1 font-extrabold">Review the returned information</h2>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[10px] font-extrabold text-brand sm:flex">
            <ShieldCheck className="size-3.5" />
            {provider ? "Provider lookup" : "Manual"}
          </span>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Registration" name="registration" defaultValue={lookup.registration} required />
          <Field label="Make" name="make" defaultValue={lookup.make} required />
          <Field
            label="Year of manufacture"
            name="year"
            type="number"
            defaultValue={lookup.yearOfManufacture ?? lookup.year}
            required
          />
          <Field label="Colour" name="colour" defaultValue={lookup.colour} />
          <Field label="Fuel type" name="fuelType" defaultValue={lookup.fuelType} required />
          <Field
            label="Engine capacity (cc)"
            name="engineSizeCc"
            type="number"
            defaultValue={lookup.engineCapacity ?? lookup.engineSizeCc}
          />
          <Field
            label="First registration date"
            name="firstRegistrationDate"
            type="date"
            defaultValue={lookup.firstRegistrationDate}
          />
          <Field
            label="MOT expiry"
            name="motExpiry"
            type="date"
            defaultValue={lookup.motExpiryDate ?? lookup.motExpiry}
          />
          <Field label="Tax status" name="taxStatus" defaultValue={lookup.taxStatus} />
          <Field
            label="CO₂ emissions (g/km)"
            name="co2EmissionsGKm"
            type="number"
            defaultValue={lookup.co2Emissions}
          />
          <Field label="Euro status" name="euroStatus" defaultValue={lookup.euroStatus} />
          <Field label="Type approval" name="typeApproval" defaultValue={lookup.typeApproval} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand">
            Staff confirmation
          </p>
          <h2 className="mt-1 font-extrabold">Complete the stock essentials</h2>
          <p className="mt-1 text-xs text-foreground/45">
            These details generally require manual confirmation or a licensed taxonomy provider.
          </p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Model" name="model" defaultValue={lookup.model} required />
          <Field label="Derivative" name="derivative" hint="For example, 320i M Sport" />
          <Field label="Trim" name="trim" />
          <Field label="Body type" name="bodyType" />
          <Field label="Transmission" name="transmission" required />
          <Field label="Current mileage" name="mileage" type="number" required />
          <Field label="Purchase price" name="purchasePrice" type="number" />
          <Field label="Proposed retail price" name="retailPrice" type="number" />
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" name="mileageVerified" className="size-4 accent-brand" />
              Mileage checked against evidence
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="internalNotes" className="text-xs font-extrabold">
              Internal acquisition notes
            </label>
            <Textarea
              id="internalNotes"
              name="internalNotes"
              className="mt-2"
              placeholder="Condition observations, provenance checks still required, known faults…"
            />
            <p className="mt-1 text-[10px] text-foreground/40">
              Internal only. This note will never appear on the public website.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-extrabold">Vehicle not created</p>
            <p className="mt-1 text-xs leading-5 opacity-75">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/stock/new")}>
          <ArrowLeft />
          Back to lookup
        </Button>
        <div className="flex items-center gap-3">
          <p className="hidden max-w-xs text-right text-[10px] leading-4 text-foreground/40 md:block">
            Creating the record starts in Appraisal. You can add photos and publish it next.
          </p>
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : null}
            {saving ? "Creating vehicle…" : "Confirm and create"}
            {!saving ? <ArrowRight /> : null}
          </Button>
        </div>
      </div>
    </form>
  );
}
