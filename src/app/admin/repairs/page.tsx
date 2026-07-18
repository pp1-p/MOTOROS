import { format, isToday, isTomorrow, parseISO } from "date-fns";
import Link from "next/link";
import { CalendarPlus, Download, Search, Wrench } from "lucide-react";

import {
  displayRepairStatus,
  getRepairWorkspace,
} from "@/lib/data/admin-repairs";
import {
  EmptyState,
  Notice,
  PageHeader,
  StatusPill,
} from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

function dueLabel(value: string | null) {
  if (!value) return "Not set";
  const date = parseISO(value);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "d MMM yyyy");
}

export default async function RepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim().slice(0, 100) ?? "";
  const workspace = await getRepairWorkspace(search);
  const jobs =
    params.status === "active"
      ? workspace.jobs.filter(
          (job) => !["collected", "cancelled"].includes(job.status),
        )
      : workspace.jobs;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workshop operations"
        title="Repairs"
        description="Move enquiries through diagnosis, approval, parts, work and collection without exposing internal notes."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/diary?create=1">
              <CalendarPlus />
              Book repair call
            </Link>
          </Button>
        }
      />

      {workspace.isDemo ? (
        <Notice title="Demo repair data" tone="info">
          Supabase is not configured, so this workspace is a read-only preview. Connect Supabase
          to load and update your dealership&apos;s repair jobs.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [String(workspace.metrics.inProgress), "Jobs in progress"],
          [String(workspace.metrics.awaitingApproval), "Awaiting approval"],
          [String(workspace.metrics.readyForCollection), "Ready for collection"],
          [formatCurrency(workspace.metrics.openEstimateTotal), "Open estimates"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-lg font-extrabold">{value}</p>
            <p className="mt-0.5 text-[10px] text-foreground/45">{label}</p>
          </div>
        ))}
      </div>

      <form
        action="/admin/repairs"
        method="get"
        className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={search}
            aria-label="Search repair jobs"
            placeholder="Search job, registration or customer…"
            className="h-10 border-0 bg-surface-muted pl-9 shadow-none"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          <Search />
          Search
        </Button>
        {search ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/repairs">Clear</Link>
          </Button>
        ) : null}
        {!workspace.isDemo ? (
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/repairs/export" download>
              <Download />
              Export
            </a>
          </Button>
        ) : null}
      </form>

      {jobs.length === 0 ? (
        <EmptyState
          title={search ? "No matching repair jobs" : "No repair jobs yet"}
          description={
            search
              ? "Try a reference, registration, customer, vehicle or technician."
              : "Book a repair discussion call, then convert the completed appointment into a repair job."
          }
          actionHref={search ? "/admin/repairs" : "/admin/diary?create=1"}
          actionLabel={search ? "Clear search" : "Book repair call"}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-[0.1em] text-foreground/38">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Reported work</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition hover:bg-[#fafaf8]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/repairs/${job.id}`} className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-lg bg-brand-soft">
                          <Wrench className="size-3.5 text-brand" />
                        </span>
                        <span>
                          <span className="block text-xs font-extrabold">{job.reference}</span>
                          <span className="block text-[10px] text-foreground/40">
                            {job.customerName}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold">{job.vehicle}</p>
                      <p className="mt-0.5 font-mono text-[10px] font-black">
                        {job.registration}
                      </p>
                    </td>
                    <td className="max-w-64 px-4 py-3 text-xs text-foreground/55">
                      {job.reportedFault}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={displayRepairStatus(job.status)} />
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground/55">
                      {job.technicianName}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">{dueLabel(job.dueDate)}</td>
                    <td className="px-4 py-3 text-xs font-extrabold">
                      {job.estimateTotal > 0 ? formatCurrency(job.estimateTotal) : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
