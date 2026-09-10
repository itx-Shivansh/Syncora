"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatus, TaskPriority } from "@prisma/client";

interface ActivityActor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: ActivityActor;
  task: { id: string; taskKey: string; title: string } | null;
  project: { id: string; name: string; key: string } | null;
}

interface ActivitySectionProps {
  workspaceId: string;
  userId: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatStatus(status?: unknown): string {
  if (typeof status !== "string") return "";
  const map: Record<TaskStatus, string> = {
    BACKLOG: "Backlog",
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
    CANCELLED: "Cancelled",
  };
  return map[status as TaskStatus] ?? status;
}

function formatPriority(priority?: unknown): string {
  if (typeof priority !== "string") return "";
  const map: Record<TaskPriority, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
  };
  return map[priority as TaskPriority] ?? priority;
}

function renderDescription(item: ActivityItem): React.ReactNode {
  const meta = (item.metadata ?? {}) as Record<string, unknown>;

  const taskRef = item.task ? (
    <span className="font-mono text-[11px] font-semibold text-primary">[{item.task.taskKey}]</span>
  ) : null;

  const projectRef = item.project ? (
    <span className="font-medium text-foreground">{item.project.name}</span>
  ) : null;

  switch (item.action) {
    case "STATUS_CHANGED":
      return (
        <span>
          {taskRef && <>{taskRef} </>}moved status from{" "}
          <span className="font-medium text-foreground">{formatStatus(meta.previousStatus)}</span>{" "}
          to <span className="font-medium text-foreground">{formatStatus(meta.newStatus)}</span>
        </span>
      );
    case "PRIORITY_CHANGED":
      return (
        <span>
          {taskRef && <>{taskRef} </>}changed priority to{" "}
          <span className="font-medium text-foreground">{formatPriority(meta.newPriority)}</span>
        </span>
      );
    case "ASSIGNEE_CHANGED":
      return <span>{taskRef && <>{taskRef} </>}updated the assignee</span>;
    case "DUE_DATE_CHANGED":
      return <span>{taskRef && <>{taskRef} </>}updated the due date</span>;
    case "COMMENT_ADDED":
      return <span>{taskRef && <>{taskRef} </>}posted a comment</span>;
    case "TASK_CREATED":
      return (
        <span>
          created task {taskRef} in {projectRef}
        </span>
      );
    case "TASK_UPDATED":
      return <span>{taskRef && <>{taskRef} </>}updated task details</span>;
    case "TASK_DELETED":
      return <span>deleted a task in {projectRef}</span>;
    case "PROJECT_CREATED":
      return <span>created project {projectRef}</span>;
    case "PROJECT_UPDATED":
      return <span>updated {projectRef} settings</span>;
    case "WORKSPACE_CREATED":
      return <span>created this workspace</span>;
    default:
      return <span>{item.action.toLowerCase().replace(/_/g, " ")}</span>;
  }
}

export function ActivitySection({ workspaceId, userId }: ActivitySectionProps) {
  const { data, isLoading, isError } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["dashboard", userId, "activity", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/activity`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // poll every minute for live feel
  });

  return (
    <Card glass className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Activity Feed</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Workspace-wide recent events</p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5">
          <span className="h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="text-[10px] font-semibold text-emerald-400">Live</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden px-4 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-xs text-destructive">
            Failed to load activity. Try refreshing.
          </p>
        ) : !data?.activities.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Activity from your workspace will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto" style={{ maxHeight: "380px" }}>
            {data.activities.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const content = (
    <div className="group flex items-start gap-3 text-xs text-muted-foreground">
      <Avatar
        name={item.actor.name}
        src={item.actor.avatarUrl}
        size="sm"
        className="shadow-xs mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-1.5 leading-relaxed">
          <span className="font-semibold text-foreground">{item.actor.name}</span>
          <span className="text-muted-foreground/90">{renderDescription(item)}</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">
          {formatRelativeTime(item.createdAt)}
        </div>
      </div>
    </div>
  );

  // If there's a linked task, make the row clickable
  if (item.task) {
    return (
      <Link
        href={`/app/tasks/${item.task.id}`}
        className="block rounded-lg px-2 py-1.5 transition-all duration-150 hover:bg-surface-nested/70 hover:shadow-subtle"
      >
        {content}
      </Link>
    );
  }

  return <div className="px-1 py-0.5">{content}</div>;
}
