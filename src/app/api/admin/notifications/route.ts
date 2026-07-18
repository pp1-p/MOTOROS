import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext } from "@/lib/auth/permissions";
import { isDevelopmentDemoMode } from "@/lib/demo/store";
import { isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
  all: z.boolean().optional(),
}).refine((value) => value.all || (value.ids?.length ?? 0) > 0, {
  message: "Choose at least one notification.",
});

export async function GET() {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (isDevelopmentDemoMode()) {
    return NextResponse.json({ notifications: [], demo: true });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { message: "Notifications are unavailable until Supabase is configured." },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const result = await supabase
    .from("notifications")
    .select(
      "id,recipient_user_id,notification_type,title,body,action_url,entity_type,entity_id,read_at,created_at",
    )
    .eq("organisation_id", staff.organisationId)
    .or(`recipient_user_id.eq.${staff.userId},recipient_user_id.is.null`)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (result.error) {
    return NextResponse.json(
      { message: "Notifications could not be loaded." },
      { status: 500 },
    );
  }
  const ids = (result.data ?? []).map((notification) => notification.id);
  const receipts =
    ids.length > 0
      ? await supabase
          .from("notification_receipts")
          .select("notification_id,read_at")
          .eq("organisation_id", staff.organisationId)
          .eq("user_id", staff.userId)
          .in("notification_id", ids)
      : { data: [], error: null };
  if (receipts.error) {
    return NextResponse.json(
      { message: "Notification read state could not be loaded." },
      { status: 500 },
    );
  }
  const readAtByNotification = new Map(
    (receipts.data ?? []).map((receipt) => [
      receipt.notification_id,
      receipt.read_at,
    ]),
  );
  return NextResponse.json({
    notifications: (result.data ?? []).map((notification) => ({
      id: notification.id,
      type: notification.notification_type,
      title: notification.title,
      detail: notification.body ?? "",
      href:
        notification.action_url?.startsWith("/admin")
          ? notification.action_url
          : "/admin",
      readAt:
        readAtByNotification.get(notification.id) ??
        (notification.recipient_user_id ? notification.read_at : null),
      createdAt: notification.created_at,
    })),
  });
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }
  const staff = await getStaffContext();
  if (!staff) return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid notification selection." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  let visibleQuery = supabase
    .from("notifications")
    .select("id")
    .eq("organisation_id", staff.organisationId)
    .or(`recipient_user_id.eq.${staff.userId},recipient_user_id.is.null`)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(parsed.data.all ? 500 : 100);
  if (!parsed.data.all) {
    visibleQuery = visibleQuery.in("id", parsed.data.ids!);
  }
  const visible = await visibleQuery;
  if (visible.error) {
    return NextResponse.json(
      { message: "Notifications could not be checked." },
      { status: 500 },
    );
  }
  const ids = (visible.data ?? []).map((notification) => notification.id);
  if (ids.length > 0) {
    const readAt = new Date().toISOString();
    const result = await supabase.from("notification_receipts").upsert(
      ids.map((notificationId) => ({
        organisation_id: staff.organisationId,
        notification_id: notificationId,
        user_id: staff.userId,
        read_at: readAt,
      })),
      { onConflict: "notification_id,user_id" },
    );
    if (result.error) {
      return NextResponse.json(
        { message: "Notifications could not be updated." },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ ok: true, message: "Notifications marked as read." });
}
