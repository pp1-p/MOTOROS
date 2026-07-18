"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AdminTaskListItem } from "@/lib/types/admin-operational";
import { cn } from "@/lib/utils";

export function TasksWorkspace({
  tasks,
  currentUserName,
  initialCreate = false,
}: {
  tasks: AdminTaskListItem[];
  currentUserName: string;
  initialCreate?: boolean;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState<string[]>(() =>
    tasks.filter((task) => task.completed).map((task) => task.id),
  );
  const [filter, setFilter] = useState<"all" | "mine" | "overdue" | "complete">("all");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreate);
  const [creating, setCreating] = useState(false);

  const visible = tasks.filter((task) => {
    if (filter === "mine") return task.assignedToMe && !completed.includes(task.id);
    if (filter === "overdue") return task.status === "Overdue";
    if (filter === "complete") return completed.includes(task.id);
    return !completed.includes(task.id);
  });

  async function toggleTask(id: string) {
    const wasComplete = completed.includes(id);
    setCompleted((current) =>
      wasComplete ? current.filter((item) => item !== id) : [...current, id],
    );
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: wasComplete ? "open" : "completed" }),
      });
      if (!response.ok) throw new Error();
      setMessage(wasComplete ? "Task reopened." : "Task completed.");
      router.refresh();
    } catch {
      setCompleted((current) =>
        wasComplete ? [...current, id] : current.filter((item) => item !== id),
      );
      setMessage("The task could not be updated. Its previous status has been restored.");
    }
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") ?? "");
    const dueTime = String(form.get("dueTime") ?? "17:00");
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || null,
      dueAt: dueDate ? new Date(`${dueDate}T${dueTime}:00+01:00`).toISOString() : null,
      priority: String(form.get("priority") ?? "normal"),
    };
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setMessage(result?.message ?? "The task could not be created. Your details remain on screen.");
        return;
      }
      setMessage("Task created.");
      router.refresh();
      window.setTimeout(() => setCreateOpen(false), 650);
    } catch {
      setMessage("DealerOS could not reach the server. No task was created.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1">
          {[
            [
              "all",
              "Open",
              tasks.filter((task) => !task.completed).length,
            ],
            [
              "mine",
              "Assigned to me",
              tasks.filter((task) => task.assignedToMe && !task.completed).length,
            ],
            [
              "overdue",
              "Overdue",
              tasks.filter((task) => task.status === "Overdue").length,
            ],
            ["complete", "Completed", completed.length],
          ].map(([id, label, count]) => (
            <button
              key={String(id)}
              type="button"
              title={id === "mine" ? `Signed in as ${currentUserName}` : undefined}
              onClick={() => setFilter(id as typeof filter)}
              className={cn(
                "rounded-lg px-3 py-2 text-[10px] font-extrabold",
                filter === id ? "bg-brand-soft text-brand-strong" : "text-foreground/45 hover:bg-surface-muted",
              )}
            >
              {label} <span className="ml-1 opacity-55">{count}</span>
            </button>
          ))}
        </div>
        <Button type="button" size="sm" className="sm:ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus />
            Add task
        </Button>
      </div>
      {message ? (
        <p role="status" className="rounded-xl bg-surface-muted px-4 py-3 text-xs font-bold">
          {message}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="divide-y">
          {visible.map((task) => {
            const done = completed.includes(task.id);
            return (
              <div
                key={task.id}
                className={cn(
                  "grid gap-3 p-4 transition hover:bg-[#fafaf8] sm:grid-cols-[auto_minmax(0,1fr)_140px_120px_90px_auto] sm:items-center",
                  done && "opacity-55",
                )}
              >
                <button
                  type="button"
                  onClick={() => void toggleTask(task.id)}
                  className="grid size-8 place-items-center rounded-lg text-foreground/30 hover:bg-brand-soft hover:text-brand"
                  aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                  {done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5" />}
                </button>
                <div className="min-w-0">
                  <p className={cn("truncate text-xs font-extrabold", done && "line-through")}>
                    {task.title}
                  </p>
                  <Link
                    href={task.href}
                    className="mt-0.5 block text-[10px] font-bold text-brand hover:underline"
                  >
                    {task.linked}
                  </Link>
                </div>
                <p className="text-xs font-semibold text-foreground/50">{task.owner}</p>
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-bold",
                    task.status === "Overdue" && !done ? "text-danger" : "text-foreground/50",
                  )}
                >
                  <Clock3 className="size-3.5" />
                  {task.due}
                </p>
                <span
                  className={cn(
                    "w-fit rounded-full px-2 py-1 text-[9px] font-extrabold",
                    task.priority === "High"
                      ? "bg-red-100 text-red-800"
                      : task.priority === "Low"
                        ? "bg-surface-muted text-foreground/45"
                        : "bg-amber-100 text-amber-800",
                  )}
                >
                  {task.priority}
                </span>
              </div>
            );
          })}
          {!visible.length ? (
            <div className="p-16 text-center">
              <Check className="mx-auto size-6 text-emerald-600" />
              <p className="mt-3 text-sm font-extrabold">Nothing in this view</p>
              <p className="mt-1 text-xs text-foreground/42">You’re up to date.</p>
            </div>
          ) : null}
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#09100e]/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <form onSubmit={createTask} className="my-8 w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand">
                  Quick create
                </p>
                <h2 id="create-task-title" className="mt-1 font-extrabold">
                  Add a task
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-surface-muted"
                aria-label="Close task form"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-extrabold">
                Task
                <Input name="title" className="mt-1.5" required autoFocus />
              </label>
              <label className="block text-xs font-extrabold">
                Description
                <Textarea name="description" className="mt-1.5" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-xs font-extrabold">
                  Due date
                  <Input name="dueDate" type="date" className="mt-1.5" />
                </label>
                <label className="text-xs font-extrabold">
                  Due time
                  <Input name="dueTime" type="time" defaultValue="17:00" className="mt-1.5" />
                </label>
              </div>
              <label className="block text-xs font-extrabold">
                Priority
                <select
                  name="priority"
                  className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </label>
              {message ? (
                <p role="status" className="rounded-lg bg-surface-muted p-3 text-xs">
                  {message}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <LoaderCircle className="animate-spin" /> : <Plus />}
                Create task
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
