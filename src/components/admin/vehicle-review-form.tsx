"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  ShieldCheck,
  Star,
  Trash2,
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

type StagedPhoto = {
  id: string;
  file: File;
  preview: string;
};

const stagedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const stagedPhotoMaxBytes = 12 * 1024 * 1024;
const stagedPhotoMaxCount = 40;

export function VehicleReviewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lookup, setLookup] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [photoNotice, setPhotoNotice] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  function addPhotoFiles(fileList: FileList | null) {
    if (!fileList) return;
    const rejected: string[] = [];
    const accepted: StagedPhoto[] = [];
    for (const file of Array.from(fileList)) {
      if (!stagedPhotoTypes.has(file.type)) {
        rejected.push(`${file.name} is not a JPG, PNG or WebP image.`);
      } else if (file.size > stagedPhotoMaxBytes) {
        rejected.push(`${file.name} is larger than 12 MB.`);
      } else {
        accepted.push({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }
    setStagedPhotos((current) => {
      const room = stagedPhotoMaxCount - current.length;
      if (accepted.length > room) {
        accepted.slice(room).forEach((photo) => URL.revokeObjectURL(photo.preview));
        rejected.push(`Only the first ${stagedPhotoMaxCount} photos were kept.`);
      }
      return [...current, ...accepted.slice(0, Math.max(0, room))];
    });
    setPhotoNotice(rejected.join(" "));
  }

  function removeStagedPhoto(id: string) {
    setStagedPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((photo) => photo.id !== id);
    });
  }

  function makeCoverPhoto(id: string) {
    setStagedPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (!target) return current;
      return [target, ...current.filter((photo) => photo.id !== id)];
    });
  }

  async function uploadStagedPhotos(vehicleId: string, title: string) {
    const failed: StagedPhoto[] = [];
    setUploadProgress({ done: 0, total: stagedPhotos.length });
    for (const [index, photo] of stagedPhotos.entries()) {
      const formData = new FormData();
      formData.set("file", photo.file);
      formData.set("vehicleId", vehicleId);
      formData.set("altText", `${title} photograph ${index + 1}`.trim());
      try {
        const response = await fetch("/api/uploads/vehicle-images", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) failed.push(photo);
      } catch {
        failed.push(photo);
      }
      setUploadProgress({ done: index + 1, total: stagedPhotos.length });
    }
    setUploadProgress(null);
    stagedPhotos
      .filter((photo) => !failed.includes(photo))
      .forEach((photo) => URL.revokeObjectURL(photo.preview));
    return failed;
  }

  function finishCreation(vehicleId: string) {
    stagedPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    sessionStorage.removeItem("dealeros:vehicle-review");
    router.push(`/admin/stock/${vehicleId}?created=1&tab=media`);
    router.refresh();
  }

  async function retryPhotoUploads() {
    if (!createdVehicleId) return;
    setSaving(true);
    setError("");
    const failed = await uploadStagedPhotos(createdVehicleId, "Vehicle");
    setSaving(false);
    if (failed.length) {
      setStagedPhotos(failed);
      setError(
        `${failed.length} photo${failed.length === 1 ? "" : "s"} still could not be uploaded. Retry, or continue and add them from the vehicle's Photos tab.`,
      );
      return;
    }
    finishCreation(createdVehicleId);
  }

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
    if (createdVehicleId) {
      void retryPhotoUploads();
      return;
    }
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
      const id = result?.vehicle?.id ?? result?.data?.id ?? result?.id ?? "new";
      if (stagedPhotos.length && id !== "new") {
        setCreatedVehicleId(id);
        const failed = await uploadStagedPhotos(id, payload.publicTitle);
        if (failed.length) {
          setStagedPhotos(failed);
          setError(
            `The vehicle was created, but ${failed.length} photo${failed.length === 1 ? "" : "s"} could not be uploaded. Retry, or continue and add them from the vehicle's Photos tab.`,
          );
          return;
        }
      }
      finishCreation(id);
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

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-brand">
            Photography
          </p>
          <h2 className="mt-1 font-extrabold">Add photos now (optional)</h2>
          <p className="mt-1 text-xs text-foreground/45">
            Drop photos here and they are attached automatically when the vehicle is created.
            The first photo becomes the public cover; you can reorder or add more at any time
            from the vehicle&apos;s Photos tab.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
          {stagedPhotos.map((photo, index) => (
            <figure key={photo.id} className="overflow-hidden rounded-xl border">
              <div
                className="relative aspect-[4/3] bg-surface-muted bg-cover bg-center"
                style={{ backgroundImage: `url("${photo.preview}")` }}
              >
                {index === 0 ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-[#10231f] px-2 py-1 text-[9px] font-extrabold text-white">
                    <Star className="size-3 fill-[#d6a852] text-[#d6a852]" />
                    COVER
                  </span>
                ) : null}
              </div>
              <figcaption className="flex items-center justify-between gap-2 p-2">
                <span className="truncate text-[10px] font-semibold text-foreground/55">
                  {photo.file.name}
                </span>
                <span className="flex shrink-0 items-center">
                  {index !== 0 ? (
                    <button
                      type="button"
                      onClick={() => makeCoverPhoto(photo.id)}
                      className="grid size-7 place-items-center rounded-md hover:bg-surface-muted"
                      aria-label={`Make ${photo.file.name} the cover photo`}
                    >
                      <Star className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeStagedPhoto(photo.id)}
                    className="grid size-7 place-items-center rounded-md text-danger hover:bg-red-50"
                    aria-label={`Remove ${photo.file.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addPhotoFiles(event.dataTransfer.files);
            }}
            className="grid aspect-[4/3] min-h-40 place-items-center rounded-xl border-2 border-dashed text-center transition hover:border-brand/50 hover:bg-brand-soft/25"
          >
            <span>
              <ImageIcon className="mx-auto size-6 text-brand" />
              <span className="mt-2 block text-xs font-extrabold">
                Drop photos here or click to browse
              </span>
              <span className="mt-1 block text-[10px] text-foreground/40">
                JPG, PNG or WebP · 12 MB max each
              </span>
            </span>
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              addPhotoFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
        {photoNotice ? (
          <p className="border-t px-5 py-3 text-xs font-semibold text-amber-700">{photoNotice}</p>
        ) : null}
      </section>

      {error ? (
        <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-xs font-extrabold">
              {createdVehicleId ? "Photos not uploaded" : "Vehicle not created"}
            </p>
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
            {uploadProgress
              ? `Vehicle created. Uploading photo ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}…`
              : createdVehicleId
                ? "The vehicle record exists. Only the listed photos still need uploading."
                : "Creating the record starts in Appraisal. Staged photos upload automatically."}
          </p>
          {createdVehicleId && !saving ? (
            <Button type="button" variant="ghost" onClick={() => finishCreation(createdVehicleId)}>
              Continue without them
            </Button>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : null}
            {saving
              ? uploadProgress
                ? "Uploading photos…"
                : "Creating vehicle…"
              : createdVehicleId
                ? "Retry photo uploads"
                : stagedPhotos.length
                  ? `Create and upload ${stagedPhotos.length} photo${stagedPhotos.length === 1 ? "" : "s"}`
                  : "Confirm and create"}
            {!saving ? <ArrowRight /> : null}
          </Button>
        </div>
      </div>
    </form>
  );
}
