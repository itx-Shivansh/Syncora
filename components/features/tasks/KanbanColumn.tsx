"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskStatus } from "@prisma/client";
import { TaskItem } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: TaskItem[];
  colorDot?: string;
  onTaskClick?: (task: TaskItem) => void;
  onQuickAdd?: (status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  colorDot,
  onTaskClick,
  onQuickAdd,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: "Column",
      status,
    },
  });

  const taskIds = React.useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-80 min-w-[20rem] max-w-[20rem] shrink-0 flex-col rounded-2xl border border-border/50 bg-card/45 p-3 shadow-subtle backdrop-blur-md transition-colors duration-150",
        "h-[calc(100vh-210px)] min-h-[500px]",
        isOver && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {/* Column Header */}
      <div className="mb-2.5 flex items-center justify-between px-1.5 py-1">
        <div className="flex items-center gap-2">
          {colorDot && (
            <span
              className="shadow-xs h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorDot }}
            />
          )}
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <span className="inline-flex items-center justify-center rounded-full border border-border/40 bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>

        {onQuickAdd && (
          <button
            type="button"
            onClick={() => onQuickAdd(status)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Add task to ${title}`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Column Task List */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pb-4 pr-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </SortableContext>

        {/* Empty state within column */}
        {tasks.length === 0 && (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground transition-colors",
              isOver
                ? "border-primary/60 bg-primary/10 text-primary"
                : "bg-card/10 hover:bg-card/20"
            )}
          >
            <p className="font-medium">{isOver ? "Drop here" : "No tasks yet"}</p>
            {onQuickAdd && !isOver && (
              <button
                type="button"
                onClick={() => onQuickAdd(status)}
                aria-label={`Create first task in ${title}`}
                className="mt-2 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              >
                + Create one
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
