import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { getStaffContext } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DealerOS",
  description: "Secure dealership operations workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffContext();
  return (
    <AdminShell
      role={staff?.role ?? null}
      organisationName={staff?.organisationName ?? "DealerOS"}
      displayName={staff?.displayName ?? "Team member"}
    >
      {children}
    </AdminShell>
  );
}
