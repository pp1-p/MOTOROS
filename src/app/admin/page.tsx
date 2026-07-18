import { formatInTimeZone } from "date-fns-tz";

import { Dashboard } from "@/components/admin/dashboard";
import { getAdminDiaryList, getAdminLeadList } from "@/lib/data/admin-operational";
import { getAdminReportsSnapshot } from "@/lib/data/admin-reports";
import { getDashboardSnapshot } from "@/lib/data/dashboard";

export default async function AdminOverviewPage() {
  const snapshot = await getDashboardSnapshot();
  const details = snapshot
    ? await Promise.all([
        snapshot.canViewLeads ? getAdminLeadList() : Promise.resolve(null),
        getAdminDiaryList(),
        snapshot.canViewCommercial
          ? getAdminReportsSnapshot()
          : Promise.resolve(null),
      ])
        .then(([leadList, diary, reports]) => ({
          leads: leadList?.leads.slice(0, 4) ?? [],
          averageLeadResponseMinutes:
            leadList?.metrics.averageResponseMinutes ?? null,
          appointments: diary.appointments.filter(
            (appointment) =>
              appointment.date ===
              formatInTimeZone(new Date(), diary.timezone, "yyyy-MM-dd"),
          ),
          salesTrend: reports?.monthlySales ?? [],
        }))
        .catch(() => null)
    : null;
  return <Dashboard snapshot={snapshot} details={details} />;
}
