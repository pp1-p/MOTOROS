import Link from "next/link";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderLock,
} from "lucide-react";

import { DocumentUploadForm } from "@/components/admin/document-upload-form";
import { Notice, PageHeader } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { requireStaff, type StaffContext } from "@/lib/auth/permissions";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DocumentRow = {
  id: string;
  title: string;
  fileName: string;
  type: string;
  mimeType: string;
  size: number;
  linkedType: string | null;
  linkedId: string | null;
  createdAt: string;
};

type RepairJobOption = {
  id: string;
  label: string;
};

async function loadDocumentWorkspace(
  staff: StaffContext,
): Promise<{ documents: DocumentRow[]; repairJobs: RepairJobOption[] }> {
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return { documents: [], repairJobs: [] };
  }
  const supabase = createAdminSupabaseClient();
  let repairJobs: RepairJobOption[] = [];
  let query = supabase
    .from("documents")
    .select(
      "id,title,file_name,document_type,mime_type,byte_size,size_bytes,entity_type,entity_id,repair_job_id,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .is("deleted_at", null);

  if (staff.role === "technician") {
    const jobs = await supabase
      .from("repair_jobs")
      .select("id,reference,registration,vehicle_make_model")
      .eq("organisation_id", staff.organisationId)
      .eq("assigned_technician_id", staff.userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (jobs.error) {
      throw new Error(`Assigned repair jobs could not be loaded: ${jobs.error.message}`);
    }
    repairJobs = (jobs.data ?? []).map((job) => ({
      id: job.id,
      label: [job.reference, job.registration, job.vehicle_make_model]
        .filter(Boolean)
        .join(" · "),
    }));
    if (!repairJobs.length) return { documents: [], repairJobs };
    query = query.in(
      "repair_job_id",
      repairJobs.map((job) => job.id),
    );
  }

  const result = await query.order("created_at", { ascending: false }).limit(100);
  if (result.error) {
    throw new Error(`Documents could not be loaded: ${result.error.message}`);
  }
  return {
    documents: (result.data ?? []).map((document) => ({
      id: document.id,
      title: document.title ?? document.file_name,
      fileName: document.file_name,
      type: document.document_type,
      mimeType: document.mime_type,
      size: Number(document.byte_size ?? document.size_bytes ?? 0),
      linkedType: document.entity_type,
      linkedId: document.entity_id,
      createdAt: document.created_at,
    })),
    repairJobs,
  };
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const staff = await requireStaff("documents:view");
  const { documents, repairJobs } = await loadDocumentWorkspace(staff);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Secure files"
        title="Documents"
        description="Private operational files use permission-checked, time-limited downloads. Public vehicle images are managed from Stock."
      />
      <Notice title="Private storage" tone="info">
        Customer IDs, invoices and repair files are never stored in public buckets. Access is
        checked before DealerOS issues a short-lived signed URL.
      </Notice>
      <DocumentUploadForm
        technicianRepairJobs={staff.role === "technician" ? repairJobs : undefined}
      />

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="divide-y">
          {documents.map((document) => {
            const Icon = document.mimeType === "text/csv"
              ? FileSpreadsheet
              : document.mimeType.startsWith("image/")
                ? FileImage
                : document.mimeType === "application/pdf"
                  ? FileText
                  : FolderLock;
            return (
              <div
                key={document.id}
                className="grid gap-3 p-4 hover:bg-[#fafaf8] sm:grid-cols-[minmax(0,1fr)_180px_150px_auto] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-soft">
                    <Icon className="size-4 text-brand" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold">{document.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-foreground/40">
                      {document.fileName} · {formatBytes(document.size)}
                    </p>
                  </div>
                </div>
                {document.linkedId ? (
                  <Link
                    href={`/admin/search?q=${encodeURIComponent(document.linkedId)}`}
                    className="truncate text-xs font-bold text-brand hover:underline"
                  >
                    {document.linkedType?.replaceAll("_", " ") ?? "Linked record"}
                  </Link>
                ) : (
                  <span className="text-xs text-foreground/40">General file</span>
                )}
                <time className="text-xs text-foreground/45">
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/London",
                  }).format(new Date(document.createdAt))}
                </time>
                <Button asChild variant="ghost" size="icon">
                  <a
                    href={`/api/admin/documents/${document.id}/download`}
                    aria-label={`Download ${document.title}`}
                  >
                    <Download />
                  </a>
                </Button>
              </div>
            );
          })}
          {!documents.length ? (
            <div className="px-6 py-14 text-center">
              <FolderLock className="mx-auto size-7 text-brand" />
              <p className="mt-3 text-sm font-extrabold">No secure documents yet</p>
              <p className="mt-1 text-xs text-foreground/45">
                Upload the first file using the validated form above.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
