import { Suspense } from "react";

import { DiaryWorkspace } from "@/components/admin/diary-workspace";
import { PageHeader } from "@/components/admin/page-kit";
import { getAdminDiaryList } from "@/lib/data/admin-operational";

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const diary = await getAdminDiaryList(week);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Appointments & availability"
        title="Diary"
        description="Repair calls, viewings, test drives, sourcing conversations and protected staff time in Europe/London."
      />
      <Suspense fallback={<div className="min-h-[620px] rounded-2xl border bg-white" />}>
        <DiaryWorkspace {...diary} />
      </Suspense>
    </div>
  );
}
