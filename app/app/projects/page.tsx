"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deriveProjectKey } from "@/lib/validation";
import { useProjectFilters } from "@/hooks/use-project-filters";
import { ProjectFilterBar } from "@/components/features/filters/ProjectFilterBar";
import { NoSearchResults } from "@/components/features/filters/NoSearchResults";

interface ProjectMemberItem {
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

interface ProjectItem {
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
  members: ProjectMemberItem[];
  totalTasks: number;
  doneTasks: number;
  progressPercent: number;
  _count: {
    members: number;
    tasks: number;
  };
}

interface ActiveWorkspacesResponse {
  hasWorkspaces: boolean;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}

export default function ProjectsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <ProjectsPageContent />
    </React.Suspense>
  );
}

function ProjectsPageContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [visibility, setVisibility] = React.useState("PUBLIC_TO_WORKSPACE");
  const [targetEndDate, setTargetEndDate] = React.useState("");
  const [color, setColor] = React.useState("#6366f1");
  const [formError, setFormError] = React.useState<string | null>(null);

  // Fetch active workspaces to find current workspace ID
  const { data: wsData, isLoading: wsLoading } = useQuery<ActiveWorkspacesResponse>({
    queryKey: ["activeWorkspaces"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces/active");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      const json = await res.json();
      return json.data;
    },
  });

  const activeWorkspace = wsData?.workspaces?.[0];
  const workspaceId = activeWorkspace?.id;

  // Auto-generate key from name if not manually edited
  React.useEffect(() => {
    if (!keyTouched && name.trim()) {
      setKey(deriveProjectKey(name));
    }
  }, [name, keyTouched]);

  // Fetch projects for active workspace
  const {
    data: projectsData,
    isLoading: projectsLoading,
    isError,
  } = useQuery<{ projects: ProjectItem[] }>({
    queryKey: ["projects", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { projects: [] };
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      const json = await res.json();
      return json.data;
    },
    enabled: !!workspaceId,
  });

  // Mutation to create a project
  const createMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      if (!workspaceId) throw new Error("No active workspace");
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create project");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      toast.success("Project created", `Successfully initialized ${name}.`);
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error("Creation failed", err.message);
    },
  });

  const resetForm = () => {
    setName("");
    setKey("");
    setKeyTouched(false);
    setDescription("");
    setStatus("ACTIVE");
    setVisibility("PUBLIC_TO_WORKSPACE");
    setTargetEndDate("");
    setColor("#6366f1");
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }
    setFormError(null);
    createMutation.mutate({
      name: name.trim(),
      key: key.trim().toUpperCase() || undefined,
      description: description.trim() || undefined,
      status,
      visibility,
      targetEndDate: targetEndDate || undefined,
      color: color || undefined,
    });
  };

  const {
    filters,
    searchInput,
    setSearchInput,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useProjectFilters();

  const projects = React.useMemo(() => projectsData?.projects ?? [], [projectsData]);
  const isLoading = wsLoading || projectsLoading;

  // Client-side combinable filtering and sorting
  const filteredProjects = React.useMemo(() => {
    const list = projects.filter((p) => {
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesKey = p.key.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q) ?? false;
        if (!matchesName && !matchesKey && !matchesDesc) return false;
      }
      if (filters.status !== "ALL" && p.status !== filters.status) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (filters.sort === "name") {
        return filters.order === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (filters.sort === "progressPercent") {
        return filters.order === "asc"
          ? a.progressPercent - b.progressPercent
          : b.progressPercent - a.progressPercent;
      }
      if (filters.sort === "updatedAt") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return filters.order === "asc" ? dateA - dateB : dateB - dateA;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return filters.order === "asc" ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [projects, filters]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {activeWorkspace?.name || "Workspace"}
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Initiatives, repositories, and strategic engineering streams.
          </p>
        </div>

        <Button
          id="new-project-button"
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
          size="sm"
          className="shadow-glow"
        >
          <svg
            className="mr-1.5 h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Button>
      </div>

      {/* Project Filter Toolbar */}
      <ProjectFilterBar
        filters={filters}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Projects Grid / States */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} glass className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Failed to load workspace projects.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] })}
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      ) : projects.length === 0 ? (
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
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          }
          title="No projects in this workspace"
          description="Projects represent initiatives, repositories, or product roadmaps. Create your first project to start organizing team tasks."
          action={
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
          }
        />
      ) : filteredProjects.length === 0 ? (
        <NoSearchResults onClearFilters={clearFilters} searchTerm={filters.search} />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}`} className="group block">
              <Card
                className="flex h-full flex-col justify-between p-5 border-border/60 bg-card/80 shadow-card transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-card group-hover:shadow-card-hover"
              >
                <div>
                  {/* Top row: Key + Status + Visibility */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color || "#6366f1" }}
                      />
                      <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {project.key}
                      </span>
                      {project.visibility === "PRIVATE" && (
                        <span className="text-muted-foreground/70" title="Private project">
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
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>

                  {/* Title & Description */}
                  <CardTitle className="truncate text-base font-semibold tracking-tight text-foreground transition-colors duration-150 group-hover:text-primary">
                    {project.name}
                  </CardTitle>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {project.description || "No project description provided."}
                  </p>
                </div>

                <div className="mt-5 space-y-3 border-t border-border/40 pt-4">
                  {/* Task Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Task Completion</span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {project.progressPercent}% ({project.doneTasks}/{project.totalTasks})
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-nested">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom footer: Members & Target Date */}
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center -space-x-1.5">
                      {project.members.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.id}
                          name={m.user.name}
                          src={m.user.avatarUrl}
                          size="sm"
                          className="border-2 border-card ring-1 ring-background"
                        />
                      ))}
                      {project.members.length > 4 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-foreground">
                          +{project.members.length - 4}
                        </div>
                      )}
                    </div>

                    {project.targetEndDate ? (
                      <span className="text-[11px]">
                        Due{" "}
                        {new Date(project.targetEndDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60">No due date</span>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Create Project Modal Dialog                                   */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Initialize a dedicated initiative within {activeWorkspace?.name || "your workspace"}.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4" id="create-project-form">
            <div className="space-y-1.5">
              <label htmlFor="project-name" className="block text-xs font-medium text-foreground">
                Project Name *
              </label>
              <Input
                id="project-name"
                required
                placeholder="Core Platform Revamp"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="project-key" className="block text-xs font-medium text-foreground">
                  Key (Prefix) *
                </label>
                <Input
                  id="project-key"
                  required
                  placeholder="CORE"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value.toUpperCase());
                    setKeyTouched(true);
                  }}
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-color"
                  className="block text-xs font-medium text-foreground"
                >
                  Color Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="project-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-card/60 p-1"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{color}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="project-description"
                className="block text-xs font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="project-description"
                rows={3}
                placeholder="Objectives, deliverables, and scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-lg border border-input bg-card/60 px-3.5 py-2 text-sm text-foreground shadow-subtle placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="project-status"
                  className="block text-xs font-medium text-foreground"
                >
                  Initial Status
                </label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card/60 px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-visibility"
                  className="block text-xs font-medium text-foreground"
                >
                  Visibility
                </label>
                <select
                  id="project-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-card/60 px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="PUBLIC_TO_WORKSPACE">Public to Workspace</option>
                  <option value="PRIVATE">Private (Members Only)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="project-target-date"
                className="block text-xs font-medium text-foreground"
              >
                Target End Date
              </label>
              <Input
                id="project-target-date"
                type="date"
                value={targetEndDate}
                onChange={(e) => setTargetEndDate(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                id="submit-create-project"
                disabled={createMutation.isPending || !name.trim()}
                isLoading={createMutation.isPending}
              >
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
