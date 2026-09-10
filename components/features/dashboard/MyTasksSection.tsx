"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MyTask {
  id: string;
  taskKey: string;
  taskNumber: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  project: { id: string; name: string; key: string; color: string | null };
  _count: { comments: number; subTasks: number };
}

interface MyTasksSectionProps {
  workspaceId: string;
  userId: string;
}

export function MyTasksSection({ workspaceId, userId }: MyTasksSectionProps) {
  const { data, isLoading, isError } = useQuery<{ tasks: MyTask[]; total: number }>({
    queryKey: ["dashboard", userId, "my-tasks", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/my-tasks`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
  });

  return (
    <Card glass className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">My Tasks</CardTitle>
          {isLoading ? (
            <Skeleton className="mt-1.5 inline-block h-3.5 w-20" />
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {`${data?.total ?? 0} active task${(data?.total ?? 0) !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <Link
          href={`/app/tasks`}
          className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
        >
          View all →
        </Link>
      </CardHeader>

      <CardContent className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-xs text-destructive">
            Failed to load tasks. Try refreshing.
          </p>
        ) : !data?.tasks.length ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="mt-1 text-xs text-muted-foreground">No active tasks assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ task }: { task: MyTask }) {
  const formattedDue = React.useMemo(() => {
    if (!task.dueDate) return null;
    return new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [task.dueDate]);

  return (
    <Link
      href={`/app/tasks/${task.id}`}
      className="group flex items-start gap-3 rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-nested hover:shadow-card"
    >
      <div className="mt-0.5 shrink-0">
        <StatusBadge status={task.status as Parameters<typeof StatusBadge>[0]["status"]} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground/80 transition-colors group-hover:text-primary">
              {task.taskKey}
            </span>
            <p className="mt-0.5 line-clamp-1 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary/95">
              {task.title}
            </p>
          </div>
          <PriorityBadge
            priority={task.priority as Parameters<typeof PriorityBadge>[0]["priority"]}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          {/* Project chip */}
          <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {task.project.color && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: task.project.color }}
              />
            )}
            {task.project.name}
          </span>

          {/* Due date */}
          {formattedDue && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                task.isOverdue
                  ? "motion-safe:animate-pulse border-rose-500/30 bg-rose-500/15 font-semibold text-rose-400"
                  : "border-border/40 bg-secondary text-muted-foreground"
              )}
            >
              <svg
                className="h-2.5 w-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {task.isOverdue ? "Overdue · " : ""}
              {formattedDue}
            </span>
          )}

          {/* Subtasks indicator */}
          {Boolean(task._count?.subTasks) && (
            <span className="text-[10px] text-muted-foreground/60">
              ↳ {task._count.subTasks} sub
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
