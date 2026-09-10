"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface UpcomingTask {
  id: string;
  taskKey: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  project: { id: string; name: string; key: string; color: string | null };
}

interface UpcomingData {
  upcoming: UpcomingTask[];
  recentlyCompleted: UpcomingTask[];
}

interface UpcomingSectionProps {
  workspaceId: string;
  userId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-rose-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-blue-400",
  LOW: "text-zinc-400",
};

export function UpcomingSection({ workspaceId, userId }: UpcomingSectionProps) {
  const [activeTab, setActiveTab] = React.useState<"upcoming" | "completed">("upcoming");

  const { data, isLoading, isError } = useQuery<UpcomingData>({
    queryKey: ["dashboard", userId, "upcoming", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/upcoming`);
      if (!res.ok) throw new Error("Failed to fetch upcoming tasks");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60_000,
  });

  const tasks = activeTab === "upcoming" ? (data?.upcoming ?? []) : (data?.recentlyCompleted ?? []);

  return (
    <Card glass className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Timeline</CardTitle>
        {/* Tab switcher */}
        <div className="mt-2 flex gap-1 rounded-lg border border-border/40 bg-secondary/40 p-0.5">
          {(["upcoming", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "upcoming" ? "Due this week" : "Recently done"}
              {!isLoading && data && (
                <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                  ({tab === "upcoming" ? data.upcoming.length : data.recentlyCompleted.length})
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-xs text-destructive">
            Failed to load. Try refreshing.
          </p>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {activeTab === "upcoming" ? "Nothing due this week" : "No completions yet"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === "upcoming"
                ? "No tasks assigned to you in the next 7 days."
                : "Tasks you complete will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <TimelineRow key={task.id} task={task} mode={activeTab} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineRow({ task, mode }: { task: UpcomingTask; mode: "upcoming" | "completed" }) {
  const dateLabel = React.useMemo(() => {
    const dateStr = mode === "upcoming" ? task.dueDate : task.updatedAt;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (mode === "upcoming") {
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    } else {
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    }
  }, [task.dueDate, task.updatedAt, mode]);

  const isDueToday =
    mode === "upcoming" &&
    task.dueDate &&
    new Date(task.dueDate).toDateString() === new Date().toDateString();

  return (
    <Link
      href={`/app/tasks/${task.id}`}
      className="group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-all duration-150 hover:border-border/40 hover:bg-surface-nested/70 hover:shadow-subtle"
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          mode === "completed"
            ? "bg-emerald-400"
            : isDueToday
              ? "motion-safe:animate-pulse bg-amber-400"
              : "bg-primary/60"
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <span className="line-clamp-1 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-primary/95">
            {task.title}
          </span>
          {dateLabel && (
            <span
              className={cn(
                "shrink-0 text-[10px] font-medium tabular-nums",
                isDueToday ? "text-amber-400" : "text-muted-foreground/60"
              )}
            >
              {dateLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-muted-foreground/60">{task.taskKey}</span>
          <span className="text-muted-foreground/40">·</span>
          <span
            className={cn("text-[10px] font-semibold capitalize", PRIORITY_COLORS[task.priority])}
          >
            {task.priority.toLowerCase()}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[10px] text-muted-foreground/60">{task.project.name}</span>
        </div>
      </div>
    </Link>
  );
}
