import Link from "next/link";
import { AlertTriangle, Download, Merge, Plus, Search } from "lucide-react";

import { Avatar, PageHeader, StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminCustomerList } from "@/lib/data/admin-operational";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query = "" } = await searchParams;
  const { customers, metrics } = await getAdminCustomerList();
  const normalisedQuery = query.trim().toLowerCase();
  const visibleCustomers = normalisedQuery
    ? customers.filter((customer) =>
        `${customer.name} ${customer.email ?? ""} ${customer.phone ?? ""} ${customer.id}`
          .toLowerCase()
          .includes(normalisedQuery),
      )
    : customers;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Single customer view"
        title="Customers"
        description="Contact details, consent, vehicles, enquiries, purchases, sourcing and repair history in one place."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/customers/new">
              <Plus />
              Add customer
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [metrics.total.toLocaleString("en-GB"), "Customer records"],
          [metrics.active.toLocaleString("en-GB"), "Active relationships"],
          [
            metrics.possibleDuplicates.toLocaleString("en-GB"),
            "Possible duplicates",
          ],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-lg font-extrabold">{value}</p>
            <p className="text-[10px] text-foreground/45">{label}</p>
          </div>
        ))}
      </div>
      <form
        action="/admin/customers"
        className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
          <Input
            name="query"
            defaultValue={query}
            placeholder="Search name, email, phone or registration…"
            className="h-10 border-0 bg-surface-muted pl-9 shadow-none"
          />
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/customers/export" download>
            <Download />
            Export permitted data
          </a>
        </Button>
      </form>
      {metrics.possibleDuplicates ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold">
              {metrics.possibleDuplicates} possible duplicate{" "}
              {metrics.possibleDuplicates === 1 ? "match needs" : "matches need"}{" "}
              review
            </span>
            <span className="mt-0.5 block text-[10px] opacity-65">
              Matches use normalised email or telephone. Merges require confirmation and are audited.
            </span>
          </span>
          <Merge className="size-4" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b bg-[#fafaf8] text-[10px] font-extrabold uppercase tracking-wider text-foreground/38">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Relationship</th>
                <th className="px-4 py-3">Open items</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-[#fafaf8]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        initials={customer.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      />
                      <span>
                        <span className="block text-xs font-extrabold">{customer.name}</span>
                        <span className="text-[10px] text-foreground/40">{customer.id}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="block text-xs font-semibold hover:underline"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      <span className="block text-xs text-foreground/35">
                        No email
                      </span>
                    )}
                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone.replace(/\s/g, "")}`}
                        className="mt-0.5 block text-[10px] text-foreground/45 hover:underline"
                      >
                        {customer.phone}
                      </a>
                    ) : (
                      <span className="mt-0.5 block text-[10px] text-foreground/35">
                        No telephone
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={customer.relationship} />
                  </td>
                  <td className="px-4 py-3 text-xs font-extrabold">{customer.open}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${
                        customer.consent === "Do not contact"
                          ? "bg-red-100 text-red-800"
                          : customer.consent === "Marketing consent"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-surface-muted text-foreground/55"
                      }`}
                    >
                      {customer.consent}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground/50">
                    {customer.lastContact}
                  </td>
                </tr>
              ))}
              {!visibleCustomers.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-xs text-foreground/45"
                  >
                    No customers match this search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
