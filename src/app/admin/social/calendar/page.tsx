import Link from "next/link";
import { CalendarDays, PenSquare } from "lucide-react";

import { EmptyState, PageHeader, StatusPill } from "@/components/admin/page-kit";
import { SocialNav } from "@/components/admin/social-nav";
import { SocialCalendarView } from "@/components/admin/social-calendar-view";
import { Button } from "@/components/ui/button";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import { getSocialPosts } from "@/lib/data/social-hub";

function dateTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function SocialCalendarPage() {
  const staff = await requireStaff("social:view");
  const posts = await getSocialPosts(staff.organisationId, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Social hub"
        title="Publishing calendar"
        description="Draft, scheduled and delivered content records. External delivery status is stored per provider target."
        actions={
          hasPermission(staff.role, "social:publish") ? (
            <Button asChild size="sm">
              <Link href="/admin/social/compose">
                <PenSquare />
                Compose post
              </Link>
            </Button>
          ) : null
        }
      />
      <SocialNav />

      {posts.length ? (
        <div className="space-y-5">
          <SocialCalendarView anchorDate={new Date().toISOString()} posts={posts} />
          <h2 className="text-sm font-extrabold">All publishing records</h2>
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft">
                  <CalendarDays className="size-5 text-brand" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-3xl text-sm font-bold leading-6">{post.caption}</p>
                    <StatusPill status={post.status} />
                  </div>
                  <p className="mt-2 text-[10px] font-bold text-foreground/42">
                    {dateTime(
                      post.scheduledFor ?? post.publishedAt,
                      `Draft created ${dateTime(post.createdAt, "")}`,
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.targetProviders.map((provider) => (
                      <span
                        key={provider}
                        className="rounded-full bg-surface-muted px-2 py-1 text-[9px] font-extrabold capitalize"
                      >
                        {provider.replaceAll("_", " ")}
                      </span>
                    ))}
                    {!post.targetProviders.length ? (
                      <span className="text-[10px] text-foreground/40">No channel targets</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          actionHref="/admin/social/compose"
          actionLabel="Compose first post"
          description="Drafts and real provider schedules will appear here. No external posts are fabricated."
          title="The publishing calendar is empty"
        />
      )}
    </div>
  );
}
