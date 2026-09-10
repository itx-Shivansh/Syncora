"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { PriorityBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface SubtaskItem {
  id: string;
  taskKey: string;
  taskNumber: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex?: number;
}

interface TaskSubtasksProps {
  taskId: string;
  subTasks: SubtaskItem[];
  onUpdated?: () => void;
}

export function TaskSubtasks({ taskId, subTasks, onUpdated }: TaskSubtasksProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [newTitle, setNewTitle] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TaskPriority>("MEDIUM");
  const [isAdding, setIsAdding] = React.useState(false);

  const doneCount = subTasks.filter((st) => st.status === "DONE").length;
  const totalCount = subTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Toggle subtask status mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ subTaskId, newStatus }: { subTaskId: string; newStatus: TaskStatus }) => {
      const res = await fetch(`/api/tasks/${subTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update subtask");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] });
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to update subtask", err.message);
    },
  });

  // Create subtask mutation
  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: newPriority }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to create subtask");
      return json.data;
    },
    onSuccess: () => {
      setNewTitle("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] });
      toast.success("Subtask created", "Added to checklist");
      onUpdated?.();
    },
    onError: (err: Error) => {
      toast.error("Failed to add subtask", err.message);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate(newTitle.trim());
  };

  return (
    <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Subtasks</h3>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneCount}/{totalCount} ({progressPercent}%)
            </span>
          )}
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Add Subtask
          </button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Subtasks list */}
      {subTasks.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {subTasks.map((subTask) => {
            const isDone = subTask.status === "DONE";
            return (
              <div
                key={subTask.id}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 p-2 transition-colors",
                  isDone ? "bg-secondary/20 opacity-60" : "hover:border-primary/40 hover:bg-card/70"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() =>
                      toggleMutation.mutate({
                        subTaskId: subTask.id,
                        newStatus: isDone ? "TODO" : "DONE",
                      })
                    }
                    className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
                    {subTask.taskKey}
                  </span>
                  <span
                    className={cn(
                      "truncate text-xs font-medium",
                      isDone ? "text-muted-foreground line-through" : "text-foreground"
                    )}
                  >
                    {subTask.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <PriorityBadge priority={subTask.priority} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Add Subtask Input */}
      {isAdding && (
        <form
          onSubmit={handleCreateSubmit}
          className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-card/60 p-2.5 backdrop-blur-sm"
        >
          <input
            type="text"
            placeholder="Subtask title... (e.g. Write integration test)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            className="h-8 w-full rounded-lg border border-input bg-card/80 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Priority:</span>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="h-7 rounded border border-input bg-card px-2 text-[11px] text-foreground focus-visible:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle("");
                }}
                className="h-7 rounded px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newTitle.trim()}
                className="h-7 rounded bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
