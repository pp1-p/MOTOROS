"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusPill } from "@/components/admin/page-kit";
import { Button } from "@/components/ui/button";

type CalendarPost = {
  id: string;
  caption: string;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  targetProviders: string[];
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(value: Date) {
  const result = new Date(value);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function calendarKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function postDate(post: CalendarPost) {
  return new Date(post.scheduledFor ?? post.publishedAt ?? post.createdAt);
}

export function SocialCalendarView({
  posts,
  anchorDate,
}: {
  posts: CalendarPost[];
  anchorDate: string;
}) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date(anchorDate));

  const days = useMemo(() => {
    const start =
      mode === "week"
        ? startOfWeek(cursor)
        : startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const length = mode === "week" ? 7 : 42;
    return Array.from({ length }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor, mode]);

  const postsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarPost[]>();
    for (const post of posts) {
      const key = calendarKey(postDate(post));
      grouped.set(key, [...(grouped.get(key) ?? []), post]);
    }
    return grouped;
  }, [posts]);

  function move(direction: -1 | 1) {
    setCursor((current) => {
      const next = new Date(current);
      if (mode === "week") next.setDate(next.getDate() + direction * 7);
      else next.setMonth(next.getMonth() + direction, 1);
      return next;
    });
  }

  const label =
    mode === "month"
      ? new Intl.DateTimeFormat("en-GB", {
          month: "long",
          year: "numeric",
        }).format(cursor)
      : `${new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
        }).format(days[0])} – ${new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(days[days.length - 1])}`;

  return (
    <section className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <Button aria-label="Previous period" size="icon" variant="outline" onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <Button aria-label="Next period" size="icon" variant="outline" onClick={() => move(1)}>
            <ChevronRight />
          </Button>
          <h2 className="ml-1 text-sm font-extrabold">{label}</h2>
        </div>
        <div className="rounded-xl bg-surface-muted p-1">
          {(["month", "week"] as const).map((item) => (
            <button
              key={item}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-extrabold capitalize ${
                mode === item ? "bg-white shadow-sm" : "text-foreground/50"
              }`}
              type="button"
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-surface-muted/50">
        {weekdayLabels.map((weekday) => (
          <div key={weekday} className="border-r px-2 py-2 text-center text-[9px] font-extrabold uppercase tracking-wider text-foreground/40 last:border-r-0">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayPosts = postsByDay.get(calendarKey(day)) ?? [];
          const outsideMonth =
            mode === "month" && day.getMonth() !== cursor.getMonth();
          return (
            <div
              key={calendarKey(day)}
              className={`min-h-28 border-b border-r p-2 last:border-r-0 ${
                outsideMonth ? "bg-surface-muted/35 text-foreground/35" : ""
              }`}
            >
              <p className="text-[10px] font-extrabold tabular-nums">{day.getDate()}</p>
              <div className="mt-2 space-y-1.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className="rounded-lg border bg-white p-2 shadow-sm">
                    <p className="line-clamp-2 text-[9px] font-bold leading-3.5">
                      {post.caption}
                    </p>
                    <div className="mt-1.5 scale-[.8] origin-left">
                      <StatusPill status={post.status} />
                    </div>
                  </div>
                ))}
                {dayPosts.length > 3 ? (
                  <p className="text-[9px] font-bold text-brand">
                    +{dayPosts.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
