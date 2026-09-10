"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TaskSubtasks } from "@/components/features/tasks/TaskSubtasks";
import { TaskComments } from "@/components/features/tasks/TaskComments";
import { TaskActivityFeed, ActivityItem } from "@/components/features/tasks/TaskActivityFeed";
import { SanitizedMarkdown } from "@/components/ui/sanitized-markdown";
import { LabelOption } from "@/types/task";
import { cn } from "@/lib/utils";

interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface ProjectMember {
  userId: string;
  role: string;
  user: ProjectMemberUser;
}

interface Subtask {
  id: string;
  taskKey: string;
  taskNumber: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex?: number;
}

interface TaskCommentItem {
  id: string;
  content: string;
  parentId?: string | null;
  createdAt: string;
  isEdited?: boolean;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface TaskDetail {
  id: string;
  workspaceId: string;
  projectId: string;
  taskNumber: number;
  taskKey: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  assignee: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    key: string;
    workspaceId: string;
    visibility: string;
    color?: string | null;
    members: ProjectMember[];
  };
  labels: Array<{
    label: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  subTasks: Subtask[];
  comments: TaskCommentItem[];
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params?.id as string;
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = React.useState<"comments" | "activity">("comments");
  const [descTab, setDescTab] = React.useState<"write" | "preview">("write");

  // Editable local state
  const [editableTitle, setEditableTitle] = React.useState("");
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editableDesc, setEditableDesc] = React.useState("");
  const [isEditingDesc, setIsEditingDesc] = React.useState(false);

  // Fetch current user
  const { data: userData } = useQuery<{ user: { id: string; name: string } }>({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return { user: { id: "", name: "" } };
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch task detail
  const {
    data: taskData,
    isLoading: taskLoading,
    isError,
  } = useQuery<{
    task: TaskDetail;
    callerProjectRole: string | null;
    isLeadOrAdmin: boolean;
  }>({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to load task");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(taskId),
  });

  const task = taskData?.task;
  const isLeadOrAdmin = taskData?.isLeadOrAdmin ?? false;
  const currentUserId = userData?.user?.id ?? "";

  // Fetch task activity feed
  const { data: activityData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/activity`);
      if (!res.ok) return { activities: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(taskId) && activeTab === "activity",
  });

  // Fetch workspace labels
  const { data: labelsData } = useQuery<{ labels: LabelOption[] }>({
    queryKey: ["workspace-labels", task?.workspaceId],
    queryFn: async () => {
      if (!task?.workspaceId) return { labels: [] };
      const res = await fetch(`/api/workspaces/${task.workspaceId}/labels`);
      if (!res.ok) return { labels: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(task?.workspaceId),
  });

  const workspaceLabels = labelsData?.labels || [];

  // Sync title and description when task loads
  React.useEffect(() => {
    if (task) {
      setEditableTitle(task.title);
      setEditableDesc(task.description || "");
    }
  }, [task]);

  // Patch mutation
  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update task");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-activity", taskId] });
      if (task?.projectId) {
        queryClient.invalidateQueries({ queryKey: ["project-tasks", task.projectId] });
      }
      toast.success("Task updated");
    },
    onError: (err: Error) => {
      toast.error("Update failed", err.message);
    },
  });

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (!editableTitle.trim() || editableTitle.trim() === task?.title) {
      setEditableTitle(task?.title || "");
      return;
    }
    patchMutation.mutate({ title: editableTitle.trim() });
  };

  const handleDescSubmit = () => {
    setIsEditingDesc(false);
    if (editableDesc === (task?.description || "")) return;
    patchMutation.mutate({ description: editableDesc.trim() ? editableDesc.trim() : null });
  };

  const handleToggleLabel = (labelId: string) => {
    if (!task) return;
    const currentLabelIds = task.labels.map((l) => l.label.id);
    const newLabelIds = currentLabelIds.includes(labelId)
      ? currentLabelIds.filter((id) => id !== labelId)
      : [...currentLabelIds, labelId];
    patchMutation.mutate({ labelIds: newLabelIds });
  };

  if (taskLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex justify-between gap-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/4" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-60 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-semibold text-foreground">Task Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This task might have been deleted, moved, or requires different permissions.
        </p>
        <Link href="/app/tasks" className="mt-4">
          <Button variant="outline">Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb and Navigation */}
      <div className="flex flex-col justify-between gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link
            href={`/app/projects/${task.project.id}`}
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>{task.project.name}</span>
          </Link>
          <span className="text-border">/</span>
          <Link
            href={`/app/projects/${task.project.id}/board`}
            className="transition-colors hover:text-foreground"
          >
            Board
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono font-bold text-primary">{task.taskKey}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/app/projects/${task.project.id}/board`}>
            <Button variant="outline" size="sm" className="shadow-xs gap-1.5 text-xs">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              View on Board
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Title, Description, Subtasks, Activity/Comments */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header & Inline Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                {task.taskKey}
              </span>
              <span className="text-xs text-muted-foreground">
                Created {new Date(task.createdAt).toLocaleDateString()} by {task.creator.name}
              </span>
            </div>

            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSubmit();
                    if (e.key === "Escape") {
                      setEditableTitle(task.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="w-full rounded-lg border border-primary/40 bg-card/80 px-2 py-1 text-2xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="group flex cursor-pointer items-center gap-2 text-2xl font-bold tracking-tight text-foreground transition-colors hover:text-primary/90 sm:text-3xl"
                title="Click to edit title"
              >
                <span>{task.title}</span>
                <svg
                  className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </h1>
            )}
          </div>

          {/* Description Card with Write/Preview */}
          <div className="space-y-3 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm sm:p-5">
            <div className="flex items-center justify-between border-b border-border/30 pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </h3>
              <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-secondary/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setDescTab("write")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                    descTab === "write"
                      ? "shadow-xs bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setDescTab("preview")}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                    descTab === "preview"
                      ? "shadow-xs bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Preview
                </button>
              </div>
            </div>

            {descTab === "write" ? (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={editableDesc}
                  onChange={(e) => {
                    setEditableDesc(e.target.value);
                    setIsEditingDesc(true);
                  }}
                  onBlur={handleDescSubmit}
                  placeholder="Add a detailed description or acceptance criteria (markdown supported)..."
                  className="w-full resize-y rounded-xl border border-input bg-card/80 p-3 font-sans text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:text-sm"
                />
                {isEditingDesc && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={handleDescSubmit} className="h-7 text-xs">
                      Save Description
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-[100px] rounded-xl border border-border/30 bg-card/30 p-3 text-xs leading-relaxed text-foreground/90 sm:text-sm">
                {editableDesc || task.description ? (
                  <SanitizedMarkdown content={editableDesc || task.description || ""} />
                ) : (
                  <span className="italic text-muted-foreground">No description provided.</span>
                )}
              </div>
            )}
          </div>

          {/* Subtasks Section */}
          <div className="rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm sm:p-5">
            <TaskSubtasks taskId={task.id} subTasks={task.subTasks || []} />
          </div>

          {/* Discussion & Activity Section */}
          <div className="space-y-4 rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-sm sm:p-5">
            {/* Tabs Header */}
            <div className="flex items-center gap-4 border-b border-border/30 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-1 text-sm font-semibold transition-colors",
                  activeTab === "comments"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Comments</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {task.comments?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-1 text-sm font-semibold transition-colors",
                  activeTab === "activity"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Activity Feed</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === "comments" ? (
              <TaskComments
                taskId={task.id}
                comments={task.comments || []}
                currentUserId={currentUserId}
                isLeadOrAdmin={isLeadOrAdmin}
              />
            ) : (
              <TaskActivityFeed activities={activityData?.activities || []} />
            )}
          </div>
        </div>

        {/* Right Sidebar (1 Col): Properties & Pickers */}
        <div className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-border/50 bg-card/60 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <h3 className="border-b border-border/30 pb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Properties
            </h3>

            {/* Status Picker */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2">
                <StatusBadge status={task.status} />
                <select
                  value={task.status}
                  onChange={(e) => patchMutation.mutate({ status: e.target.value })}
                  className="ml-auto h-8 rounded-lg border border-input bg-card px-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Priority Picker */}
            <div className="space-y-1.5 border-t border-border/20 pt-2">
              <label className="block text-xs font-medium text-muted-foreground">Priority</label>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <select
                  value={task.priority}
                  onChange={(e) => patchMutation.mutate({ priority: e.target.value })}
                  className="ml-auto h-8 rounded-lg border border-input bg-card px-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            {/* Assignee Picker (Scoped to Project Members) */}
            <div className="space-y-1.5 border-t border-border/20 pt-2">
              <label className="block text-xs font-medium text-muted-foreground">Assignee</label>
              <div className="flex items-center gap-2">
                {task.assignee ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />
                    <span className="truncate text-xs font-medium text-foreground">
                      {task.assignee.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs italic text-muted-foreground">Unassigned</span>
                )}

                <select
                  value={task.assignee?.id || ""}
                  onChange={(e) =>
                    patchMutation.mutate({ assigneeId: e.target.value ? e.target.value : null })
                  }
                  className="ml-auto h-8 max-w-[140px] rounded-lg border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="">Unassigned</option>
                  {task.project.members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date Picker */}
            <div className="space-y-1.5 border-t border-border/20 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">Due Date</label>
                {isOverdue && (
                  <span className="rounded border border-rose-500/20 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                    Overdue
                  </span>
                )}
              </div>
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                onChange={(e) =>
                  patchMutation.mutate({ dueDate: e.target.value ? e.target.value : null })
                }
                className="h-8 w-full rounded-lg border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Hours Tracking */}
            <div className="grid grid-cols-2 gap-2 border-t border-border/20 pt-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Est. Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="1000"
                  placeholder="0.0"
                  defaultValue={task.estimatedHours ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    if (val !== task.estimatedHours) {
                      patchMutation.mutate({ estimatedHours: val });
                    }
                  }}
                  className="h-8 w-full rounded-lg border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Actual Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="1000"
                  placeholder="0.0"
                  defaultValue={task.actualHours ?? ""}
                  onBlur={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : null;
                    if (val !== task.actualHours) {
                      patchMutation.mutate({ actualHours: val });
                    }
                  }}
                  className="h-8 w-full rounded-lg border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Labels Editor */}
            <div className="space-y-2 border-t border-border/20 pt-2">
              <label className="block text-xs font-medium text-muted-foreground">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {workspaceLabels.map((lbl) => {
                  const isAttached = task.labels.some((l) => l.label.id === lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => handleToggleLabel(lbl.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
                        isAttached ? "shadow-xs font-semibold" : "opacity-40 hover:opacity-80"
                      )}
                      style={{
                        backgroundColor: isAttached ? `${lbl.color}25` : "transparent",
                        borderColor: isAttached ? lbl.color : "rgba(255,255,255,0.1)",
                        color: isAttached ? lbl.color : "inherit",
                      }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: lbl.color }}
                      />
                      {lbl.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
