"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectMemberUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface DashboardProject {
  id: string;
  name: string;
  key: string;
  color: string | null;
  status: string;
  visibility: string;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  overdueCount: number;
  isAtRisk: boolean;
  targetEndDate: string | null;
  members: { user: ProjectMemberUser }[];
  health?: {
    score: number;
    status: "ON_TRACK" | "NEEDS_ATTENTION" | "AT_RISK";
    label: "On Track" | "Needs Attention" | "At Risk";
    color: string;
    badgeVariant: string;
    reasons: string[];
    breakdown?: {
      overduePercent: number;
      topAssigneeName: string | null;
      topAssigneeShare: number;
    };
  };
}

interface ProjectsSectionProps {
  workspaceId: string;
  userId: string;
}

export function ProjectsSection({ workspaceId, userId }: ProjectsSectionProps) {
  const { data, isLoading, isError } = useQuery<{ projects: DashboardProject[] }>({
    queryKey: ["dashboard", userId, "projects", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/projects`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60_000,
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Active Projects</h2>
        <Link
          href="/app/projects"
          className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
        >
          All projects →
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-xs text-destructive">
          Failed to load projects. Try refreshing.
        </p>
      ) : !data?.projects.length ? (
        <div className="rounded-xl border border-border/40 bg-card/40 py-10 text-center">
          <p className="text-sm text-muted-foreground">No active projects in this workspace.</p>
          <Link
            href="/app/projects"
            className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
          >
            Create your first project →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: DashboardProject }) {
  const accentColor = project.color ?? "#6366f1";

  const formattedDeadline = React.useMemo(() => {
    if (!project.targetEndDate) return null;
    return new Date(project.targetEndDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, [project.targetEndDate]);

  const health = project.health;
  const healthBadgeStyle = React.useMemo(() => {
    if (!health) {
      if (project.isAtRisk) {
        return "border-amber-500/30 bg-amber-500/15 text-amber-400";
      }
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-400";
    }
    switch (health.status) {
      case "AT_RISK":
        return "border-rose-500/30 bg-rose-500/15 text-rose-400";
      case "NEEDS_ATTENTION":
        return "border-amber-500/30 bg-amber-500/15 text-amber-400";
      case "ON_TRACK":
      default:
        return "border-emerald-500/30 bg-emerald-500/15 text-emerald-400";
    }
  }, [health, project.isAtRisk]);

  return (
    <Link
      href={`/app/projects/${project.id}`}
      className="group relative flex flex-col gap-3.5 overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-card backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover"
    >
      {/* Accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 transition-all duration-150 group-hover:h-1"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground/75 transition-colors group-hover:text-primary">
            {project.key}
          </span>
          <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary/95">
            {project.name}
          </h3>
        </div>

        {/* Real computed health score badge */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-xs ${healthBadgeStyle}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                health?.status === "AT_RISK"
                  ? "motion-safe:animate-pulse bg-rose-400"
                  : health?.status === "NEEDS_ATTENTION"
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
            {health?.label || (project.isAtRisk ? "At Risk" : "On Track")}
            {health && (
              <span className="font-mono font-bold opacity-80">· {health.score}</span>
            )}
          </span>
          {project.status === "ON_HOLD" && (
            <span className="rounded border border-border/50 bg-secondary/60 px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
              On Hold
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground/80">
            {project.doneTasks}/{project.totalTasks} tasks
          </span>
          <span className="font-mono font-semibold text-foreground">
            {project.progressPercent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${project.progressPercent}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>
      </div>

      {/* Honest Driver Reason / Why */}
      {health?.reasons && health.reasons.length > 0 && (
        <div className="rounded-md border border-border/40 bg-surface-nested/70 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          <p className="line-clamp-1 flex items-center gap-1.5">
            <span className="h-1 w-1 shrink-0 rounded-full bg-primary/70" />
            <span>{health.reasons[0]}</span>
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Member avatars cluster */}
        <div className="flex -space-x-1.5">
          {project.members.slice(0, 4).map(({ user }) => (
            <Avatar
              key={user.id}
              name={user.name}
              src={user.avatarUrl}
              size="xs"
              className="ring-1 ring-card"
            />
          ))}
          {project.members.length > 4 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[9px] font-semibold text-muted-foreground ring-1 ring-card">
              +{project.members.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Overdue count */}
          {project.overdueCount > 0 && (
            <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
              {project.overdueCount} overdue
            </span>
          )}
          {/* Deadline */}
          {formattedDeadline && (
            <span className="text-[10px] text-muted-foreground/60">Due {formattedDeadline}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
