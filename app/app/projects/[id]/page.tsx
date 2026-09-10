"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectRoleBadge, StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TaskActivityFeed, ActivityItem } from "@/components/features/tasks/TaskActivityFeed";

interface MemberItem {
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

interface ProjectDetail {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  visibility: string;
  color: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  members: MemberItem[];
  taskCounts: Record<string, number>;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  callerProjectRole: string | null;
  isLeadOrAdmin: boolean;
  health?: {
    score: number;
    status: "ON_TRACK" | "NEEDS_ATTENTION" | "AT_RISK";
    label: "On Track" | "Needs Attention" | "At Risk";
    color: string;
    badgeVariant: string;
    reasons: string[];
    breakdown: {
      overdueScore: number;
      workloadScore: number;
      velocityScore: number;
      activityScore: number;
      overdueCount: number;
      totalTasks: number;
      activeTasks: number;
      overduePercent: number;
      topAssigneeName: string | null;
      topAssigneeShare: number;
      recentCompletedCount: number;
      daysSinceLastActivity: number;
      statusPenalty: number;
    };
  };
}

interface WorkspaceMemberOption {
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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const projectId = params?.id as string;

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = React.useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = React.useState(false);

  // Form states for adding member
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState("MEMBER");

  // Form states for editing details
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editTargetDate, setEditTargetDate] = React.useState("");

  // Fetch project details
  const {
    data: projectData,
    isLoading: projectLoading,
    isError,
  } = useQuery<{ project: ProjectDetail }>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project details");
      const json = await res.json();
      return json.data;
    },
  });

  const project = projectData?.project;

  // Fetch all workspace members for member assignment
  const { data: wsMembersData } = useQuery<{ members: WorkspaceMemberOption[] }>({
    queryKey: ["workspaceMembers", project?.workspaceId],
    queryFn: async () => {
      if (!project?.workspaceId) return { members: [] };
      const res = await fetch(`/api/workspaces/${project.workspaceId}/invites?status=ACTIVE`);
      if (!res.ok) return { members: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: !!project?.workspaceId && addMemberDialogOpen,
  });

  // Fetch recent project activities
  const { data: projectActivitiesData } = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ["project-activity", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/activity`);
      if (!res.ok) return { activities: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(projectId),
  });
  const projectActivities = projectActivitiesData?.activities || [];

  // Populate edit form when opening
  React.useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || "");
      setEditTargetDate(project.targetEndDate ? project.targetEndDate.split("T")[0] : "");
    }
  }, [project, editDetailsOpen]);

  // Mutation to update project
  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update project");
      return json.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (variables.status) {
        toast.success("Status updated", `Project status changed to ${variables.status}`);
      } else {
        toast.success("Project updated", "Project settings successfully saved.");
        setEditDetailsOpen(false);
      }
    },
    onError: (err: Error) => {
      toast.error("Update failed", err.message);
    },
  });

  // Mutation to delete project
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to delete project");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted", "Project and associated resources were removed.");
      router.push("/app/projects");
    },
    onError: (err: Error) => {
      toast.error("Delete failed", err.message);
    },
  });

  // Mutation to add member
  const addMemberMutation = useMutation({
    mutationFn: async (payload: { userId: string; role: string }) => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to add member");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member added", "Teammate successfully assigned to project.");
      setAddMemberDialogOpen(false);
      setSelectedUserId("");
    },
    onError: (err: Error) => {
      toast.error("Add member failed", err.message);
    },
  });

  // Mutation to change member role
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to update role");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Role updated", "Member project role updated.");
    },
    onError: (err: Error) => {
      toast.error("Role update failed", err.message);
    },
  });

  // Mutation to remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to remove member");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Member removed", "Member removed from project.");
    },
    onError: (err: Error) => {
      toast.error("Remove failed", err.message);
    },
  });

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-32 rounded" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-12 text-center">
        <h2 className="text-lg font-bold text-foreground">Project Not Found</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          This project does not exist, or you lack authorization to view it.
        </p>
        <Link href="/app/projects">
          <Button variant="outline" size="sm">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  // Workspace members not yet assigned to this project
  const existingMemberIds = new Set(project.members.map((m) => m.userId));
  const availableWorkspaceMembers = (wsMembersData?.members || []).filter(
    (m) => !existingMemberIds.has(m.userId)
  );

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & navigation */}
      <div>
        <Link
          href="/app/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
          Back to Projects
        </Link>

        {/* Project Header Banner */}
        <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span
              className="h-4 w-4 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: project.color || "#6366f1" }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                  {project.key}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {project.name}
                </h1>
                {project.visibility === "PRIVATE" ? (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
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
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Public
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <select
                id="project-status-select"
                value={project.status}
                disabled={!project.isLeadOrAdmin || updateMutation.isPending}
                onChange={(e) => updateMutation.mutate({ status: e.target.value })}
                className="h-8 rounded-lg border border-input bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {/* Kanban Board Link */}
            <Link href={`/app/projects/${projectId}/board`}>
              <Button size="sm" className="gap-1.5 shadow-subtle">
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
                Kanban Board
              </Button>
            </Link>

            {/* Edit / Delete actions */}
            {project.isLeadOrAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditDetailsOpen(true)}>
                  Edit Settings
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Description & Task Status Summary */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description Card */}
          <Card className="space-y-3 p-6 border-border/60 bg-card/80 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Project Overview & Scope
              </h2>
              {project.isLeadOrAdmin && (
                <button
                  onClick={() => setEditDetailsOpen(true)}
                  className="text-xs text-primary hover:underline transition-colors duration-150"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description || "No description provided for this project."}
            </p>
          </Card>

          {/* Project Health & Operational Risk Assessment Card */}
          {project.health && (
            <Card className="space-y-5 p-6 border-border/60 bg-card/80 shadow-card">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      Project Health & Operational Risk
                    </h2>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Live Engine
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Multi-vector analysis across deadlines, velocity, workload, and activity
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-mono text-4xl font-extrabold tracking-tight tabular-nums ${
                        project.health.status === "AT_RISK"
                          ? "text-rose-400"
                          : project.health.status === "NEEDS_ATTENTION"
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {project.health.score}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">/100</span>
                  </div>

                  <span
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-xs ${
                      project.health.status === "AT_RISK"
                        ? "border-rose-500/30 bg-rose-500/15 text-rose-400"
                        : project.health.status === "NEEDS_ATTENTION"
                          ? "border-amber-500/30 bg-amber-500/15 text-amber-400"
                          : "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        project.health.status === "AT_RISK"
                          ? "motion-safe:animate-pulse bg-rose-400"
                          : project.health.status === "NEEDS_ATTENTION"
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      }`}
                    />
                    {project.health.label}
                  </span>
                </div>
              </div>

              {/* 4 Vector Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:bg-surface-nested">
                  <span className="text-[11px] font-medium text-muted-foreground">Overdue Burden</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {project.health.breakdown.overdueCount}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({project.health.breakdown.overduePercent}% active)
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-base/80">
                    <div
                      className={`h-full ${
                        project.health.breakdown.overduePercent > 25
                          ? "bg-rose-500"
                          : project.health.breakdown.overduePercent > 10
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, project.health.breakdown.overduePercent)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:bg-surface-nested">
                  <span className="text-[11px] font-medium text-muted-foreground">Workload Focus</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {Math.round(project.health.breakdown.topAssigneeShare * 100)}%
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground" title={project.health.breakdown.topAssigneeName || "None"}>
                      {project.health.breakdown.topAssigneeName ? project.health.breakdown.topAssigneeName.split(" ")[0] : "None"}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-base/80">
                    <div
                      className={`h-full ${
                        project.health.breakdown.topAssigneeShare > 0.6
                          ? "bg-rose-500"
                          : project.health.breakdown.topAssigneeShare > 0.4
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round(project.health.breakdown.topAssigneeShare * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:bg-surface-nested">
                  <span className="text-[11px] font-medium text-muted-foreground">14-Day Velocity</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {project.health.breakdown.recentCompletedCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground">tasks done</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-base/80">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, project.health.breakdown.recentCompletedCount * 25)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:bg-surface-nested">
                  <span className="text-[11px] font-medium text-muted-foreground">Last Activity</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold tracking-tight text-foreground">
                      {project.health.breakdown.daysSinceLastActivity === 0
                        ? "Today"
                        : `${project.health.breakdown.daysSinceLastActivity}d`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">ago</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-base/80">
                    <div
                      className={`h-full ${
                        project.health.breakdown.daysSinceLastActivity > 14
                          ? "bg-rose-500"
                          : project.health.breakdown.daysSinceLastActivity > 7
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.max(10, 100 - project.health.breakdown.daysSinceLastActivity * 7)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Honest Breakdown of Drivers / Why */}
              <div className="rounded-xl border border-border/50 bg-surface-nested/80 p-4 shadow-subtle">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Score Drivers & Operational Breakdown
                </h3>
                <ul className="space-y-1.5 text-xs text-foreground/90">
                  {project.health.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {/* Task Status & Progress Summary Card */}
          <Card className="space-y-5 p-6 border-border/60 bg-card/80 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Task Execution & Velocity
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Monotonic project-scoped task distribution
                </p>
              </div>
              <span className="rounded-md border border-border/50 bg-surface-nested px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                {project.doneTasks} of {project.totalTasks} Done ({project.progressPercent}%)
              </span>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-nested">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${project.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Task count by real status badges */}
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
              {[
                { status: "TODO", label: "To Do" },
                { status: "IN_PROGRESS", label: "In Progress" },
                { status: "IN_REVIEW", label: "In Review" },
                { status: "DONE", label: "Done" },
                { status: "BACKLOG", label: "Backlog" },
                { status: "CANCELLED", label: "Cancelled" },
              ].map(({ status }) => {
                const count = project.taskCounts[status] || 0;
                return (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-surface-nested/70 p-3 shadow-subtle transition-colors duration-150 hover:bg-surface-nested"
                  >
                    <StatusBadge status={status} />
                    <span className="font-mono text-sm font-bold tabular-nums text-foreground">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Task Board Coming Soon Banner */}
            <div className="flex items-center justify-between rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Interactive Kanban Board</p>
                  <p className="text-[11px] text-muted-foreground">
                    Drag and drop tasks across workflow stages with real-time status syncing.
                  </p>
                </div>
              </div>
              <Link href={`/app/projects/${projectId}/board`}>
                <Button size="sm" className="shadow-xs text-xs">
                  Open Board
                </Button>
              </Link>
            </div>
          </Card>

          {/* Aggregated Project Activity Feed */}
          <Card className="space-y-4 p-6 border-border/60 bg-card/80 shadow-card">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Project Activity Timeline
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recent actions, task transitions, and team contributions across this project
                </p>
              </div>
            </div>
            <TaskActivityFeed activities={projectActivities} showTaskReference />
          </Card>
        </div>

        {/* Right Column: Timeline & Team Members */}
        <div className="space-y-6">
          {/* Key Dates Card */}
          <Card className="space-y-3 p-5 border-border/60 bg-card/80 shadow-card">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Dates & Timeline
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-foreground">
                  {new Date(project.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Completion</span>
                <span className="font-medium text-foreground">
                  {project.targetEndDate
                    ? new Date(project.targetEndDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Not specified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created By</span>
                <span className="font-medium text-foreground">{project.owner.name}</span>
              </div>
            </div>
          </Card>

          {/* Members Management Card */}
          <Card className="space-y-4 p-5 border-border/60 bg-card/80 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Project Members ({project.members.length})
                </h3>
              </div>
              {project.isLeadOrAdmin && (
                <Button
                  id="add-project-member-button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAddMemberDialogOpen(true)}
                  className="h-7 px-2 text-xs transition-colors duration-150"
                >
                  + Add Member
                </Button>
              )}
            </div>

            <div className="space-y-2.5">
              {project.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-surface-nested/70 p-2.5 shadow-subtle transition-colors duration-150 hover:bg-surface-nested"
                >
                  <div className="flex min-w-0 items-center gap-2.5 pr-2">
                    <Avatar name={member.user.name} src={member.user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {member.user.name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {project.isLeadOrAdmin ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          changeRoleMutation.mutate({
                            userId: member.userId,
                            role: e.target.value,
                          })
                        }
                        className="h-6 rounded border border-input bg-card px-1.5 text-[10px] font-medium text-foreground transition-colors duration-150"
                      >
                        <option value="LEAD">Lead</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : (
                      <ProjectRoleBadge role={member.role} />
                    )}

                    {project.isLeadOrAdmin && (
                      <button
                        onClick={() => removeMemberMutation.mutate(member.userId)}
                        disabled={removeMemberMutation.isPending}
                        className="rounded p-1 text-muted-foreground transition-colors duration-150 hover:text-destructive"
                        title="Remove member"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Edit Settings Modal Dialog                                    */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={editDetailsOpen} onOpenChange={setEditDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project Settings</DialogTitle>
            <DialogDescription>
              Update name, description, and timeline for {project.name}.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                name: editName.trim(),
                description: editDescription.trim() || null,
                targetEndDate: editTargetDate || null,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Project Name</label>
              <Input required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Description</label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="flex w-full rounded-lg border border-input bg-card/60 px-3.5 py-2 text-sm text-foreground shadow-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-foreground">Target End Date</label>
              <Input
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDetailsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* Add Project Member Dialog                                     */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Project Member</DialogTitle>
            <DialogDescription>
              Select a teammate from this workspace to collaborate on {project.name}.
            </DialogDescription>
          </DialogHeader>

          {availableWorkspaceMembers.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              All active workspace members are already members of this project.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedUserId) return;
                addMemberMutation.mutate({
                  userId: selectedUserId,
                  role: selectedRole,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">
                  Select Workspace Member
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card/60 px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Choose a member...</option>
                  {availableWorkspaceMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.name} ({m.user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-foreground">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card/60 px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="MEMBER">Member (Contributor)</option>
                  <option value="LEAD">Lead (Manager)</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddMemberDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedUserId || addMemberMutation.isPending}
                  isLoading={addMemberMutation.isPending}
                >
                  Add to Project
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* Delete Confirmation Dialog                                    */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">{project.name}</strong>? This action cannot be
              undone and will delete all associated tasks and project records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
            >
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
