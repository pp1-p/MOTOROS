import { formatInTimeZone } from "date-fns-tz";

import { Dashboard } from "@/components/admin/dashboard";
import {
  getAdminDiaryList,
  getAdminLeadList,
} from "@/lib/data/admin-operational";
import { getDashboardSnapshot } from "@/lib/data/dashboard";

export default async function AdminOverviewPage() {
  const snapshot = await getDashboardSnapshot();
  const details = snapshot
    ? await Promise.all([
        snapshot.canViewLeads ? getAdminLeadList() : Promise.resolve(null),
        getAdminDiaryList(),
      ])
        .then(([leadList, diary]) => ({
          leads: leadList?.leads.slice(0, 4) ?? [],
          averageLeadResponseMinutes:
            leadList?.metrics.averageResponseMinutes ?? null,
          appointments: diary.appointments.filter(
            (appointment) =>
              appointment.date ===
              formatInTimeZone(new Date(), diary.timezone, "yyyy-MM-dd"),
          ),
        }))
        .catch(() => null)
    : null;

  return <Dashboard snapshot={snapshot} details={details} />;
}
