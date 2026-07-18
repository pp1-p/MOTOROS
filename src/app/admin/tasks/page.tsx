import { PageHeader } from "@/components/admin/page-kit";
import { TasksWorkspace } from "@/components/admin/tasks-workspace";
import { getAdminTaskList } from "@/lib/data/admin-operational";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const { create } = await searchParams;
  const { tasks, currentUserName } = await getAdminTaskList();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Follow-up & reminders"
        title="Tasks"
        description="Prioritised work linked to customers, vehicles, leads, sourcing requests, repairs and sales."
      />
      <TasksWorkspace
        tasks={tasks}
        currentUserName={currentUserName}
        initialCreate={create === "1"}
      />
    </div>
  );
}
