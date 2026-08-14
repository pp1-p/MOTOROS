import { MessageSquareText } from "lucide-react";

import { EmptyState, Notice, PageHeader, StatusPill } from "@/components/admin/page-kit";
import { ConversationLeadButton } from "@/components/admin/conversation-lead-button";
import { SocialNav } from "@/components/admin/social-nav";
import { hasPermission, requireStaff } from "@/lib/auth/permissions";
import { getSocialConversations } from "@/lib/data/social-hub";

function dateTime(value: string | null) {
  if (!value) return "No message received";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default async function SocialInboxPage() {
  const staff = await requireStaff("social:view");
  const conversations = await getSocialConversations(staff.organisationId, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Social hub"
        title="Unified inbox"
        description="Tenant-scoped customer conversations ingested by approved WhatsApp, Messenger or Telegram adapters."
      />
      <SocialNav />
      <Notice title="Replies require a configured messaging adapter" tone="info">
        MOTOR.OS stores conversation attribution and delivery state, but this release does
        not pretend to send messages when a provider webhook and server-side credentials
        have not been configured.
      </Notice>

      {conversations.length ? (
        <div className="rounded-2xl border bg-white divide-y">
          {conversations.map((conversation) => (
            <article key={conversation.id} className="flex items-center gap-4 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft">
                <MessageSquareText className="size-5 text-brand" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-extrabold">{conversation.subject}</h2>
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-extrabold text-white">
                      {conversation.unreadCount} unread
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] capitalize text-foreground/45">
                  {conversation.provider.replaceAll("_", " ")} · {dateTime(conversation.lastMessageAt)}
                </p>
                {conversation.customerName || conversation.vehicleTitle ? (
                  <p className="mt-1 text-[10px] text-foreground/55">
                    {[conversation.customerName, conversation.vehicleTitle]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <StatusPill status={conversation.status} />
              {hasPermission(staff.role, "leads:manage") ? (
                <ConversationLeadButton
                  conversationId={conversation.id}
                  initialLeadId={conversation.leadId}
                />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Threads appear only after a verified provider webhook records a genuine customer conversation."
          title="No conversations received"
        />
      )}
    </div>
  );
}
