import Link from "next/link";
import { CalendarClock, Cable, Inbox, PenSquare } from "lucide-react";

import {
  MetricCard,
  Notice,
  PageHeader,
  SectionHeading,
  StatusPill,
} from "@/components/admin/page-kit";
import { SocialNav } from "@/components/admin/social-nav";
import { Button } from "@/components/ui/button";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import {
  getSocialConnections,
  getSocialConversations,
  getSocialPosts,
} from "@/lib/data/social-hub";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";

function shortDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function SocialHubPage() {
  const staff = await requireStaff("social:view");
  const [connections, posts, conversations, entitlements] = await Promise.all([
    getSocialConnections(staff.organisationId),
    getSocialPosts(staff.organisationId, 6),
    getSocialConversations(staff.organisationId, 6),
    getTenantEntitlements(staff.organisationId),
  ]);
  const connected = connections.filter((connection) => connection.status === "connected");
  const upcoming = posts.filter(
    (post) => post.status === "scheduled" && post.scheduledFor,
  );
  const unread = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );
  const canCompose =
    hasPermission(staff.role, "social:publish") &&
    entitlements.features["social.publishing"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer acquisition"
        title="Social & communications"
        description="Manage channel readiness, publishing work and customer conversations in one tenant-scoped workspace."
        actions={
          canCompose ? (
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

      {!connected.length ? (
        <Notice title="No social account is connected">
          Connection cards show real provider and deployment readiness. MOTOR.OS will not
          simulate an OAuth connection or publish with placeholder credentials.
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          detail={`${connections.length - connected.length} require setup or attention`}
          href="/admin/social/connections"
          icon={Cable}
          label="Connected channels"
          value={String(connected.length)}
        />
        <MetricCard
          detail="Drafts and scheduled posts"
          href="/admin/social/calendar"
          icon={CalendarClock}
          label="Upcoming posts"
          value={String(upcoming.length)}
        />
        <MetricCard
          detail="Across open conversations"
          href="/admin/social/inbox"
          icon={Inbox}
          label="Unread messages"
          tone={unread > 0 ? "warning" : "default"}
          value={String(unread)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <SectionHeading
            action={
              <Link className="text-xs font-extrabold text-brand" href="/admin/social/calendar">
                View calendar
              </Link>
            }
            description="Most recent publishing work across all selected channels."
            title="Content pipeline"
          />
          <div className="mt-4 divide-y">
            {posts.map((post) => (
              <div key={post.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-xs font-bold leading-5">{post.caption}</p>
                  <StatusPill status={post.status} />
                </div>
                <p className="mt-1 text-[10px] text-foreground/42">
                  {shortDate(post.scheduledFor ?? post.publishedAt)}
                  {post.targetProviders.length
                    ? ` · ${post.targetProviders.join(", ").replaceAll("_", " ")}`
                    : " · No targets"}
                </p>
              </div>
            ))}
            {!posts.length ? (
              <p className="py-6 text-center text-xs text-foreground/45">
                No social publishing work has been saved.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <SectionHeading
            action={
              <Link className="text-xs font-extrabold text-brand" href="/admin/social/inbox">
                Open inbox
              </Link>
            }
            description="Inbound threads recorded by configured messaging adapters."
            title="Conversation inbox"
          />
          <div className="mt-4 divide-y">
            {conversations.map((conversation) => (
              <div key={conversation.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-[10px] font-extrabold uppercase text-brand">
                  {conversation.provider.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold">{conversation.subject}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-foreground/42">
                    {conversation.provider.replaceAll("_", " ")} · {conversation.status}
                  </p>
                </div>
                {conversation.unreadCount > 0 ? (
                  <span className="grid size-6 place-items-center rounded-full bg-brand text-[10px] font-extrabold text-white">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>
            ))}
            {!conversations.length ? (
              <p className="py-6 text-center text-xs text-foreground/45">
                No provider conversation has been received.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
