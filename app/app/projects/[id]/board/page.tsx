"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { TaskStatus } from "@prisma/client";
import { KanbanColumn } from "@/components/features/tasks/KanbanColumn";
import { TaskCard } from "@/components/features/tasks/TaskCard";
import { CreateTaskDialog } from "@/components/features/tasks/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { TaskItem } from "@/types/task";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { TaskFilterBar } from "@/components/features/filters/TaskFilterBar";
import { matchesDueDateFilter } from "@/lib/filter-utils";

interface ProjectDetail {
  id: string;
  name: string;
  key: string;
  workspaceId: string;
  color?: string | null;
  status: string;
  members: Array<{
    userId: string;
    role: string;
    user: { id: string; name: string; email: string };
  }>;
}

const COLUMNS: Array<{ status: TaskStatus; title: string; color: string }> = [
  { status: "BACKLOG", title: "Backlog", color: "#94a3b8" },
  { status: "TODO", title: "To Do", color: "#38bdf8" },
  { status: "IN_PROGRESS", title: "In Progress", color: "#f59e0b" },
  { status: "IN_REVIEW", title: "In Review", color: "#a855f7" },
  { status: "DONE", title: "Done", color: "#10b981" },
  { status: "CANCELLED", title: "Cancelled", color: "#f43f5e" },
];

export default function ProjectBoardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-[600px] w-80 shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <ProjectBoardContent />
    </React.Suspense>
  );
}

function ProjectBoardContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const queryClient = useQueryClient();
  const toast = useToast();

  // Dialog & state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [targetColumnStatus, setTargetColumnStatus] = React.useState<TaskStatus>("TODO");
  const [activeTask, setActiveTask] = React.useState<TaskItem | null>(null);

  // Horizontal scroll edge-fade tracking for Kanban columns
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollState = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  // Unified Search & Filter state synced with URL
  const {
    filters,
    searchInput,
    setSearchInput,
    setFilter,
    clearFilters,
    hasActiveFilters,
  } = useTaskFilters({ ignoreProject: true });

  // Fetch project details
  // isFetching covers background refetches (e.g. triggered by task creation invalidation)
  // so we never flash "Project Not Found" while the query is simply re-loading.
  const {
    data: projectData,
    isLoading: projectLoading,
    isFetching: projectFetching,
  } = useQuery<{ project: ProjectDetail }>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch project tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ tasks: TaskItem[] }>({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (!res.ok) throw new Error("Failed to load project tasks");
      const json = await res.json();
      return json.data;
    },
  });

  const project = projectData?.project;
  const allTasks = React.useMemo(() => tasksData?.tasks || [], [tasksData]);

  // Fetch workspace labels for label filter
  const { data: labelsData } = useQuery<{
    labels: Array<{ id: string; name: string; color: string }>;
  }>({
    queryKey: ["workspace-labels", project?.workspaceId],
    queryFn: async () => {
      if (!project?.workspaceId) return { labels: [] };
      const res = await fetch(`/api/workspaces/${project.workspaceId}/labels`);
      if (!res.ok) return { labels: [] };
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(project?.workspaceId),
  });

  // Client-side filtering reusing unified filter predicate
  const filteredTasks = React.useMemo(() => {
    return allTasks.filter((task) => {
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesKey = task.taskKey?.toLowerCase().includes(q) ?? false;
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesKey && !matchesDesc) return false;
      }
      if (filters.status !== "ALL" && task.status !== filters.status) {
        return false;
      }
      if (filters.priority !== "ALL" && task.priority !== filters.priority) {
        return false;
      }
      if (filters.assigneeId === "unassigned" && task.assigneeId) {
        return false;
      }
      if (
        filters.assigneeId !== "ALL" &&
        filters.assigneeId !== "unassigned" &&
        task.assigneeId !== filters.assigneeId
      ) {
        return false;
      }
      if (filters.labelId !== "ALL") {
        const hasLabel = task.labels?.some(
          (l: { label?: { id: string }; labelId?: string }) =>
            l.label?.id === filters.labelId || l.labelId === filters.labelId
        );
        if (!hasLabel) return false;
      }
      if (!matchesDueDateFilter(task.dueDate, filters.dueDate)) {
        return false;
      }
      return true;
    });
  }, [allTasks, filters]);

  // Group tasks by status
  const tasksByStatus = React.useMemo(() => {
    const grouped: Record<TaskStatus, TaskItem[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      CANCELLED: [],
    };

    filteredTasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    // Ensure within each column they are ordered by orderIndex asc
    Object.keys(grouped).forEach((statusKey) => {
      grouped[statusKey as TaskStatus].sort((a, b) => a.orderIndex - b.orderIndex);
    });

    return grouped;
  }, [filteredTasks]);

  // Configure DnD Sensors with a 5px movement threshold so clicking isn't captured as drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Measure horizontal scroll extent and toggle edge-fade gradients
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollState();
    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);
    const observer = new ResizeObserver(() => {
      updateScrollState();
    });
    observer.observe(el);
    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [updateScrollState, filteredTasks.length]);

  // Mutation for reordering
  const reorderMutation = useMutation({
    mutationFn: async ({
      taskId,
      status,
      orderIndex,
    }: {
      taskId: string;
      status: TaskStatus;
      orderIndex: number;
    }) => {
      const res = await fetch(`/api/tasks/${taskId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, orderIndex }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to persist reordering");
      return json.data;
    },
    onError: (err: Error, _vars, context: { previousTasks?: TaskItem[] } | undefined) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["project-tasks", projectId], { tasks: context.previousTasks });
      }
      toast.error("Reorder failed", err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = allTasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const currentActiveTask = allTasks.find((t) => t.id === activeId);
    if (!currentActiveTask) return;

    // Is over a column or another task?
    const isOverColumn = COLUMNS.some((c) => c.status === overId);
    const overTask = allTasks.find((t) => t.id === overId);

    const targetStatus = isOverColumn ? (overId as TaskStatus) : overTask ? overTask.status : null;

    if (!targetStatus || currentActiveTask.status === targetStatus) {
      return;
    }

    // Live update status in cache during drag over between columns
    queryClient.setQueryData<{ tasks: TaskItem[] }>(["project-tasks", projectId], (old) => {
      if (!old) return old;
      return {
        tasks: old.tasks.map((t) => (t.id === activeId ? { ...t, status: targetStatus } : t)),
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentTask = allTasks.find((t) => t.id === activeId);
    if (!currentTask) return;

    const isOverColumn = COLUMNS.some((c) => c.status === overId);
    const overTask = allTasks.find((t) => t.id === overId);

    const destinationStatus: TaskStatus = isOverColumn
      ? (overId as TaskStatus)
      : overTask
        ? overTask.status
        : currentTask.status;

    // Capture snapshot for rollback
    const previousTasks = queryClient.getQueryData<{ tasks: TaskItem[] }>([
      "project-tasks",
      projectId,
    ])?.tasks;

    // Compute updated order inside the destination column
    const columnItems = allTasks
      .filter((t) => t.status === destinationStatus && t.id !== activeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    let newOrderIndex = 1000;

    if (isOverColumn) {
      // Dropped onto empty column or column header -> append at end
      if (columnItems.length > 0) {
        newOrderIndex = columnItems[columnItems.length - 1].orderIndex + 1000;
      } else {
        newOrderIndex = 1000;
      }
    } else if (overTask) {
      const overIndex = columnItems.findIndex((t) => t.id === overId);
      if (overIndex === -1) {
        newOrderIndex = (columnItems[columnItems.length - 1]?.orderIndex ?? 0) + 1000;
      } else {
        // Place relative to overTask
        const prevItem = columnItems[overIndex - 1];
        const nextItem = columnItems[overIndex];

        if (!prevItem && nextItem) {
          // At the top
          newOrderIndex = Math.max(0, nextItem.orderIndex / 2);
        } else if (prevItem && nextItem) {
          // In between
          newOrderIndex = (prevItem.orderIndex + nextItem.orderIndex) / 2;
        } else {
          // At bottom
          newOrderIndex = (columnItems[columnItems.length - 1]?.orderIndex ?? 0) + 1000;
        }
      }
    }

    // Optimistic UI state update
    queryClient.setQueryData<{ tasks: TaskItem[] }>(["project-tasks", projectId], (old) => {
      if (!old) return old;
      const updated = old.tasks.map((t) => {
        if (t.id === activeId) {
          return {
            ...t,
            status: destinationStatus,
            orderIndex: newOrderIndex,
          };
        }
        return t;
      });
      return { tasks: updated };
    });

    // Fire API reorder request
    reorderMutation.mutate(
      {
        taskId: activeId,
        status: destinationStatus,
        orderIndex: newOrderIndex,
      },
      // @ts-expect-error context passing in mutation
      { context: { previousTasks } }
    );
  };

  const handleQuickAdd = (status: TaskStatus) => {
    setTargetColumnStatus(status);
    setCreateDialogOpen(true);
  };

  const handleTaskClick = (task: TaskItem) => {
    router.push(`/app/tasks/${task.id}`);
  };

  if (projectLoading || projectFetching || tasksLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-[600px] w-80 shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Only show not-found after all fetches are definitively settled with no data.
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-semibold text-foreground">Project Not Found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This project might have been moved, deleted, or requires different permissions.
        </p>
        <Link href="/app/projects" className="mt-4">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100vh-100px)] flex-col overflow-hidden p-4 sm:-mx-6 sm:-my-6 sm:p-6">
      {/* Board Top Navigation and Title Bar */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-border/40 pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Link
              href={`/app/projects/${projectId}`}
              className="shadow-xs inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              title="Back to Project Overview"
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
            </Link>

            <span
              className="shadow-xs h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color || "#6366f1" }}
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">
                  {project.key}
                </span>
                <h1 className="text-xl font-bold tracking-tight text-foreground">{project.name}</h1>
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  Board ({filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Create Task button */}
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              onClick={() => {
                setTargetColumnStatus("TODO");
                setCreateDialogOpen(true);
              }}
              className="gap-1.5 shadow-glow"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </Button>
          </div>
        </div>

        {/* Filter controls toolbar */}
        <TaskFilterBar
          filters={filters}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          members={project.members.map((m) => ({
            id: m.userId,
            name: m.user.name,
            email: m.user.email,
          }))}
          labels={labelsData?.labels ?? []}
          hideProjectFilter
          hideSort
          placeholder="Filter board tasks..."
        />
      </div>

      {/* No matching tasks filter notification banner */}
      {hasActiveFilters && filteredTasks.length === 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
          <span>No tasks in this board match the currently applied filters.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 hover:text-white"
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MOBILE VIEW (< md): Stacked accordion-style columns.       */}
      {/* Horizontal drag-and-drop is unusable on touch; instead,    */}
      {/* each card has an inline <select> to change its status.     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pt-4 md:hidden">
        <MobileKanbanView
          columns={COLUMNS}
          tasksByStatus={tasksByStatus}
          onTaskClick={handleTaskClick}
          onQuickAdd={handleQuickAdd}
          onStatusChange={(taskId, newStatus) =>
            reorderMutation.mutate({ taskId, status: newStatus, orderIndex: 1000 })
          }
        />
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* DESKTOP VIEW (≥ md): Full horizontal DnD Kanban board.     */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="relative hidden flex-1 min-h-0 md:flex md:flex-col">
        {/* Left edge-fade gradient affordance */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 bottom-2 z-20 w-14 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity duration-200 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Right edge-fade gradient affordance */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute right-0 top-0 bottom-2 z-20 w-14 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity duration-200 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          className="flex-1 overflow-x-auto overflow-y-hidden pb-2 pt-4"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full min-w-max gap-4 pb-2">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.status}
                  status={col.status}
                  title={col.title}
                  colorDot={col.color}
                  tasks={tasksByStatus[col.status] || []}
                  onTaskClick={handleTaskClick}
                  onQuickAdd={handleQuickAdd}
                />
              ))}
            </div>

            {/* Drag Overlay — rotation only when user has no motion preference */}
            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Quick Task Creation Dialog */}
      <CreateTaskDialog
        projectId={projectId}
        workspaceId={project.workspaceId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultStatus={targetColumnStatus}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MobileKanbanView
// Renders a stacked, touch-friendly alternative to horizontal DnD Kanban.
// Each status group is a collapsible section; each card has an inline
// <select> allowing status changes without drag-and-drop.
// ─────────────────────────────────────────────────────────────────────────────

interface MobileKanbanViewProps {
  columns: Array<{ status: TaskStatus; title: string; color: string }>;
  tasksByStatus: Record<TaskStatus, TaskItem[]>;
  onTaskClick: (task: TaskItem) => void;
  onQuickAdd: (status: TaskStatus) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

function MobileKanbanView({
  columns,
  tasksByStatus,
  onTaskClick,
  onQuickAdd,
  onStatusChange,
}: MobileKanbanViewProps) {
  // Default: open columns that have tasks; collapse empty ones
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach((col) => {
      init[col.status] = (tasksByStatus[col.status]?.length ?? 0) > 0;
    });
    return init;
  });

  const toggle = (status: string) =>
    setOpenGroups((prev) => ({ ...prev, [status]: !prev[status] }));

  return (
    <div className="space-y-3 pb-20">
      {columns.map((col) => {
        const tasks = tasksByStatus[col.status] ?? [];
        const isOpen = openGroups[col.status];

        return (
          <div
            key={col.status}
            className="overflow-hidden rounded-xl border border-border/50 bg-card/40 backdrop-blur-md"
          >
            {/* Column Header — tap to expand/collapse */}
            <button
              type="button"
              onClick={() => toggle(col.status)}
              aria-expanded={isOpen}
              aria-controls={`mobile-col-${col.status}`}
              className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-foreground">{col.title}</span>
                <span className="inline-flex items-center justify-center rounded-full border border-border/40 bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {tasks.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Quick add button */}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(col.status);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onQuickAdd(col.status);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Add task to ${col.title}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </span>

                {/* Chevron */}
                <svg
                  className={`h-4 w-4 text-muted-foreground transition-transform motion-safe:duration-200 ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Task list — conditionally rendered */}
            {isOpen && (
              <div
                id={`mobile-col-${col.status}`}
                className="divide-y divide-border/20 border-t border-border/30"
              >
                {tasks.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-muted-foreground">
                    No tasks in this column
                  </div>
                ) : (
                  tasks.map((task) => (
                    <MobileTaskRow
                      key={task.id}
                      task={task}
                      columns={columns}
                      onTaskClick={onTaskClick}
                      onStatusChange={onStatusChange}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Individual task row for mobile view with inline status select
interface MobileTaskRowProps {
  task: TaskItem;
  columns: Array<{ status: TaskStatus; title: string; color: string }>;
  onTaskClick: (task: TaskItem) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

function MobileTaskRow({ task, columns, onTaskClick, onStatusChange }: MobileTaskRowProps) {
  const isOverdue = React.useMemo(() => {
    if (!task.dueDate || task.status === "DONE" || task.status === "CANCELLED") return false;
    return new Date(task.dueDate).getTime() < Date.now();
  }, [task.dueDate, task.status]);

  return (
    <div className="group flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
      {/* Main content — tappable to open detail */}
      <button
        type="button"
        onClick={() => onTaskClick(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        aria-label={`Open task: ${task.title}`}
      >
        <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground/80">
          {task.taskKey || `#${task.taskNumber}`}
        </span>
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
          {task.title}
        </span>
        {task.dueDate && (
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              isOverdue
                ? "border-rose-500/30 bg-rose-500/15 text-rose-400"
                : "border-border/50 bg-secondary text-muted-foreground"
            }`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isOverdue && <span className="sr-only">Overdue: </span>}
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </button>

      {/* Inline status picker — the mobile alternative to drag-and-drop */}
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <label htmlFor={`status-${task.id}`} className="sr-only">
          Change status for {task.title}
        </label>
        <select
          id={`status-${task.id}`}
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          onClick={(e) => e.stopPropagation()}
          className="h-7 rounded-lg border border-border/60 bg-card px-2 text-[10px] font-medium text-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {columns.map((col) => (
            <option key={col.status} value={col.status}>
              {col.title}
            </option>
          ))}
        </select>

        {task.assignee && (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary ring-1 ring-primary/30"
            title={task.assignee.name}
            aria-label={`Assigned to ${task.assignee.name}`}
          >
            {task.assignee.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
