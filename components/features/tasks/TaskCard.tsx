"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskItem } from "@/types/task";
import { PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: TaskItem;
  onClick?: (task: TaskItem) => void;
  isOverlay?: boolean;
}

export function TaskCard({ task, onClick, isOverlay = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = React.useMemo(() => {
    if (!task.dueDate) return false;
    if (task.status === "DONE" || task.status === "CANCELLED") return false;
    const due = new Date(task.dueDate);
    const now = new Date();
    // Compare with today's end of day or current time
    return due.getTime() < now.getTime();
  }, [task.dueDate, task.status]);

  const formattedDueDate = React.useMemo(() => {
    if (!task.dueDate) return null;
    try {
      const date = new Date(task.dueDate);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return null;
    }
  }, [task.dueDate]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="article"
      aria-label={`Task ${task.taskKey || task.taskNumber}: ${task.title}${task.priority ? `, ${task.priority.toLowerCase()} priority` : ""}`}
      tabIndex={0}
      onClick={() => onClick?.(task)}
      onKeyDown={(e) => {
        // Enter/Space activates click (open detail); arrow keys are
        // handled by dnd-kit KeyboardSensor via {...listeners}.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(task);
        }
      }}
      className={cn(
        "group relative flex select-none flex-col gap-2.5 rounded-xl border border-border/50 bg-surface-nested/80 p-3.5 shadow-subtle backdrop-blur-xs transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-nested hover:shadow-card",
        "cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        isDragging && "border-primary/50 bg-primary/5 opacity-30 shadow-none",
        isOverlay &&
          "rotate-2 scale-105 cursor-grabbing border-primary/60 bg-surface-nested shadow-card-hover ring-2 ring-primary/30"
      )}
    >
      {/* Top row: Key + Priority */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground/80 transition-colors duration-150 group-hover:text-primary">
          {task.taskKey || `#${task.taskNumber}`}
        </span>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Task title */}
      <h4 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors duration-150 group-hover:text-primary/95">
        {task.title}
      </h4>

      {/* Optional description preview */}
      {task.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      )}

      {/* Labels row: muted pill treatment */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {task.labels.map(({ label }) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full opacity-75"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer row: Due date / stats / assignee */}
      <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-1 text-xs">
        <div className="flex items-center gap-2">
          {/* Due date indicator */}
          {formattedDueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                isOverdue
                  ? "motion-safe:animate-pulse border-rose-500/30 bg-rose-500/15 font-semibold text-rose-400"
                  : "border-border/50 bg-secondary text-muted-foreground"
              )}
              title={isOverdue ? "Overdue" : "Due date"}
            >
              <svg
                className="h-3 w-3"
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
              {formattedDueDate}
            </span>
          )}

          {/* Subtask count if present */}
          {Boolean(task._count?.subTasks) && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              title={`${task._count?.subTasks} subtasks`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              {task._count?.subTasks}
            </span>
          )}

          {/* Comments count if present */}
          {Boolean(task._count?.comments) && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              title={`${task._count?.comments} comments`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              {task._count?.comments}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        <div>
          {task.assignee ? (
            <Avatar
              name={task.assignee.name}
              src={task.assignee.avatarUrl}
              size="sm"
              className="shadow-xs ring-1 ring-border"
            />
          ) : (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border/80 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/50"
              title="Unassigned"
            >
              <svg
                className="h-3 w-3 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
