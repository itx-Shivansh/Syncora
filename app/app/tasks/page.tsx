"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectStatusBadge } from "@/components/ui/badge";

interface ProjectItem {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: string;
  color: string | null;
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  _count: {
    tasks: number;
    members: number;
  };
}

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export default function TasksPage() {
  // Fetch user workspaces
  const { data: wsData, isLoading: wsLoading } = useQuery<{ workspaces: WorkspaceItem[] }>({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces");
      const json = await res.json();
      return json.data;
    },
  });

  const activeWorkspace = wsData?.workspaces?.[0];

  // Fetch projects in active workspace
  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ projects: ProjectItem[] }>({
    queryKey: ["workspace-projects", activeWorkspace?.id],
    queryFn: async () => {
      if (!activeWorkspace?.id) return { projects: [] };
      const res = await fetch(`/api/workspaces/${activeWorkspace.id}/projects`);
      if (!res.ok) throw new Error("Failed to load projects");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(activeWorkspace?.id),
  });

  const projects = projectsData?.projects || [];

  if (wsLoading || (activeWorkspace && projectsLoading)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div>
            <Skeleton className="mb-2 h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Task Boards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a project to manage work across interactive Kanban boards.
          </p>
        </div>
      </div>

      {/* Projects Kanban Directory */}
      {projects.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-6 w-6"
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
          }
          title="No projects available"
          description="Create a project first to start planning, organizing, and tracking tasks on interactive Kanban boards."
          action={
            <Link href="/app/projects">
              <Button size="sm">Go to Projects</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="group flex flex-col justify-between bg-card/60 p-5 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-card"
            >
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="shadow-xs h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color || "#6366f1" }}
                    />
                    <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                      {project.key}
                    </span>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>

                <h3 className="line-clamp-1 text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                  {project.name}
                </h3>

                {project.description && (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {project.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mt-4 border-t border-border/40 pt-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Task Progress</span>
                    <span className="font-medium text-foreground">
                      {project.doneTasks} / {project.totalTasks} ({project.progressPercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${project.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/30 pt-3">
                <span className="text-xs text-muted-foreground">
                  {project._count.tasks} total {project._count.tasks === 1 ? "task" : "tasks"}
                </span>
                <Link href={`/app/projects/${project.id}/board`}>
                  <Button
                    size="sm"
                    className="gap-1.5 shadow-subtle group-hover:bg-primary group-hover:text-primary-foreground"
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
                        d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                      />
                    </svg>
                    Open Board
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
