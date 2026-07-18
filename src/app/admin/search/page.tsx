import Link from "next/link";
import { CarFront, HeartHandshake, Search, UserRound, Wrench } from "lucide-react";

import { Notice, PageHeader } from "@/components/admin/page-kit";
import { Input } from "@/components/ui/input";
import {
  searchAdminRecords,
  type AdminSearchResult,
} from "@/lib/data/admin-search";

const resultIcons = {
  vehicle: CarFront,
  customer: UserRound,
  lead: HeartHandshake,
  repair: Wrench,
  sourcing: Search,
} satisfies Record<AdminSearchResult["type"], typeof Search>;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const response = await searchAdminRecords(q);
  const hasQuery = response.query.length >= 2;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Permission-aware"
        title="Global search"
        description="Search registrations, stock numbers, customers, telephone numbers, emails, leads, repairs and sourcing requests."
      />
      {response.message ? (
        <Notice
          title={response.state === "demo" ? "Development demo" : "Search unavailable"}
          tone="info"
        >
          {response.message}
        </Notice>
      ) : null}
      <form action="/admin/search" className="relative">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
        <Input
          name="q"
          defaultValue={response.query}
          autoFocus
          minLength={2}
          maxLength={100}
          placeholder="Search DealerOS…"
          className="h-14 bg-white pl-12 text-base"
        />
      </form>
      <div className="rounded-2xl border bg-white">
        <div className="border-b p-4 text-xs font-bold text-foreground/45">
          {hasQuery
            ? `${response.results.length} results for “${response.query}”`
            : "Enter at least two characters to search live dealership records"}
        </div>
        <div className="divide-y">
          {response.results.map((result) => {
            const Icon = resultIcons[result.type];
            return (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.href}
                className="flex items-center gap-3 p-4 hover:bg-[#fafaf8]"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-soft">
                  <Icon className="size-4 text-brand" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-extrabold">
                    {result.title}
                  </span>
                  <span className="mt-1 block truncate text-[10px] capitalize text-foreground/42">
                    {result.type} · {result.detail}
                  </span>
                </span>
              </Link>
            );
          })}
          {hasQuery && !response.results.length ? (
            <div className="p-16 text-center">
              <Search className="mx-auto size-6 text-foreground/25" />
              <p className="mt-3 text-sm font-extrabold">No accessible records found</p>
              <p className="mt-1 text-xs text-foreground/42">
                Check the spelling or try a shorter reference.
              </p>
            </div>
          ) : null}
          {!hasQuery ? (
            <div className="p-12 text-center text-xs leading-5 text-foreground/42">
              Results are loaded only after you search and are restricted to the records your
              role can access.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
