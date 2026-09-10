export type DueDateFilter = "all" | "overdue" | "this-week" | "no-due-date";
export type TaskSortField = "dueDate" | "priority" | "updatedAt" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface TaskFilterState {
  search: string;
  status: string; // "ALL" or single/comma-separated TaskStatus
  priority: string; // "ALL" or single/comma-separated TaskPriority
  assigneeId: string; // "ALL" or user UUID
  projectId: string; // "ALL" or project UUID
  labelId: string; // "ALL" or label UUID
  dueDate: DueDateFilter;
  sort: TaskSortField;
  order: SortOrder;
}

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  search: "",
  status: "ALL",
  priority: "ALL",
  assigneeId: "ALL",
  projectId: "ALL",
  labelId: "ALL",
  dueDate: "all",
  sort: "createdAt",
  order: "desc",
};

export interface ProjectFilterState {
  search: string;
  status: string; // "ALL" or ProjectStatus
  sort: "name" | "createdAt" | "updatedAt" | "progressPercent";
  order: SortOrder;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilterState = {
  search: "",
  status: "ALL",
  sort: "createdAt",
  order: "desc",
};

/**
 * Parses TaskFilterState from URLSearchParams or a query object.
 */
export function parseTaskFiltersFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): TaskFilterState {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const val = params[key];
    if (Array.isArray(val)) return val[0] ?? null;
    return val ?? null;
  };

  const search = get("search") || get("q") || "";
  const status = get("status") || "ALL";
  const priority = get("priority") || "ALL";
  const assigneeId = get("assigneeId") || "ALL";
  const projectId = get("projectId") || "ALL";
  const labelId = get("labelId") || "ALL";

  const rawDueDate = get("dueDate");
  const dueDate: DueDateFilter =
    rawDueDate === "overdue" || rawDueDate === "this-week" || rawDueDate === "no-due-date"
      ? rawDueDate
      : "all";

  const rawSort = get("sort");
  const sort: TaskSortField =
    rawSort === "dueDate" ||
    rawSort === "priority" ||
    rawSort === "updatedAt" ||
    rawSort === "createdAt"
      ? rawSort
      : "createdAt";

  const rawOrder = get("order");
  const order: SortOrder = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : "desc";

  return {
    search,
    status,
    priority,
    assigneeId,
    projectId,
    labelId,
    dueDate,
    sort,
    order,
  };
}

/**
 * Serializes TaskFilterState into clean URLSearchParams (omitting defaults).
 */
export function serializeTaskFiltersToParams(filters: TaskFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.priority && filters.priority !== "ALL") params.set("priority", filters.priority);
  if (filters.assigneeId && filters.assigneeId !== "ALL")
    params.set("assigneeId", filters.assigneeId);
  if (filters.projectId && filters.projectId !== "ALL") params.set("projectId", filters.projectId);
  if (filters.labelId && filters.labelId !== "ALL") params.set("labelId", filters.labelId);
  if (filters.dueDate && filters.dueDate !== "all") params.set("dueDate", filters.dueDate);
  if (filters.sort && filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.order && filters.order !== "desc") params.set("order", filters.order);

  return params;
}

/**
 * Returns true if any non-default task filter is currently applied.
 */
export function hasActiveTaskFilters(
  filters: TaskFilterState,
  options?: { ignoreProject?: boolean }
): boolean {
  if (filters.search.trim().length > 0) return true;
  if (filters.status !== "ALL") return true;
  if (filters.priority !== "ALL") return true;
  if (filters.assigneeId !== "ALL") return true;
  if (!options?.ignoreProject && filters.projectId !== "ALL") return true;
  if (filters.labelId !== "ALL") return true;
  if (filters.dueDate !== "all") return true;
  return false;
}

/**
 * Parses ProjectFilterState from URLSearchParams.
 */
export function parseProjectFiltersFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): ProjectFilterState {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const val = params[key];
    if (Array.isArray(val)) return val[0] ?? null;
    return val ?? null;
  };

  const search = get("search") || get("q") || "";
  const status = get("status") || "ALL";

  const rawSort = get("sort");
  const sort =
    rawSort === "name" ||
    rawSort === "createdAt" ||
    rawSort === "updatedAt" ||
    rawSort === "progressPercent"
      ? rawSort
      : "createdAt";

  const rawOrder = get("order");
  const order: SortOrder = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : "desc";

  return { search, status, sort, order };
}

/**
 * Serializes ProjectFilterState into URLSearchParams.
 */
export function serializeProjectFiltersToParams(filters: ProjectFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.sort && filters.sort !== "createdAt") params.set("sort", filters.sort);
  if (filters.order && filters.order !== "desc") params.set("order", filters.order);
  return params;
}

/**
 * Returns true if any non-default project filter is active.
 */
export function hasActiveProjectFilters(filters: ProjectFilterState): boolean {
  return Boolean(filters.search.trim() || filters.status !== "ALL");
}

/**
 * Priority rank helper for in-memory sorting.
 */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

/**
 * Evaluates whether a task item matches a due date range filter in memory.
 */
export function matchesDueDateFilter(
  dueDate: string | Date | null | undefined,
  filter: DueDateFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "no-due-date") return dueDate === null || dueDate === undefined;

  if (!dueDate) return false;
  const d = new Date(dueDate).getTime();
  const now = Date.now();

  if (filter === "overdue") {
    return d < now;
  }

  if (filter === "this-week") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return d >= today.getTime() && d <= endOfWeek.getTime();
  }

  return true;
}
