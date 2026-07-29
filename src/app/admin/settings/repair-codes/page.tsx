import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-kit";
import { RepairCodesWorkspace } from "@/components/admin/repair-codes-workspace";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getRepairCodes } from "@/lib/data/admin-repair-codes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Repair codes",
};

export default async function RepairCodesPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/admin/sign-in");
  const canManage =
    hasPermission(staff.role, "settings:manage") ||
    hasPermission(staff.role, "repairs:manage");

  const codes = await getRepairCodes({ includeInactive: true });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Repair codes"
        description="Reusable codes for common labour, parts and diagnostic work. Typing or scanning a code on a repair invoice will pre-fill its description, price, labour hours and tax rate."
      />
      <RepairCodesWorkspace initialCodes={codes} canManage={canManage} />
    </div>
  );
}
