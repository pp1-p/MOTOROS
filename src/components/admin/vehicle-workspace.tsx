"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  CloudUpload,
  Eye,
  FileCheck2,
  GripVertical,
  ImageIcon,
  LoaderCircle,
  Save,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import type {
  AdminVehicle,
  AdminVehicleHistory,
  AdminVehiclePhoto,
} from "@/components/admin/admin-data";
import { Notice, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency, formatMileage } from "@/lib/utils";

type Tab = "overview" | "advert" | "media" | "costs" | "history";
function FormField({
  label,
  name,
  defaultValue,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-[11px] font-extrabold">
        {label}
      </label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} className="mt-1.5" />
      {hint ? <p className="mt-1 text-[10px] text-foreground/40">{hint}</p> : null}
    </div>
  );
}

export function VehicleWorkspace({
  vehicle,
  initialPhotos,
  initialHistory,
  canViewCommercial,
}: {
  vehicle: AdminVehicle;
  initialPhotos: AdminVehiclePhoto[];
  initialHistory: AdminVehicleHistory[];
  canViewCommercial: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState(vehicle.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(
    vehicle.isPublic ?? vehicle.status === "On forecourt",
  );
  const uploadInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<AdminVehiclePhoto[]>(initialPhotos);

  const slug =
    vehicle.slug ??
    vehicle.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  const margin = vehicle.price - vehicle.cost;
  const marginPercent = Math.round((margin / vehicle.price) * 1000) / 10;

  async function patchVehicle(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "Changes could not be saved. Nothing has been discarded.");
        return false;
      }
      setMessage(successMessage);
      return true;
    } catch {
      setMessage("DealerOS could not reach the server. Your changes remain on screen.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const features = String(values.features ?? "")
      .split(/\r?\n/)
      .map((feature) => feature.trim())
      .filter(Boolean);
    await patchVehicle(
      {
        ...values,
        features,
        featured: values.featured === "on",
        status: status.toLowerCase().replace(/\s+/g, "_"),
        isPublic: published,
        changeReason: `Staff saved the ${tab} section`,
      },
      "Vehicle changes saved.",
    );
  }

  async function changeStatus(nextStatus: string) {
    const oldStatus = status;
    setStatus(nextStatus);
    const ok = await patchVehicle(
      {
        status: nextStatus.toLowerCase().replace(/\s+/g, "_"),
        changeReason: `Status changed to ${nextStatus}`,
      },
      `Vehicle moved to ${nextStatus}.`,
    );
    if (!ok) setStatus(oldStatus);
  }

  function uploadPhoto(file: File) {
    return new Promise<void>((resolve) => {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setMessage(`${file.name} must be an image smaller than 10 MB.`);
      resolve();
      return;
    }
    const tempId = `upload-${crypto.randomUUID()}`;
    const preview = URL.createObjectURL(file);
    setPhotos((current) => [
      ...current,
      {
        id: tempId,
        url: preview,
        altText: `${vehicle.title} photograph`,
        status: "uploading",
        progress: 0,
      },
    ]);

    const formData = new FormData();
    formData.set("vehicleId", vehicle.id);
    formData.set("file", file);
    formData.set("altText", `${vehicle.title} photograph`);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/vehicle-images");
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      setPhotos((current) =>
        current.map((photo) => (photo.id === tempId ? { ...photo, progress } : photo)),
      );
    });
    xhr.addEventListener("load", () => {
      type UploadResult = {
        id?: string;
        url?: string;
        data?: { id?: string; url?: string };
        image?: { id?: string; publicUrl?: string };
      };
      let result: UploadResult | null = null;
      try {
        result = JSON.parse(xhr.responseText) as UploadResult;
      } catch {
        result = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        setPhotos((current) =>
          current.map((photo) =>
            photo.id === tempId ? { ...photo, status: "error", progress: undefined } : photo,
          ),
        );
        setMessage(`${file.name} could not be uploaded. Remove it and try again.`);
        resolve();
        return;
      }
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === tempId
            ? {
                ...photo,
                id: result?.image?.id ?? result?.data?.id ?? result?.id ?? tempId,
                url: result?.image?.publicUrl ?? result?.data?.url ?? result?.url ?? preview,
                status: "ready",
                progress: undefined,
              }
            : photo,
        ),
      );
      setMessage(`${file.name} uploaded.`);
      resolve();
    });
    xhr.addEventListener("error", () => {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === tempId ? { ...photo, status: "error", progress: undefined } : photo,
        ),
      );
      setMessage(`${file.name} could not be uploaded. Check your connection and try again.`);
      resolve();
    });
    xhr.send(formData);
    });
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    void (async () => {
      for (const file of files) {
        await uploadPhoto(file);
      }
    })();
  }

  async function persistOrder(next: AdminVehiclePhoto[]) {
    const readyImages = next.filter((photo) => photo.status === "ready");
    setPhotos(next);
    if (!readyImages.length) return true;
    try {
      const response = await fetch("/api/vehicle-images/reorder", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          imageIds: readyImages.map((photo) => photo.id),
          coverImageId: readyImages.find((photo) => photo.cover)?.id ?? readyImages[0]?.id,
        }),
      });
      if (!response.ok) {
        setMessage("The photo order changed here but could not be saved.");
        return false;
      }
      return true;
    } catch {
      setMessage("The photo order changed here but could not be saved.");
      return false;
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    const currentPhoto = next[index];
    const targetPhoto = next[target];
    if (!currentPhoto || !targetPhoto) return;
    next[index] = targetPhoto;
    next[target] = currentPhoto;
    next.forEach((photo, photoIndex) => {
      photo.cover = photoIndex === 0;
    });
    void persistOrder(next);
  }

  async function removePhoto(id: string) {
    if (!window.confirm("Remove this photograph from the vehicle? This action is audited.")) return;
    const persistedId = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
    if (persistedId) {
      try {
        const response = await fetch(`/api/vehicle-images/${id}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: true }),
        });
        if (!response.ok) {
          setMessage("The photograph could not be removed. It remains attached to the vehicle.");
          return;
        }
      } catch {
        setMessage("The photograph could not be removed. Check your connection and try again.");
        return;
      }
    }
    const next = photos.filter((photo) => photo.id !== id);
    next.forEach((photo, index) => {
      photo.cover = index === 0;
    });
    if (next.length) void persistOrder(next);
    else setPhotos([]);
  }

  async function savePhotoAltText(photo: AdminVehiclePhoto) {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(photo.id)) return;
    try {
      const response = await fetch(`/api/vehicle-images/${photo.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ altText: photo.altText }),
      });
      if (!response.ok) {
        setMessage("The image description could not be saved.");
      }
    } catch {
      setMessage("The image description could not be saved.");
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Vehicle details" },
    { id: "advert", label: "Advert" },
    { id: "media", label: "Photos", count: photos.length },
    ...(canViewCommercial
      ? ([{ id: "costs", label: "Costs & margin" }] as const)
      : []),
    { id: "history", label: "History", count: initialHistory.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/stock"
          className="grid size-9 place-items-center rounded-xl border bg-white text-foreground/50 hover:text-foreground"
          aria-label="Back to stock"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-[-0.035em] sm:text-2xl">
              {vehicle.title}
            </h1>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-foreground/45">
            {vehicle.stockNumber} · {vehicle.registration} · {formatMileage(vehicle.mileage)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/cars/${slug}`} target="_blank">
            <Eye />
            Public preview
          </Link>
        </Button>
        <label className="relative">
          <span className="sr-only">Vehicle status</span>
          <select
            value={status}
            onChange={(event) => void changeStatus(event.target.value)}
            className="h-9 appearance-none rounded-xl border bg-white pl-3 pr-8 text-xs font-extrabold"
          >
            {[
              "Appraisal",
              "Purchased",
              "Due in",
              "Preparation",
              "Photography required",
              "Ready for sale",
              "On forecourt",
              "Reserved",
              "Sale in progress",
              "Sold",
              "Returned",
              "Archived",
            ].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground/35" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Retail price", formatCurrency(vehicle.price), "Listed"],
          ...(canViewCommercial
            ? [
                ["Total cost", formatCurrency(vehicle.cost), "Acquisition + prep"],
                [
                  "Estimated margin",
                  formatCurrency(margin),
                  `${marginPercent}% of retail`,
                ],
              ]
            : []),
          ["Stock age", `${vehicle.age} days`, vehicle.age > 20 ? "Review pricing" : "On target"],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border bg-white p-3.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-foreground/35">
              {label}
            </p>
            <p className="mt-1 text-lg font-extrabold tracking-[-0.03em]">{value}</p>
            <p className="mt-0.5 text-[10px] text-foreground/42">{detail}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-6">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setMessage("");
              }}
              className={cn(
                "relative py-3 text-xs font-extrabold",
                tab === item.id ? "text-brand" : "text-foreground/42 hover:text-foreground",
              )}
              aria-pressed={tab === item.id}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[9px]">
                  {item.count}
                </span>
              ) : null}
              {tab === item.id ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold",
            message.toLowerCase().includes("could not") || message.toLowerCase().includes("must be")
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950",
          )}
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : message.toLowerCase().includes("could not") ? (
            <CircleAlert className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
          {message}
        </div>
      ) : null}

      {tab === "overview" ? (
        <form onSubmit={saveForm} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section className="rounded-2xl border bg-white">
              <div className="border-b p-5">
                <h2 className="font-extrabold">Identification</h2>
                <p className="mt-1 text-xs text-foreground/42">
                  Core vehicle identity. Registration and VIN changes are audited.
                </p>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Registration" name="registration" defaultValue={vehicle.registration} />
                <FormField label="Stock number" name="stockNumber" defaultValue={vehicle.stockNumber} />
                <FormField label="VIN" name="vin" defaultValue={vehicle.vin ?? ""} />
                <FormField label="Make" name="make" defaultValue={vehicle.make ?? ""} />
                <FormField label="Model" name="model" defaultValue={vehicle.model ?? ""} />
                <FormField label="Derivative" name="derivative" defaultValue={vehicle.derivative ?? ""} />
                <FormField label="Body type" name="bodyType" defaultValue={vehicle.bodyType ?? ""} />
                <FormField label="Fuel type" name="fuelType" defaultValue={vehicle.fuelType ?? ""} />
                <FormField label="Transmission" name="transmission" defaultValue={vehicle.transmission ?? ""} />
                <FormField label="Colour" name="colour" defaultValue={vehicle.colour ?? ""} />
                <FormField label="Doors" name="doors" type="number" defaultValue={vehicle.doors ?? ""} />
                <FormField label="Seats" name="seats" type="number" defaultValue={vehicle.seats ?? ""} />
              </div>
            </section>

            <section className="rounded-2xl border bg-white">
              <div className="border-b p-5">
                <h2 className="font-extrabold">Technical & condition</h2>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Mileage" name="mileage" type="number" defaultValue={vehicle.mileage} />
                <FormField label="Engine size (cc)" name="engineSizeCc" type="number" defaultValue={vehicle.engineSizeCc ?? ""} />
                <FormField label="Power (bhp)" name="powerBhp" type="number" defaultValue={vehicle.powerBhp ?? ""} />
                <FormField label="CO₂ (g/km)" name="co2EmissionsGKm" type="number" defaultValue={vehicle.co2EmissionsGKm ?? ""} />
                <FormField label="MOT expiry" name="motExpiry" type="date" defaultValue={vehicle.motExpiry ?? ""} />
                <FormField label="Previous owners" name="previousOwners" type="number" defaultValue={vehicle.previousOwners ?? ""} />
                <FormField label="Service history" name="serviceHistory" defaultValue={vehicle.serviceHistory ?? ""} />
                <FormField label="Number of keys" name="keys" type="number" defaultValue={vehicle.keys ?? ""} />
                <FormField label="Provenance status" name="provenanceStatus" defaultValue={vehicle.provenanceStatus ?? ""} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="inspectionNotes" className="text-[11px] font-extrabold">
                    Inspection notes
                  </label>
                  <Textarea
                    id="inspectionNotes"
                    name="inspectionNotes"
                    className="mt-1.5"
                    defaultValue={vehicle.inspectionNotes ?? ""}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-extrabold">Preparation checklist</h2>
              <p className="mt-1 text-xs text-foreground/42">4 of 6 items complete</p>
              <div className="mt-4 space-y-3">
                {[
                  ["HPI / provenance check", true],
                  ["Mechanical inspection", true],
                  ["Service completed", true],
                  ["MOT check", true],
                  ["Alloy wheel repair", false],
                  ["Final valet", false],
                ].map(([label, checked]) => (
                  <label key={String(label)} className="flex items-center gap-2.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      name={`checklist-${String(label).toLowerCase().replace(/\W+/g, "-")}`}
                      defaultChecked={Boolean(checked)}
                      className="size-4 accent-brand"
                    />
                    {String(label)}
                  </label>
                ))}
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full w-2/3 rounded-full bg-brand" />
              </div>
            </section>
            <Notice title="Sensitive data">
              Purchase costs, margin and internal notes are available only to authorised staff and
              are never included in public vehicle responses.
            </Notice>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              Save vehicle details
            </Button>
          </aside>
        </form>
      ) : null}

      {tab === "advert" ? (
        <form onSubmit={saveForm} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Public vehicle advert</h2>
              <p className="mt-1 text-xs text-foreground/42">
                Control exactly what customers see on your website.
              </p>
            </div>
            <div className="space-y-5 p-5">
              <FormField label="Public title" name="publicTitle" defaultValue={vehicle.title} />
              <FormField
                label="Attention grabber"
                name="attentionGrabber"
                defaultValue={vehicle.attentionGrabber ?? ""}
              />
              <div>
                <label htmlFor="description" className="text-[11px] font-extrabold">
                  Full description
                </label>
                <Textarea
                  id="description"
                  name="description"
                  className="mt-1.5 min-h-48"
                  defaultValue={vehicle.description ?? ""}
                />
              </div>
              <div>
                <label htmlFor="features" className="text-[11px] font-extrabold">
                  Key features
                </label>
                <Textarea
                  id="features"
                  name="features"
                  className="mt-1.5"
                  defaultValue={(vehicle.features ?? []).join("\n")}
                />
                <p className="mt-1 text-[10px] text-foreground/40">One feature per line.</p>
              </div>
              <FormField label="SEO slug" name="slug" defaultValue={slug} />
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-extrabold">Publishing</h2>
              <label className="mt-4 flex items-start gap-3 rounded-xl bg-surface-muted p-3">
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                  className="mt-0.5 size-4 accent-brand"
                />
                <span>
                  <span className="block text-xs font-extrabold">Publish on dealership website</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-foreground/45">
                    The advert must also have an eligible status, price, description and photo.
                  </span>
                </span>
              </label>
              <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={vehicle.featured}
                  className="size-4 accent-brand"
                />
                Feature this vehicle on the homepage
              </label>
              <div className="mt-5 border-t pt-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-foreground/35">
                  Website readiness
                </p>
                <div className="mt-3 space-y-2">
                  {["Public title", "Retail price", "Description", "Cover image"].map((item) => (
                    <p key={item} className="flex items-center gap-2 text-xs font-semibold">
                      <Check className="size-3.5 text-emerald-600" />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </section>
            <Notice title="Specification disclaimer" tone="info">
              Customers are told to verify specifications. Only publish features your team has
              physically checked or received from a licensed source.
            </Notice>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              Save advert
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/cars/${slug}`} target="_blank">
                <Eye />
                Preview public page
              </Link>
            </Button>
          </aside>
        </form>
      ) : null}

      {tab === "media" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-2xl border bg-white">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h2 className="font-extrabold">Vehicle photography</h2>
                <p className="mt-1 text-xs text-foreground/42">
                  First image is the cover. Use the controls to change the public order.
                </p>
              </div>
              <Button size="sm" onClick={() => uploadInput.current?.click()}>
                <CloudUpload />
                Upload
              </Button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, index) => (
                <article key={photo.id} className="overflow-hidden rounded-xl border bg-white">
                  <div
                    className="relative aspect-[4/3] bg-surface-muted bg-cover bg-center"
                    style={{ backgroundImage: `url("${photo.url}")` }}
                  >
                    {photo.cover ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-lg bg-[#10231f] px-2 py-1 text-[9px] font-extrabold text-white">
                        <Star className="size-3 fill-[#d6a852] text-[#d6a852]" />
                        COVER
                      </span>
                    ) : null}
                    {photo.status === "uploading" ? (
                      <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                        <div className="w-2/3 text-center">
                          <LoaderCircle className="mx-auto size-5 animate-spin" />
                          <p className="mt-2 text-[10px] font-extrabold">{photo.progress ?? 0}%</p>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
                            <div
                              className="h-full bg-white"
                              style={{ width: `${photo.progress ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {photo.status === "error" ? (
                      <div className="absolute inset-0 grid place-items-center bg-red-950/70 text-white">
                        <div className="text-center">
                          <CircleAlert className="mx-auto size-5" />
                          <p className="mt-2 text-[10px] font-extrabold">Upload failed</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-foreground/35">
                      Alt text
                      <input
                        value={photo.altText}
                        onChange={(event) =>
                          setPhotos((current) =>
                            current.map((item) =>
                              item.id === photo.id ? { ...item, altText: event.target.value } : item,
                            ),
                          )
                        }
                        onBlur={() => void savePhotoAltText(photo)}
                        className="mt-1 block h-8 w-full rounded-lg border px-2 text-[10px] font-semibold normal-case tracking-normal"
                      />
                    </label>
                    <div className="mt-2 flex items-center gap-1">
                      <GripVertical className="mr-auto size-4 text-foreground/25" />
                      <button
                        type="button"
                        onClick={() => movePhoto(index, -1)}
                        disabled={index === 0}
                        className="grid size-7 place-items-center rounded-md hover:bg-surface-muted disabled:opacity-25"
                        aria-label="Move photo earlier"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(index, 1)}
                        disabled={index === photos.length - 1}
                        className="grid size-7 place-items-center rounded-md hover:bg-surface-muted disabled:opacity-25"
                        aria-label="Move photo later"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removePhoto(photo.id)}
                        className="grid size-7 place-items-center rounded-md text-danger hover:bg-red-50"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              <button
                type="button"
                onClick={() => uploadInput.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFiles(event.dataTransfer.files);
                }}
                className="grid aspect-[4/3] min-h-48 place-items-center rounded-xl border-2 border-dashed text-center transition hover:border-brand/50 hover:bg-brand-soft/25"
              >
                <span>
                  <ImageIcon className="mx-auto size-6 text-brand" />
                  <span className="mt-2 block text-xs font-extrabold">Drop photos here</span>
                  <span className="mt-1 block text-[10px] text-foreground/40">JPG, PNG or WebP · 10 MB max</span>
                </span>
              </button>
              <input
                ref={uploadInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl border bg-white p-5">
              <Camera className="size-5 text-brand" />
              <h2 className="mt-3 font-extrabold">Photography checklist</h2>
              <div className="mt-4 space-y-2.5">
                {[
                  ["Front three-quarter", true],
                  ["Rear three-quarter", true],
                  ["Both side profiles", false],
                  ["Dashboard & mileage", false],
                  ["Front and rear seats", false],
                  ["Boot and engine bay", false],
                  ["Wheels and any defects", false],
                ].map(([label, done]) => (
                  <p key={String(label)} className="flex items-center gap-2 text-xs font-semibold">
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded-full",
                        done ? "bg-emerald-100 text-emerald-700" : "border text-transparent",
                      )}
                    >
                      <Check className="size-2.5" />
                    </span>
                    {String(label)}
                  </p>
                ))}
              </div>
            </section>
            <Notice title="Upload security">
              Images are type and size checked before storage. Private documents belong in the
              Documents area, not the public vehicle gallery.
            </Notice>
          </aside>
        </div>
      ) : null}

      {tab === "costs" && canViewCommercial ? (
        <form onSubmit={saveForm} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Commercial position</h2>
              <p className="mt-1 text-xs text-foreground/42">
                Restricted to owners, managers and authorised sales staff.
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Purchase price" name="purchasePrice" type="number" defaultValue={vehicle.purchasePrice ?? 0} />
              <FormField label="Preparation costs" name="preparationCosts" type="number" defaultValue={vehicle.preparationCosts ?? 0} />
              <FormField label="Repair costs" name="repairCosts" type="number" defaultValue={vehicle.repairCosts ?? 0} />
              <FormField label="Other costs" name="otherCosts" type="number" defaultValue={vehicle.otherCosts ?? 0} />
              <FormField label="Retail price" name="retailPrice" type="number" defaultValue={vehicle.price} />
              <FormField
                label="Minimum acceptable price"
                name="minimumAcceptablePrice"
                type="number"
                defaultValue={vehicle.minimumAcceptablePrice ?? ""}
              />
              <FormField label="Deposit amount" name="depositAmount" type="number" defaultValue={vehicle.depositAmount ?? 0} />
              <FormField label="Actual sale price" name="actualSalePrice" type="number" defaultValue={vehicle.actualSalePrice ?? ""} />
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl bg-[#10231f] p-5 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#d6a852]">
                Estimated gross profit
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">{formatCurrency(margin)}</p>
              <p className="mt-1 text-xs text-white/45">{marginPercent}% of advertised retail price</p>
              <div className="mt-5 border-t border-white/10 pt-4 text-xs">
                <div className="flex justify-between py-1.5">
                  <span className="text-white/45">Retail</span>
                  <strong>{formatCurrency(vehicle.price)}</strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-white/45">Total cost</span>
                  <strong>{formatCurrency(vehicle.cost)}</strong>
                </div>
              </div>
            </section>
            <Notice title="Private commercial data">
              These fields are excluded from public APIs and protected by role policies. Every
              price and status change is written to the audit history.
            </Notice>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              Save costs
            </Button>
          </aside>
        </form>
      ) : null}

      {tab === "history" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-2xl border bg-white">
            <div className="border-b p-5">
              <h2 className="font-extrabold">Vehicle timeline</h2>
              <p className="mt-1 text-xs text-foreground/42">Immutable operational history for this record.</p>
            </div>
            <div className="p-5">
              {initialHistory.map((event, index) => (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < initialHistory.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" /> : null}
                  <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border bg-white">
                    {index === initialHistory.length - 1 ? <FileCheck2 className="size-3.5 text-brand" /> : <Check className="size-3.5 text-brand" />}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-extrabold">{event.title}</p>
                      <time className="text-[10px] font-bold text-foreground/35">{event.time}</time>
                    </div>
                    <p className="mt-1 text-xs text-foreground/48">{event.detail}</p>
                    <p className="mt-1 text-[10px] font-semibold text-foreground/32">by {event.actor}</p>
                  </div>
                </div>
              ))}
              {!initialHistory.length ? (
                <p className="py-8 text-center text-sm text-foreground/45">
                  No audit events have been recorded for this vehicle yet.
                </p>
              ) : null}
            </div>
          </section>
          <aside className="space-y-5">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-brand" />
                <h2 className="font-extrabold">Audit protected</h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-foreground/48">
                Status, price, advert and ownership events are retained with actor and timestamp
                details.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href={`/admin/audit?entity=${vehicle.id}`}>Open full audit log</Link>
              </Button>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
