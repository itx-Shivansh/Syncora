import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    // TaskStatus
    | "status-backlog"
    | "status-todo"
    | "status-inprogress"
    | "status-inreview"
    | "status-done"
    | "status-cancelled"
    // TaskPriority
    | "priority-low"
    | "priority-medium"
    | "priority-high"
    | "priority-urgent";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<string, string> = {
    default: "bg-primary/15 text-primary border-primary/20",
    secondary: "bg-secondary text-secondary-foreground border-white/5",
    outline: "border-border text-foreground bg-transparent",
    destructive: "bg-destructive/15 text-destructive border-destructive/20",

    // TaskStatus
    "status-backlog": "bg-status-backlog-bg text-status-backlog-fg border-status-backlog-border",
    "status-todo": "bg-status-todo-bg text-status-todo-fg border-status-todo-border",
    "status-inprogress":
      "bg-status-inprogress-bg text-status-inprogress-fg border-status-inprogress-border",
    "status-inreview":
      "bg-status-inreview-bg text-status-inreview-fg border-status-inreview-border",
    "status-done": "bg-status-done-bg text-status-done-fg border-status-done-border",
    "status-cancelled":
      "bg-status-cancelled-bg text-status-cancelled-fg border-status-cancelled-border",

    // TaskPriority
    "priority-low": "bg-priority-low-bg text-priority-low-fg border-priority-low-border",
    "priority-medium":
      "bg-priority-medium-bg text-priority-medium-fg border-priority-medium-border",
    "priority-high": "bg-priority-high-bg text-priority-high-fg border-priority-high-border",
    "priority-urgent":
      "bg-priority-urgent-bg text-priority-urgent-fg border-priority-urgent-border font-semibold",
  };

  const dotColors: Record<string, string> = {
    default: "bg-primary",
    secondary: "bg-muted-foreground",
    outline: "bg-foreground",
    destructive: "bg-destructive",
    "status-backlog": "bg-slate-400",
    "status-todo": "bg-sky-400",
    "status-inprogress": "bg-amber-400 motion-safe:animate-pulse",
    "status-inreview": "bg-purple-400",
    "status-done": "bg-emerald-400",
    "status-cancelled": "bg-rose-400",
    "priority-low": "bg-zinc-400",
    "priority-medium": "bg-blue-400",
    "priority-high": "bg-orange-400",
    "priority-urgent": "bg-red-400 motion-safe:animate-ping",
  };

  return (
    <div
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColors[variant] || "bg-current")}
        />
      )}
      {children}
    </div>
  );
}

/**
 * Convenience helper to render TaskStatus badge from Prisma enum
 */
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");
  const labels: Record<string, string> = {
    BACKLOG: "Backlog",
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
    CANCELLED: "Cancelled",
  };
  const variantKey = `status-${normalized.toLowerCase().replace("_", "")}` as BadgeProps["variant"];

  return (
    <Badge variant={variantKey} dot>
      {labels[normalized] || status}
    </Badge>
  );
}

/**
 * Convenience helper to render TaskPriority badge from Prisma enum
 */
export function PriorityBadge({ priority }: { priority: string }) {
  const normalized = priority.toUpperCase();
  const labels: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
  };
  const variantKey = `priority-${normalized.toLowerCase()}` as BadgeProps["variant"];

  return (
    <Badge variant={variantKey} dot={normalized === "URGENT"}>
      {labels[normalized] || priority}
    </Badge>
  );
}

/**
 * Convenience helper to render ProjectStatus badge from Prisma enum
 * PLANNING | ACTIVE | ON_HOLD | COMPLETED | ARCHIVED
 */
export function ProjectStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const configs: Record<string, { label: string; className: string; dotClass: string }> = {
    PLANNING: {
      label: "Planning",
      className: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      dotClass: "bg-sky-400",
    },
    ACTIVE: {
      label: "Active",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dotClass: "bg-emerald-400",
    },
    ON_HOLD: {
      label: "On Hold",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dotClass: "bg-amber-400",
    },
    COMPLETED: {
      label: "Completed",
      className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      dotClass: "bg-purple-400",
    },
    ARCHIVED: {
      label: "Archived",
      className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      dotClass: "bg-zinc-400",
    },
  };

  const config = configs[normalized] || {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground",
  };

  return (
    <div
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        config.className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotClass)} />
      {config.label}
    </div>
  );
}

/**
 * Convenience helper to render ProjectRole badge from Prisma enum
 * LEAD | MEMBER | VIEWER
 */
export function ProjectRoleBadge({ role }: { role: string }) {
  const normalized = role.toUpperCase();
  const styles: Record<string, string> = {
    LEAD: "bg-primary/15 text-primary border-primary/25 font-semibold",
    MEMBER: "bg-secondary text-secondary-foreground border-border",
    VIEWER: "bg-muted/50 text-muted-foreground border-border/50",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        styles[normalized] || styles.VIEWER
      )}
    >
      {role}
    </div>
  );
}
