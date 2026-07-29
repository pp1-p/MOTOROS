"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  ReceiptText,
  Save,
} from "lucide-react";

import type { AdminVehicle } from "@/components/admin/admin-data";
import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  VehicleRelatedRecord,
  VehicleWorkspaceData,
} from "@/lib/data/admin-vehicles";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/utils";

export type VehicleExtendedTab =
  | "specification"
  | "features"
  | "condition"
  | "videos"
  | "highlight"
  | "channels"
  | "documents"
  | "assistant"
  | "leads"
  | "notes";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  suffix,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  suffix?: string;
}) {
  return (
    <label className="text-[11px] font-extrabold">
      {label}
      <span className="mt-1.5 flex">
        <Input
          name={name}
          type={type}
          defaultValue={defaultValue}
          className={suffix ? "rounded-r-none" : undefined}
        />
        {suffix ? (
          <span className="grid min-w-14 place-items-center rounded-r-xl border border-l-0 bg-surface-muted px-3 text-[10px] text-foreground/55">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not dated";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function RecordList({
  records,
  empty,
}: {
  records: VehicleRelatedRecord[];
  empty: string;
}) {
  if (!records.length) {
    return <p className="rounded-xl bg-surface-muted p-4 text-xs text-foreground/50">{empty}</p>;
  }
  return (
    <div className="divide-y rounded-xl border">
      {records.map((record) => (
        <div key={record.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold">{record.title}</p>
            {record.detail ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] text-foreground/50">
                {record.detail}
              </p>
            ) : null}
          </div>
          {record.status ? <StatusPill status={record.status.replaceAll("_", " ")} /> : null}
          {record.amount !== null && record.amount !== undefined ? (
            <strong className="text-xs">{formatCurrency(record.amount)}</strong>
          ) : null}
          <time className="text-[10px] font-semibold text-foreground/35">
            {formatDate(record.date)}
          </time>
          {record.href ? (
            <Button asChild variant="outline" size="sm">
              <Link href={record.href} target={record.href.startsWith("http") ? "_blank" : undefined}>
                View
                <ExternalLink />
              </Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function VehicleWorkspaceSections({
  tab,
  vehicle,
  data,
  canViewCommercial,
  canViewInvoices,
  canManageInvoices,
}: {
  tab: VehicleExtendedTab | "costs";
  vehicle: AdminVehicle;
  data: VehicleWorkspaceData;
  canViewCommercial: boolean;
  canViewInvoices: boolean;
  canManageInvoices: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(
    url: string,
    method: "PATCH" | "POST",
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setSaving(true);
    setMessage(null);
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    const nextMessage =
      result?.message ??
      (response?.ok ? successMessage : "The vehicle record could not be saved.");
    setMessage(nextMessage);
    setSaving(false);
    if (response?.ok) {
      notify.success(successMessage);
      router.refresh();
      return true;
    }
    notify.error(nextMessage);
    return false;
  }

  async function patchVehicle(
    event: FormEvent<HTMLFormElement>,
    transform?: (values: Record<string, FormDataEntryValue>) => Record<string, unknown>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const payload = transform ? transform(values) : values;
    const ok = await request(
      `/api/vehicles/${vehicle.id}`,
      "PATCH",
      { ...payload, changeReason: `Staff saved the ${tab} section` },
      "Vehicle section saved.",
    );
    if (ok) form.reset();
  }

  async function mutate(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const payload: Record<string, unknown> = { ...values, action };
    for (const key of ["isPinned", "isPublic"]) payload[key] = values[key] === "on";
    const ok = await request(
      `/api/vehicles/${vehicle.id}/workspace`,
      "POST",
      payload,
      "Vehicle record added.",
    );
    if (ok) form.reset();
  }

  const feedback = message ? (
    <p className="rounded-xl border bg-white px-4 py-3 text-xs font-semibold" role="status">
      {message}
    </p>
  ) : null;

  if (tab === "specification") {
    return (
      <form
        onSubmit={(event) =>
          patchVehicle(event, (values) => ({
            ...Object.fromEntries(
              Object.entries(values).map(([key, value]) => [
                key,
                value === "" ? null : value,
              ]),
            ),
            wheelchairAccessible: values.wheelchairAccessible === "on",
          }))
        }
        className="space-y-5"
      >
        {feedback}
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="font-extrabold">Cost, efficiency and compliance</h2>
            <p className="mt-1 text-xs text-foreground/45">
              Verified technical data used by your team and customer advert.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Urban consumption" name="fuelConsumptionUrbanMpg" type="number" suffix="MPG" defaultValue={vehicle.fuelConsumptionUrbanMpg ?? ""} />
            <Field label="Extra urban consumption" name="fuelConsumptionExtraUrbanMpg" type="number" suffix="MPG" defaultValue={vehicle.fuelConsumptionExtraUrbanMpg ?? ""} />
            <Field label="Combined consumption" name="fuelConsumptionCombinedMpg" type="number" suffix="MPG" defaultValue={vehicle.fuelConsumptionCombinedMpg ?? ""} />
            <Field label="CO₂" name="co2EmissionsGKm" type="number" suffix="g/km" defaultValue={vehicle.co2EmissionsGKm ?? ""} />
            <Field label="Euro emissions standard" name="euroEmissionsStandard" defaultValue={vehicle.euroEmissionsStandard ?? ""} />
            <Field label="Insurance group" name="insuranceGroup" defaultValue={vehicle.insuranceGroup ?? ""} />
            <Field label="Annual road tax" name="roadTaxAnnual" type="number" suffix="£" defaultValue={vehicle.roadTaxAnnual ?? ""} />
            <label className="text-[11px] font-extrabold">
              ULEZ status
              <select name="ulezStatus" defaultValue={vehicle.ulezStatus ?? "unknown"} className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                <option value="unknown">Unknown</option>
                <option value="compliant">Compliant</option>
                <option value="non_compliant">Non-compliant</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border p-3 text-xs font-semibold">
              <input name="wheelchairAccessible" type="checkbox" defaultChecked={Boolean(vehicle.wheelchairAccessible)} className="size-4 accent-brand" />
              Wheelchair accessible
            </label>
          </div>
        </section>
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5"><h2 className="font-extrabold">Engine and performance</h2></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="0–60 acceleration" name="acceleration060Seconds" type="number" suffix="sec" defaultValue={vehicle.acceleration060Seconds ?? ""} />
            <Field label="Top speed" name="topSpeedMph" type="number" suffix="mph" defaultValue={vehicle.topSpeedMph ?? ""} />
            <Field label="Power" name="powerBhp" type="number" suffix="bhp" defaultValue={vehicle.powerBhp ?? ""} />
            <Field label="Torque" name="torqueLbFt" type="number" suffix="lb-ft" defaultValue={vehicle.torqueLbFt ?? ""} />
            <Field label="Aspiration" name="aspiration" defaultValue={vehicle.aspiration ?? ""} />
            <Field label="Engine size" name="engineSizeCc" type="number" suffix="cc" defaultValue={vehicle.engineSizeCc ?? ""} />
            <Field label="Engine location" name="engineLocation" defaultValue={vehicle.engineLocation ?? ""} />
            <Field label="Engine number" name="engineNumber" defaultValue={vehicle.engineNumber ?? ""} />
            <Field label="Chassis number" name="chassisNumber" defaultValue={vehicle.chassisNumber ?? ""} />
            <Field label="Cylinders" name="cylinderCount" type="number" defaultValue={vehicle.cylinderCount ?? ""} />
            <Field label="Gears" name="gearCount" type="number" defaultValue={vehicle.gearCount ?? ""} />
            <Field label="Drive type" name="driveType" defaultValue={vehicle.driveType ?? ""} />
          </div>
        </section>
        <section className="rounded-2xl border bg-white">
          <div className="border-b p-5"><h2 className="font-extrabold">Weights and measures</h2></div>
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Gross weight" name="grossWeightKg" type="number" suffix="kg" defaultValue={vehicle.grossWeightKg ?? ""} />
            <Field label="Length" name="lengthMm" type="number" suffix="mm" defaultValue={vehicle.lengthMm ?? ""} />
            <Field label="Width" name="widthMm" type="number" suffix="mm" defaultValue={vehicle.widthMm ?? ""} />
          </div>
        </section>
        <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}Save specification</Button>
      </form>
    );
  }

  if (tab === "features") {
    return (
      <form
        onSubmit={(event) =>
          patchVehicle(event, (values) => ({
            features: String(values.features ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            standardEquipment: String(values.standardEquipment ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
            optionalEquipment: String(values.optionalEquipment ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
          }))
        }
        className="space-y-5"
      >
        {feedback}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-extrabold">Confirmed vehicle features</h2>
          <p className="mt-1 text-xs text-foreground/45">Use one verified feature per line. These may appear on customer adverts.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <label className="text-xs font-extrabold">Key highlights<Textarea name="features" defaultValue={(vehicle.features ?? []).join("\n")} className="mt-2 min-h-64" /></label>
            <label className="text-xs font-extrabold">Standard specification<Textarea name="standardEquipment" defaultValue={(vehicle.standardEquipment ?? []).join("\n")} className="mt-2 min-h-64" /></label>
            <label className="text-xs font-extrabold">Options and upgrades<Textarea name="optionalEquipment" defaultValue={(vehicle.optionalEquipment ?? []).join("\n")} className="mt-2 min-h-64" /></label>
          </div>
        </section>
        <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" /> : <Save />}Save confirmed features</Button>
      </form>
    );
  }

  if (tab === "condition") {
    return (
      <div className="space-y-5">
        {feedback}
        <form
          onSubmit={(event) =>
            patchVehicle(event, (values) => ({
              firstRegistrationDate: values.firstRegistrationDate || null,
              acquiredAt: values.acquiredAt || null,
              motExpiry: values.motExpiry || null,
              keeperStartDate: values.keeperStartDate || null,
              advertisedCondition: values.advertisedCondition,
              insuranceWriteOffCategory: values.insuranceWriteOffCategory || null,
              serviceHistory: values.serviceHistory || null,
              serviceHistorySummary: values.serviceHistorySummary || null,
              serviceHistoryVisible: values.serviceHistoryVisible === "on",
            }))
          }
          className="rounded-2xl border bg-white"
        >
          <div className="border-b p-5"><h2 className="font-extrabold">Condition and provenance</h2></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="First registration" name="firstRegistrationDate" type="date" defaultValue={vehicle.firstRegistrationDate ?? ""} />
            <Field label="Stock entry date" name="acquiredAt" type="date" defaultValue={vehicle.acquiredAt ?? ""} />
            <Field label="Current keeper start date" name="keeperStartDate" type="date" defaultValue={vehicle.keeperStartDate ?? ""} />
            <Field label="MOT expiry" name="motExpiry" type="date" defaultValue={vehicle.motExpiry ?? ""} />
            <label className="text-[11px] font-extrabold">Advertised condition<select name="advertisedCondition" defaultValue={vehicle.advertisedCondition ?? "used"} className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="new">New</option><option value="used">Used</option><option value="demonstrator">Demonstrator</option><option value="pre_registered">Pre-registered</option></select></label>
            <Field label="Insurance write-off category" name="insuranceWriteOffCategory" defaultValue={vehicle.insuranceWriteOffCategory ?? ""} />
            <Field label="Service history label" name="serviceHistory" defaultValue={vehicle.serviceHistory ?? ""} />
            <label className="flex items-center gap-2 self-end rounded-xl border p-3 text-xs font-semibold"><input name="serviceHistoryVisible" type="checkbox" defaultChecked={vehicle.serviceHistoryVisible ?? true} className="size-4 accent-brand" />Show service history publicly</label>
            <label className="text-[11px] font-extrabold sm:col-span-2 lg:col-span-3">Service history summary<Textarea name="serviceHistorySummary" defaultValue={vehicle.serviceHistorySummary ?? ""} className="mt-1.5" /></label>
          </div>
          <div className="border-t p-5"><Button type="submit" disabled={saving}><Save />Save condition</Button></div>
        </form>
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Service history records</h2>
            <div className="mt-4"><RecordList records={data.serviceRecords} empty="No service records have been added." /></div>
          </div>
          <form onSubmit={(event) => mutate(event, "add_service_record")} className="space-y-3 rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Add service record</h2>
            <Field label="Date" name="serviceDate" type="date" />
            <Field label="Mileage" name="mileage" type="number" />
            <Field label="Dealership or garage" name="dealershipName" />
            <label className="text-[11px] font-extrabold">Work completed<Textarea name="workCompleted" required className="mt-1.5" /></label>
            <Button type="submit" disabled={saving}><Plus />Add record</Button>
          </form>
        </section>
      </div>
    );
  }

  if (tab === "costs") {
    return (
      <div className="mt-5 space-y-5">
        {feedback}
        <section className="grid gap-5 xl:grid-cols-2">
          {canViewInvoices ? (
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex items-center gap-2"><ReceiptText className="size-4 text-brand" /><h2 className="font-extrabold">Related invoices</h2></div>
            <div className="mt-4"><RecordList records={data.invoices} empty="No invoices are linked to this vehicle." /></div>
            {canManageInvoices ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/invoices/new/repair?vehicle=${vehicle.id}`}>
                    Raise repair invoice
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/invoices/new/vehicle-sale?vehicle=${vehicle.id}`}>
                    Raise sale invoice
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/invoices/new?vehicle=${vehicle.id}`}>
                    Raise general invoice
                  </Link>
                </Button>
              </div>
            ) : null}
            {canManageInvoices && data.unlinkedInvoices.length ? (
              <form
                onSubmit={(event) => mutate(event, "link_invoice")}
                className="mt-4 flex flex-col gap-2 rounded-xl bg-surface-muted p-3 sm:flex-row"
              >
                <label className="min-w-0 flex-1 text-[10px] font-extrabold uppercase tracking-wider text-foreground/50">
                  Attach an existing unlinked invoice
                  <select
                    name="invoiceId"
                    required
                    defaultValue=""
                    className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-xs normal-case tracking-normal text-foreground"
                  >
                    <option value="">Choose invoice…</option>
                    {data.unlinkedInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.detail} · {formatCurrency(invoice.amount ?? 0)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" size="sm" disabled={saving} className="sm:self-end">
                  {saving ? <LoaderCircle className="animate-spin" /> : <Plus />}
                  Attach
                </Button>
              </form>
            ) : canManageInvoices ? (
              <p className="mt-3 text-[10px] text-foreground/45">
                There are no unlinked general invoices available to attach.
              </p>
            ) : null}
          </div>
          ) : null}
          {canViewCommercial ? (
            <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Individual vehicle costs</h2>
            <div className="mt-4"><RecordList records={data.costs} empty="No individual costs are assigned." /></div>
          </div>
          ) : null}
        </section>
        {canViewCommercial ? (
          <form onSubmit={(event) => mutate(event, "add_cost")} className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
            <label className="text-[11px] font-extrabold">Cost type<select name="costType" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="preparation">Preparation</option><option value="repair">Repair</option><option value="transport">Transport</option><option value="advertising">Advertising</option><option value="warranty">Warranty</option><option value="other">Other</option></select></label>
            <Field label="Description" name="description" />
            <Field label="Supplier" name="supplierName" />
            <Field label="Net amount" name="amountNet" type="number" />
            <Field label="VAT amount" name="vatAmount" type="number" defaultValue={0} />
            <div><Field label="Date" name="incurredOn" type="date" /><Button type="submit" disabled={saving} className="mt-3 w-full"><Plus />Add cost</Button></div>
          </form>
        ) : null}
      </div>
    );
  }

  if (tab === "videos") {
    return (
      <div className="space-y-5">
        {feedback}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Vehicle videos</h2><div className="mt-4"><RecordList records={data.videos} empty="No videos are attached to this vehicle." /></div></div>
          <form onSubmit={(event) => mutate(event, "add_video")} className="space-y-3 rounded-2xl border bg-white p-5">
            <h2 className="font-extrabold">Add video</h2>
            <Field label="Title" name="title" />
            <Field label="Secure video URL" name="videoUrl" type="url" />
            <label className="flex items-center gap-2 text-xs font-semibold"><input name="isPublic" type="checkbox" defaultChecked className="size-4 accent-brand" />Show on public advert</label>
            <Button type="submit" disabled={saving}><Plus />Add video</Button>
          </form>
        </section>
      </div>
    );
  }

  if (tab === "highlight") {
    return (
      <form
        onSubmit={(event) =>
          patchVehicle(event, (values) => ({
            attentionGrabber: values.attentionGrabber,
            featured: values.featured === "on",
          }))
        }
        className="space-y-5"
      >
        {feedback}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-extrabold">Vehicle highlight</h2>
          <p className="mt-1 text-xs text-foreground/45">A concise message used on listings and campaign cards.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
            <label className="text-xs font-extrabold">Highlight copy<Textarea name="attentionGrabber" defaultValue={vehicle.attentionGrabber ?? ""} maxLength={220} className="mt-2 min-h-36" /></label>
            <label className="flex items-start gap-3 rounded-xl border p-4 text-xs font-semibold"><input name="featured" type="checkbox" defaultChecked={vehicle.featured} className="mt-0.5 size-4 accent-brand" />Feature this vehicle prominently on the dealership website.</label>
          </div>
        </section>
        <Button type="submit" disabled={saving}><Save />Save highlight</Button>
      </form>
    );
  }

  if (tab === "assistant") {
    return (
      <form onSubmit={patchVehicle} className="space-y-5">
        {feedback}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-extrabold">Silent Salesman</h2>
          <p className="mt-1 text-xs text-foreground/45">A staff-approved walkaround script and key buying message. Nothing is generated or published automatically.</p>
          <div className="mt-5 space-y-4">
            <Field label="Sales headline" name="silentSalesmanHeadline" defaultValue={vehicle.silentSalesmanHeadline ?? ""} />
            <label className="text-xs font-extrabold">Sales summary<Textarea name="silentSalesmanSummary" defaultValue={vehicle.silentSalesmanSummary ?? ""} className="mt-2 min-h-48" /></label>
            <Field label="Call to action" name="silentSalesmanCallToAction" defaultValue={vehicle.silentSalesmanCallToAction ?? ""} />
          </div>
        </section>
        <Button type="submit" disabled={saving}><Save />Save sales assistant</Button>
      </form>
    );
  }

  if (tab === "channels") {
    return (
      <div className="space-y-5">
        {feedback}
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-extrabold">Sales channels</h2>
          <p className="mt-1 text-xs text-foreground/45">Track listing readiness and provider identifiers. Status changes do not claim to publish externally unless a provider integration confirms them.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {["website", "autotrader", "ebay", "carwow"].map((channel) => {
              const record = data.channels.find((item) => item.channel === channel);
              return <div key={channel} className="rounded-xl border p-4"><p className="text-xs font-extrabold capitalize">{channel}</p><div className="mt-2"><StatusPill status={record?.status?.replaceAll("_", " ") ?? (channel === "autotrader" ? vehicle.autotraderPublicationStatus ?? "not configured" : "not configured")} /></div>{record?.lastError ? <p className="mt-2 text-[10px] text-red-700">{record.lastError}</p> : null}</div>;
            })}
          </div>
        </section>
        <form onSubmit={(event) => mutate(event, "save_channel")} className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-[11px] font-extrabold">Channel<select name="channel" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="website">Website</option><option value="autotrader">AutoTrader</option><option value="ebay">eBay Motors</option><option value="carwow">Carwow</option><option value="other">Other</option></select></label>
          <label className="text-[11px] font-extrabold">Status<select name="status" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="not_configured">Not configured</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="pending">Pending</option><option value="published">Published</option><option value="paused">Paused</option><option value="failed">Failed</option><option value="removed">Removed</option><option value="over_contracted">Over contracted</option></select></label>
          <Field label="External stock ID" name="externalStockId" />
          <Field label="Derivative ID" name="externalDerivativeId" />
          <Field label="Listing title" name="listingTitle" />
          <Field label="Listing subtitle" name="listingSubtitle" />
          <Field label="Category" name="category" />
          <Field label="Listing URL" name="listingUrl" type="url" />
          <div className="md:col-span-2 xl:col-span-4"><Button type="submit" disabled={saving}><Save />Save channel record</Button></div>
        </form>
      </div>
    );
  }

  if (tab === "documents") {
    return (
      <div className="space-y-5">
        {feedback}
        <DocumentUploadForm entityType="vehicle" entityId={vehicle.id} />
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2"><FileText className="size-4 text-brand" /><h2 className="font-extrabold">Vehicle documents</h2></div>
          <div className="mt-4"><RecordList records={data.documents} empty="No documents are linked to this vehicle." /></div>
        </section>
      </div>
    );
  }

  if (tab === "leads") {
    return (
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Vehicle leads</h2><p className="mt-1 text-xs text-foreground/45">Every enquiry linked to this stock vehicle.</p></div><Button asChild size="sm"><Link href={`/admin/leads?vehicle=${vehicle.id}`}><Plus />Open lead workspace</Link></Button></div>
        <div className="mt-5"><RecordList records={data.leads} empty="No leads are linked to this vehicle." /></div>
      </section>
    );
  }

  if (tab === "notes") {
    return (
      <div className="space-y-5">
        {feedback}
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Internal vehicle notes</h2><div className="mt-4"><RecordList records={data.notes} empty="No internal notes have been added." /></div></div>
          <form onSubmit={(event) => mutate(event, "add_note")} className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-extrabold">Add note</h2><label className="text-xs font-extrabold">Note<Textarea name="note" required className="mt-2 min-h-36" /></label><label className="flex items-center gap-2 text-xs font-semibold"><input name="isPinned" type="checkbox" className="size-4 accent-brand" />Pin this note</label><Button type="submit" disabled={saving}><Plus />Add note</Button></form>
        </section>
      </div>
    );
  }

  return null;
}
