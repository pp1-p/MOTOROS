import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getTenantEntitlements } from "@/lib/data/tenant-entitlements";
import { providerCanPublish } from "@/lib/data/social-hub";
import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const postSchema = z.object({
  caption: z.string().trim().min(1).max(5000),
  callToAction: z.string().trim().min(1).max(120).nullable(),
  vehicleId: z.uuid().nullable(),
  connectionIds: z.array(z.uuid()).max(7),
  status: z.enum(["draft", "scheduled"]),
  scheduledFor: z.iso.datetime().nullable(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }
  if (!hasPermission(staff.role, "social:publish")) {
    return NextResponse.json(
      { message: "An owner or manager must save social publishing work." },
      { status: 403 },
    );
  }
  if (!isSupabaseConfigured() || !getServerEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { message: "Supabase service access is required to persist social publishing work." },
      { status: 503 },
    );
  }

  const entitlements = await getTenantEntitlements(staff.organisationId);
  if (!entitlements.features["social.publishing"]) {
    return NextResponse.json(
      { message: "Social publishing is not enabled for this dealership plan." },
      { status: 403 },
    );
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Review the caption, channels and schedule time." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.status === "scheduled") {
    const minimum = Date.now() + 5 * 60_000;
    const maximum = Date.now() + 366 * 24 * 60 * 60_000;
    const scheduledAt = input.scheduledFor
      ? new Date(input.scheduledFor).getTime()
      : Number.NaN;
    if (
      input.connectionIds.length === 0 ||
      !Number.isFinite(scheduledAt) ||
      scheduledAt < minimum ||
      scheduledAt > maximum
    ) {
      return NextResponse.json(
        { message: "Choose a connected channel and a time between five minutes and one year from now." },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminSupabaseClient();
  if (input.vehicleId) {
    const vehicle = await supabase
      .from("vehicles")
      .select("id")
      .eq("id", input.vehicleId)
      .eq("organisation_id", staff.organisationId)
      .eq("is_public", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (!vehicle.data) {
      return NextResponse.json(
        { message: "Choose a public vehicle from this dealership." },
        { status: 400 },
      );
    }
  }

  let connections: { id: string; provider: string }[] = [];
  if (input.connectionIds.length > 0) {
    const connectionResult = await supabase
      .from("integration_settings")
      .select("id,provider,status")
      .eq("organisation_id", staff.organisationId)
      .eq("status", "connected")
      .in("id", input.connectionIds);
    connections = (connectionResult.data ?? [])
      .filter((row) => providerCanPublish(String(row.provider)))
      .map((row) => ({ id: String(row.id), provider: String(row.provider) }));
    if (
      connectionResult.error ||
      connections.length !== new Set(input.connectionIds).size
    ) {
      return NextResponse.json(
        { message: "One or more selected publishing channels is no longer available." },
        { status: 409 },
      );
    }
  }

  const postResult = await supabase
    .from("social_posts")
    .insert({
      organisation_id: staff.organisationId,
      vehicle_id: input.vehicleId,
      caption: input.caption,
      call_to_action: input.callToAction,
      status: input.status,
      scheduled_for: input.status === "scheduled" ? input.scheduledFor : null,
      created_by: staff.userId,
    })
    .select("id,status,scheduled_for")
    .single();
  if (postResult.error || !postResult.data) {
    return NextResponse.json(
      { message: "The social post could not be saved." },
      { status: 500 },
    );
  }

  if (connections.length > 0) {
    const targetsResult = await supabase.from("social_post_targets").insert(
      connections.map((connection) => ({
        organisation_id: staff.organisationId,
        social_post_id: postResult.data.id,
        integration_setting_id: connection.id,
        provider: connection.provider,
        status: input.status === "scheduled" ? "scheduled" : "pending",
      })),
    );
    if (targetsResult.error) {
      await supabase
        .from("social_posts")
        .delete()
        .eq("id", postResult.data.id)
        .eq("organisation_id", staff.organisationId);
      return NextResponse.json(
        { message: "The publishing targets changed before the post could be saved." },
        { status: 409 },
      );
    }
  }

  await supabase.from("audit_logs").insert({
    organisation_id: staff.organisationId,
    actor_user_id: staff.userId,
    table_name: "social_posts",
    record_id: postResult.data.id,
    action:
      input.status === "scheduled"
        ? "social_post.scheduled"
        : "social_post.draft_created",
    entity_type: "social_post",
    entity_id: postResult.data.id,
    changed_fields: [
      "caption",
      "call_to_action",
      "vehicle_id",
      "status",
      "scheduled_for",
    ],
    new_values: {
      status: input.status,
      call_to_action: input.callToAction,
      vehicle_id: input.vehicleId,
      scheduled_for: input.scheduledFor,
      providers: connections.map((connection) => connection.provider),
    },
    source: "admin_api",
  });

  revalidatePath("/admin/social");
  revalidatePath("/admin/social/calendar");
  return NextResponse.json({
    ok: true,
    post: postResult.data,
    message:
      input.status === "scheduled"
        ? "Schedule saved. Provider delivery will run only through a configured publishing adapter."
        : "Social post draft saved.",
  });
}
