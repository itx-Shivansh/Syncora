"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { TaskStatus, TaskPriority } from "@prisma/client";

export interface ActivityItem {
  id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  task?: {
    id: string;
    taskKey: string;
    title: string;
  } | null;
}

interface TaskActivityFeedProps {
  activities: ActivityItem[];
  showTaskReference?: boolean;
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
  return map[status as TaskStatus] || status;
}

function formatPriority(priority?: unknown): string {
  if (typeof priority !== "string") return "";
  const map: Record<TaskPriority, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
  };
  return map[priority as TaskPriority] || priority;
}

export function TaskActivityFeed({ activities, showTaskReference = false }: TaskActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
        <svg
          className="mb-2 h-8 w-8 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        No activity recorded yet.
      </div>
    );
  }

  const renderDescription = (item: ActivityItem) => {
    const meta = (item.metadata || {}) as Record<string, unknown>;
    const taskPrefix =
      showTaskReference && item.task ? (
        <span className="mr-1 font-mono font-semibold text-primary">[{item.task.taskKey}]</span>
      ) : null;

    switch (item.action) {
      case "STATUS_CHANGED": {
        const from = formatStatus(meta.previousStatus || meta.from);
        const to = formatStatus(meta.newStatus || meta.to);
        return (
          <span>
            {taskPrefix}moved status from{" "}
            <span className="font-medium text-foreground">{from}</span> to{" "}
            <span className="font-medium text-foreground">{to}</span>
          </span>
        );
      }
      case "PRIORITY_CHANGED": {
        const to = formatPriority(meta.newPriority);
        return (
          <span>
            {taskPrefix}changed priority to{" "}
            <span className="font-medium text-foreground">{to}</span>
          </span>
        );
      }
      case "ASSIGNEE_CHANGED":
        return <span>{taskPrefix}updated the task assignee</span>;
      case "DUE_DATE_CHANGED":
        return <span>{taskPrefix}updated the due date</span>;
      case "COMMENT_ADDED":
        return <span>{taskPrefix}posted a comment</span>;
      case "TASK_CREATED":
        return <span>{taskPrefix}created this task</span>;
      case "TASK_UPDATED":
        return <span>{taskPrefix}updated task details</span>;
      case "PROJECT_CREATED":
        return <span>created the project</span>;
      case "PROJECT_UPDATED":
        return <span>updated project settings</span>;
      default:
        return (
          <span>
            {taskPrefix}
            {item.action.toLowerCase().replace(/_/g, " ")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {activities.map((item) => (
        <div key={item.id} className="group flex items-start gap-3 text-xs text-muted-foreground">
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
            <div className="mt-0.5 text-[10px] text-muted-foreground/60">
              {formatRelativeTime(item.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
