import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  ACTIVE_ORGANISATION_COOKIE,
  ACTIVE_ORGANISATION_COOKIE_OPTIONS,
  chooseActiveMembership,
  type MembershipCandidate,
} from "@/lib/tenancy/membership";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isSignIn = request.nextUrl.pathname === "/admin/sign-in";
  const isForbidden = request.nextUrl.pathname === "/admin/forbidden";
  const isAcceptInvite = request.nextUrl.pathname === "/admin/accept-invite";
  const demoMode =
    process.env.DEALEROS_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

  if (!url || !key) {
    if (isAdminRoute && !isSignIn && !demoMode) {
      return NextResponse.redirect(new URL("/admin/sign-in?setup=required", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeMembership: MembershipCandidate | null = null;
  if (user && isAdminRoute) {
    const memberships = await supabase
      .from("organisation_members")
      .select(
        "organisation_id,role,is_primary,created_at,organisations(id,name,status,deleted_at)",
      )
      .eq("user_id", user.id)
      .eq("is_active", true);
    activeMembership = chooseActiveMembership(
      (memberships.data ?? []) as MembershipCandidate[],
      request.cookies.get(ACTIVE_ORGANISATION_COOKIE)?.value,
    );

    if (
      activeMembership &&
      request.cookies.get(ACTIVE_ORGANISATION_COOKIE)?.value !==
        activeMembership.organisation_id
    ) {
      request.cookies.set(
        ACTIVE_ORGANISATION_COOKIE,
        activeMembership.organisation_id,
      );
      response.cookies.set(
        ACTIVE_ORGANISATION_COOKIE,
        activeMembership.organisation_id,
        {
          ...ACTIVE_ORGANISATION_COOKIE_OPTIONS,
          secure: process.env.NODE_ENV === "production",
        },
      );
    }
  }

  if (isAdminRoute && !isSignIn && !user) {
    const destination = new URL("/admin/sign-in", request.url);
    destination.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(destination);
  }

  if (isSignIn && user) {
    const redirectPath =
      activeMembership?.role === "technician"
        ? "/admin/repairs"
        : activeMembership?.role === "website_editor"
          ? "/admin/website"
          : activeMembership
            ? "/admin"
            : "/admin/forbidden";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  if (isAdminRoute && !isSignIn && !isAcceptInvite && user) {
    const role = activeMembership?.role;
    if (!role) {
      if (isForbidden) return response;
      return NextResponse.redirect(new URL("/admin/forbidden", request.url));
    }

    const roleRoutes: Array<{ prefix: string; roles: string[] }> = [
      { prefix: "/admin/team", roles: ["owner"] },
      { prefix: "/admin/integrations", roles: ["owner"] },
      { prefix: "/admin/health", roles: ["owner"] },
      { prefix: "/admin/audit", roles: ["owner"] },
      { prefix: "/admin/reports", roles: ["owner", "manager"] },
      { prefix: "/admin/settings", roles: ["owner", "manager"] },
      {
        prefix: "/admin/website",
        roles: ["owner", "manager", "website_editor"],
      },
      {
        prefix: "/admin/repairs",
        roles: ["owner", "manager", "service_advisor", "technician"],
      },
      {
        prefix: "/admin/stock",
        roles: [
          "owner",
          "manager",
          "salesperson",
          "service_advisor",
          "website_editor",
        ],
      },
      {
        prefix: "/admin/leads",
        roles: ["owner", "manager", "salesperson"],
      },
      {
        prefix: "/admin/sales",
        roles: ["owner", "manager", "salesperson"],
      },
      {
        prefix: "/admin/invoices",
        roles: ["owner", "manager", "salesperson", "service_advisor"],
      },
      {
        prefix: "/admin/sourcing",
        roles: ["owner", "manager", "salesperson"],
      },
      {
        prefix: "/admin/customers",
        roles: ["owner", "manager", "salesperson", "service_advisor"],
      },
      {
        prefix: "/admin/diary",
        roles: ["owner", "manager", "salesperson", "service_advisor"],
      },
      {
        prefix: "/admin/tasks",
        roles: [
          "owner",
          "manager",
          "salesperson",
          "service_advisor",
          "technician",
        ],
      },
      {
        prefix: "/admin/documents",
        roles: [
          "owner",
          "manager",
          "salesperson",
          "service_advisor",
          "technician",
        ],
      },
      {
        prefix: "/admin",
        roles: ["owner", "manager", "salesperson", "service_advisor"],
      },
    ];
    const rule = roleRoutes.find(
      (item) =>
        request.nextUrl.pathname === item.prefix ||
        request.nextUrl.pathname.startsWith(`${item.prefix}/`),
    );
    if (rule && !rule.roles.includes(role) && !isForbidden) {
      return NextResponse.redirect(new URL("/admin/forbidden", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
