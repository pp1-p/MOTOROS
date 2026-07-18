import { NextResponse } from "next/server";

import { getStaffContext } from "@/lib/auth/permissions";
import { searchAdminRecords } from "@/lib/data/admin-search";

export async function GET(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ message: "Sign in is required." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const response = await searchAdminRecords(query);
  if (response.state === "unavailable") {
    return NextResponse.json(
      { message: response.message, results: [] },
      { status: 503 },
    );
  }
  return NextResponse.json({
    results: response.results.map((result) => ({
      type: result.type,
      id: result.id,
      title: result.title,
      detail: result.detail,
      href: result.href,
    })),
  });
}
