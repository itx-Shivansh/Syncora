"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge, ProjectStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { TaskFilterBar } from "@/components/features/filters/TaskFilterBar";
import { NoSearchResults } from "@/components/features/filters/NoSearchResults";
import { serializeTaskFiltersToParams } from "@/lib/filter-utils";
import { cn } from "@/lib/utils";

interface SearchTaskItem {
  id: string;
  taskNumber: number;
  taskKey: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    key: string;
    color: string | null;
    visibility: string;
  };
  assignee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  labels: Array<{
    label: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  _count: {
    comments: number;
    subTasks: number;
  };
}

interface SearchProjectItem {
  id: string;
  name: string;
  key: string;
  color: string | null;
  status: string;
  visibility: string;
  _count: {
    tasks: number;
    members: number;
  };
}

interface SearchResponse {
  tasks: SearchTaskItem[];
  projects: SearchProjectItem[];
  total: number;
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  );
}

function SearchContent() {
  const {
    filters,
    searchInput,
    setSearchInput,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useTaskFilters();

  // 1. Fetch active workspace
  const { data: wsData, isLoading: wsLoading } = useQuery<{
    workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
  }>({
    queryKey: ["activeWorkspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces/active");
      if (!res.ok) throw new Error("Failed to load workspace");
      const json = await res.json();
      return json.data;
    },
  });

  const activeWorkspace = wsData?.workspaces?.[0];
  const workspaceId = activeWorkspace?.id;

  // 2. Fetch projects for dropdown
  const { data: projectsData } = useQuery<{
    projects: Array<{ id: string; name: string; key: string }>;
  }>({
    queryKey: ["projects-dropdown", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { projects: [] };
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (!res.ok) return { projects: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(workspaceId),
  });

  // 3. Fetch labels for dropdown
  const { data: labelsData } = useQuery<{
    labels: Array<{ id: string; name: string; color: string }>;
  }>({
    queryKey: ["labels-dropdown", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { labels: [] };
      const res = await fetch(`/api/workspaces/${workspaceId}/labels`);
      if (!res.ok) return { labels: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(workspaceId),
  });

  // Serialize filter parameters for backend request
  const queryParams = React.useMemo(() => {
    return serializeTaskFiltersToParams(filters).toString();
  }, [filters]);

  // 4. Execute search query across workspace tasks and projects
  const { data: searchData, isLoading: searchLoading, isError } = useQuery<SearchResponse>({
    queryKey: ["workspace-search", workspaceId, queryParams],
    queryFn: async () => {
      if (!workspaceId) return { tasks: [], projects: [], total: 0 };
      const url = `/api/workspaces/${workspaceId}/tasks/search${queryParams ? `?${queryParams}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Search request failed");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(workspaceId),
  });

  const tasks = searchData?.tasks ?? [];
  const matchingProjects = searchData?.projects ?? [];
  const total = searchData?.total ?? 0;
  const isLoading = wsLoading || searchLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border/40 pb-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {activeWorkspace?.name || "Workspace"}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">Search & Discovery</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Workspace Search
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Find tasks, initiatives, and projects across the entire workspace using combinable
          filters. Share this exact view using your browser URL.
        </p>
      </div>

      {/* TaskFilterBar */}
      <Card className="p-4 border-border/60 bg-card/80 shadow-card">
        <TaskFilterBar
          filters={filters}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          projects={projectsData?.projects ?? []}
          labels={labelsData?.labels ?? []}
          placeholder="Search by title, description, or key (e.g. CORE-1)..."
        />
      </Card>

      {/* Results Area */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Failed to perform workspace search.</p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
            Reset Filters
          </Button>
        </div>
      ) : tasks.length === 0 && matchingProjects.length === 0 ? (
        hasActiveFilters ? (
          <NoSearchResults onClearFilters={clearFilters} searchTerm={filters.search} />
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-12 text-center backdrop-blur-xs">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-foreground">Ready to search</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Type keywords or choose filters above to locate tasks and projects across this workspace.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {/* Matching Projects Section (if query matches projects) */}
          {matchingProjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Matching Projects ({matchingProjects.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchingProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/app/projects/${p.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card/75 p-4 shadow-subtle transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-card"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                          {p.key}
                        </span>
                        <ProjectStatusBadge
                          status={p.status as Parameters<typeof ProjectStatusBadge>[0]["status"]}
                        />
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                        {p.name}
                      </h3>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{p._count.tasks} tasks</span>
                      <span>{p._count.members} members</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tasks ({total})
              </span>
              <span className="text-xs text-muted-foreground">
                Showing {tasks.length} result{tasks.length !== 1 ? "s" : ""}
              </span>
            </div>

            {tasks.length === 0 ? (
              <NoSearchResults onClearFilters={clearFilters} searchTerm={filters.search} />
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <SearchResultRow key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResultRow({ task }: { task: SearchTaskItem }) {
  const isOverdue = React.useMemo(() => {
    if (!task.dueDate) return false;
    return (
      new Date(task.dueDate).getTime() < Date.now() &&
      task.status !== "DONE" &&
      task.status !== "CANCELLED"
    );
  }, [task.dueDate, task.status]);

  const formattedDue = React.useMemo(() => {
    if (!task.dueDate) return null;
    return new Date(task.dueDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [task.dueDate]);

  return (
    <Link
      href={`/app/tasks/${task.id}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-border/50 bg-surface-nested/70 p-3.5 shadow-subtle transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-nested hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Left info */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <StatusBadge status={task.status as Parameters<typeof StatusBadge>[0]["status"]} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground/80 transition-colors duration-150 group-hover:text-primary">
              {task.taskKey}
            </span>
            <PriorityBadge
              priority={task.priority as Parameters<typeof PriorityBadge>[0]["priority"]}
            />
            {/* Project chip */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {task.project.color && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: task.project.color }}
                />
              )}
              {task.project.name}
            </span>
          </div>

          <h3 className="mt-1 line-clamp-1 text-sm font-medium text-foreground transition-colors duration-150 group-hover:text-primary">
            {task.title}
          </h3>

          {task.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}

          {/* Labels: muted pill treatment */}
          {task.labels && task.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        </div>
      </div>

      {/* Right meta */}
      <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
        {/* Due date */}
        {formattedDue && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              isOverdue
                ? "motion-safe:animate-pulse border-rose-500/30 bg-rose-500/15 font-semibold text-rose-400"
                : "border-border/40 bg-secondary text-muted-foreground"
            )}
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
            {isOverdue ? "Overdue: " : "Due: "}
            {formattedDue}
          </span>
        )}

        {/* Assignee */}
        {task.assignee ? (
          <div className="flex items-center gap-1.5" title={`Assigned to ${task.assignee.name}`}>
            <Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />
            <span className="hidden text-xs text-muted-foreground lg:inline">
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground/60">Unassigned</span>
        )}
      </div>
    </Link>
  );
}
