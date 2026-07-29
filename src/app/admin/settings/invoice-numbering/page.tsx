import { redirect } from "next/navigation";

import { InvoiceNumberingWorkspace } from "@/components/admin/invoice-numbering-workspace";
import { PageHeader } from "@/components/admin/page-kit";
import { getStaffContext, hasPermission } from "@/lib/auth/permissions";
import { getInvoiceNumberSequences } from "@/lib/data/admin-invoice-numbering";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoice numbering",
};

export default async function InvoiceNumberingPage() {
  const staff = await getStaffContext();
  if (!staff) redirect("/admin/sign-in");
  const canManage = hasPermission(staff.role, "settings:manage");

  const sequences = await getInvoiceNumberSequences();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Invoice numbering"
        description="Independent sequences per invoice type. Change a prefix (REP, SLE, GEN…) or fast-forward the next number if you're carrying over from an older system."
      />
      <InvoiceNumberingWorkspace initial={sequences} canManage={canManage} />
    </div>
  );
}
