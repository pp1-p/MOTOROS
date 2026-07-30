import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CarFront,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Users,
} from "lucide-react";

import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  getPlatformDealership,
  logPlatformAdminAccess,
} from "@/lib/data/platform-admin";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default async function PlatformDealershipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const dealership = await getPlatformDealership(id);
  if (!dealership) notFound();

  // Fire-and-forget audit trail: this is the sensitive action worth logging.
  logPlatformAdminAccess({
    organisationId: dealership.id,
    actorUserId: admin.userId,
    actorEmail: admin.email,
    action: "platform_admin.dealership.viewed",
  }).catch(() => {});

  const kpi = [
    {
      icon: CarFront,
      label: "In stock",
      value: String(dealership.vehiclesInStock),
      hint: `${dealership.vehicleCount} total records`,
    },
    {
      icon: CarFront,
      label: "Sold · 30d",
      value: String(dealership.soldLast30Days),
      hint: "Recent activity",
    },
    {
      icon: Receipt,
      label: "Invoiced · 30d",
      value: String(dealership.invoicedLast30Days),
      hint: `${dealership.invoiceCount} total`,
    },
    {
      icon: Receipt,
      label: "Outstanding",
      value: money.format(dealership.outstandingBalance),
      hint: "Across live invoices",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/platform"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All dealerships
        </Link>
        <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#67e8f9]">
              Dealership
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {dealership.name}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {dealership.slug} · joined{" "}
              {new Date(dealership.createdAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              <span
                className={
                  dealership.status === "active"
                    ? "text-emerald-300"
                    : dealership.status === "suspended"
                      ? "text-amber-300"
                      : "text-red-300"
                }
              >
                {dealership.status}
              </span>
            </p>
          </div>
        </header>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
              <tile.icon className="size-3.5 text-[#67e8f9]" aria-hidden />
              {tile.label}
            </div>
            <p className="mt-2 text-2xl font-extrabold tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{tile.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-extrabold">
                <Users className="mr-2 inline size-4 text-[#67e8f9]" aria-hidden />
                Team ({dealership.members.length})
              </h2>
            </div>
            {dealership.members.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No team members yet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Person</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dealership.members.map((member) => (
                    <tr key={member.userId}>
                      <td className="px-5 py-3">
                        <p className="font-extrabold">
                          {member.displayName ?? "Unnamed"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {member.email ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{member.role}</td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            member.isActive
                              ? "text-emerald-300"
                              : "text-slate-500"
                          }
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-extrabold">
                <ClipboardList
                  className="mr-2 inline size-4 text-[#67e8f9]"
                  aria-hidden
                />
                Recent activity
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Most recent 15 audit log entries for this dealership.
              </p>
            </div>
            {dealership.recentActivity.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No audit trail yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {dealership.recentActivity.map((entry, index) => (
                  <li key={index} className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-extrabold text-slate-200">
                        {entry.action}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(entry.occurredAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.detail ? (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {entry.detail}
                      </p>
                    ) : null}
                    {entry.actorEmail ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        by {entry.actorEmail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Contact details
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {dealership.telephone ? (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-[#67e8f9]" aria-hidden />
                  <span>{dealership.telephone}</span>
                </li>
              ) : null}
              {dealership.email ? (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-[#67e8f9]" aria-hidden />
                  <span className="break-all">{dealership.email}</span>
                </li>
              ) : null}
              {dealership.address ? (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[#67e8f9]" aria-hidden />
                  <span>{dealership.address}</span>
                </li>
              ) : null}
              {!dealership.telephone &&
              !dealership.email &&
              !dealership.address ? (
                <li className="text-xs text-slate-500">
                  This dealership hasn&apos;t configured public contact details.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Read-only view
            </h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">
              Platform admins can see these details but cannot edit them from
              here. If you need to change something, log in as an authorised
              member of this dealership from their own admin.
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              Every visit to this page is recorded in the dealership&apos;s
              audit log.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
