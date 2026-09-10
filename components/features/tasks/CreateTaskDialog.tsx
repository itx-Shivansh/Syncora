"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskStatus, TaskPriority } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { LabelOption, TaskItem } from "@/types/task";

interface MemberOption {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface CreateTaskDialogProps {
  projectId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TaskStatus;
  onTaskCreated?: (task: TaskItem) => void;
}

export function CreateTaskDialog({
  projectId,
  workspaceId,
  open,
  onOpenChange,
  defaultStatus = "TODO",
  onTaskCreated,
}: CreateTaskDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = React.useState<string>("");
  const [dueDate, setDueDate] = React.useState<string>("");
  const [estimatedHours, setEstimatedHours] = React.useState<string>("");
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Sync defaultStatus when prop changes or modal opens
  React.useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setErrorMsg(null);
    }
  }, [open, defaultStatus]);

  // Fetch project members for the assignee dropdown.
  // Uses a dedicated cache key + dedicated endpoint to avoid a shape conflict:
  // the board page stores { project: {...} } under ["project", projectId],
  // so reading .members off that cached value always returns undefined.
  const { data: membersData } = useQuery<{ members: MemberOption[] }>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) return { members: [] };
      const json = await res.json();
      return json.data || { members: [] };
    },
    enabled: open && Boolean(projectId),
    staleTime: 30_000, // project membership rarely changes mid-session
  });

  // Fetch workspace labels
  const { data: labelsData } = useQuery<{ labels: LabelOption[] }>({
    queryKey: ["workspace-labels", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { labels: [] };
      const res = await fetch(`/api/workspaces/${workspaceId}/labels`);
      if (!res.ok) return { labels: [] };
      const json = await res.json();
      return json.data || { labels: [] };
    },
    enabled: open && Boolean(workspaceId),
  });

  const projectMembers: MemberOption[] = membersData?.members || [];
  const labels: LabelOption[] = labelsData?.labels || [];

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        status,
        priority,
        assigneeId: assigneeId ? assigneeId : null,
        dueDate: dueDate ? dueDate : null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        labelIds: selectedLabelIds,
      };

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create task");
      }
      return json.data?.task as TaskItem;
    },
    onSuccess: (newTask) => {
      toast.success("Task created", `Created ${newTask.taskKey || newTask.title}`);
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      // Note: we do NOT invalidate ["project", projectId] here — creating a task
      // does not change the project record itself. Invalidating the project query
      // caused the board to briefly flash "Project Not Found" while re-fetching.
      if (onTaskCreated) {
        onTaskCreated(newTask);
      }

      // Reset form
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority("MEDIUM");
      setAssigneeId("");
      setDueDate("");
      setEstimatedHours("");
      setSelectedLabelIds([]);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message);
      toast.error("Failed to create task", err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Task title is required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Create New Task</DialogTitle>
          <DialogDescription>Add an atomic unit of work to the project board.</DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Task Title <span className="text-primary">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement Webhooks listener for stripe events"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background, context, or acceptance criteria..."
              className="w-full resize-none rounded-xl border border-input bg-card/60 px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="h-10 w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-10 w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Assignee & Due Date Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Unassigned</option>
                {projectMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name} ({m.user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Estimated Hours */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Estimated Hours
            </label>
            <Input
              type="number"
              min="0"
              step="0.5"
              max="1000"
              placeholder="e.g. 4.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">Labels</label>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-border/40 bg-card/40 p-1.5">
                {labels.map((label) => {
                  const isSelected = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all"
                      style={{
                        backgroundColor: isSelected ? `${label.color}25` : "transparent",
                        borderColor: isSelected ? label.color : "rgba(255,255,255,0.1)",
                        color: isSelected ? label.color : "inherit",
                      }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
              {createMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
