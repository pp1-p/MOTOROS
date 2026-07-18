"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DocumentUploadForm({
  technicianRepairJobs,
}: {
  technicianRepairJobs?: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setMessage(null);
    const response = await fetch("/api/uploads/documents", {
      method: "POST",
      body: new FormData(form),
    }).catch(() => null);
    const result = response
      ? ((await response.json().catch(() => null)) as { message?: string } | null)
      : null;
    setMessage(
      result?.message ??
        (response?.ok ? "Document uploaded securely." : "The document could not be uploaded."),
    );
    setUploading(false);
    if (response?.ok) {
      form.reset();
      router.refresh();
    }
  }

  if (technicianRepairJobs && technicianRepairJobs.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-xs text-foreground/60">
        Documents can be uploaded once a repair job is assigned to you.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-2 lg:items-end xl:grid-cols-[1fr_1fr_170px_1fr_auto]"
    >
      {technicianRepairJobs ? <input type="hidden" name="entityType" value="repair_job" /> : null}
      <label className="text-xs font-extrabold">
        Document title
        <Input name="title" required maxLength={200} className="mt-2" />
      </label>
      {technicianRepairJobs ? (
        <label className="text-xs font-extrabold">
          Assigned repair job
          <select
            name="entityId"
            required
            className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
          >
            <option value="">Choose a repair job</option>
            {technicianRepairJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-xs font-extrabold">
        Secure file
        <Input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className="mt-2 file:mr-3"
        />
      </label>
      <label className="text-xs font-extrabold">
        Type
        <select
          name="documentType"
          className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-sm"
        >
          <option value="other">Other</option>
          <option value="purchase_invoice">Purchase invoice</option>
          <option value="inspection_report">Inspection report</option>
          <option value="customer_document">Customer document</option>
          <option value="sales_document">Sales document</option>
        </select>
      </label>
      <Button type="submit" disabled={uploading}>
        {uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}
        Upload
      </Button>
      {message ? (
        <p className="text-xs font-semibold text-foreground/60 lg:col-span-2 xl:col-span-5" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
