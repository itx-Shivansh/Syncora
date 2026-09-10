"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStatsBarProps {
  workspaceId: string;
  userId: string;
}

/**
 * A compact KPI bar just below the greeting, fetching three real numbers:
 * - My active tasks count
 * - My overdue tasks count  
 * - Active projects count
 *
 * These are derived client-side from the my-tasks and projects responses
 * to avoid an extra round-trip.
 */
export function DashboardStatsBar({ workspaceId, userId }: DashboardStatsBarProps) {
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{
    tasks: Array<{ isOverdue: boolean }>;
    total: number;
  }>({
    queryKey: ["dashboard", userId, "my-tasks", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/my-tasks`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data;
    },
    staleTime: 30_000,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{
    projects: Array<{ isAtRisk: boolean }>;
  }>({
    queryKey: ["dashboard", userId, "projects", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/${workspaceId}/projects`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60_000,
  });

  const myTaskTotal = tasksData?.total ?? 0;
  const overdueCount = tasksData?.tasks.filter((t) => t.isOverdue).length ?? 0;
  const atRiskProjects = projectsData?.projects.filter((p) => p.isAtRisk).length ?? 0;
  const activeProjects = projectsData?.projects.length ?? 0;

  const stats = [
    {
      label: "Active tasks",
      value: myTaskTotal,
      isLoading: tasksLoading,
      href: "/app/tasks",
      accent: false,
    },
    {
      label: "Overdue",
      value: overdueCount,
      isLoading: tasksLoading,
      href: "/app/tasks",
      accent: overdueCount > 0,
      accentClass: "text-rose-400",
    },
    {
      label: "Active projects",
      value: activeProjects,
      isLoading: projectsLoading,
      href: "/app/projects",
      accent: false,
    },
    {
      label: "At risk",
      value: atRiskProjects,
      isLoading: projectsLoading,
      href: "/app/projects",
      accent: atRiskProjects > 0,
      accentClass: "text-amber-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card/75 p-4 shadow-card backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-card-hover"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
            {stat.label}
          </span>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            {stat.isLoading ? (
              <Skeleton className="h-8 w-12 rounded" />
            ) : (
              <span
                className={`font-mono text-3xl font-extrabold tracking-tight tabular-nums leading-none ${
                  stat.accent && stat.accentClass ? stat.accentClass : "text-foreground"
                }`}
              >
                {stat.value}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
