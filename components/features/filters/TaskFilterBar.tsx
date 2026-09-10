"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskFilterState, DueDateFilter, TaskSortField } from "@/lib/filter-utils";

export interface ProjectOption {
  id: string;
  name: string;
  key: string;
}

export interface MemberOption {
  id: string;
  name: string;
  email: string;
}

export interface LabelOption {
  id: string;
  name: string;
  color: string;
}

export interface TaskFilterBarProps {
  filters: TaskFilterState;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onFilterChange: <K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  projects?: ProjectOption[];
  members?: MemberOption[];
  labels?: LabelOption[];
  hideProjectFilter?: boolean;
  hideSort?: boolean;
  placeholder?: string;
  className?: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "DONE", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Priorities" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const DUE_DATE_OPTIONS: Array<{ value: DueDateFilter; label: string }> = [
  { value: "all", label: "All Due Dates" },
  { value: "overdue", label: "Overdue" },
  { value: "this-week", label: "Due this week" },
  { value: "no-due-date", label: "No due date" },
];

const SORT_OPTIONS: Array<{ value: TaskSortField; label: string }> = [
  { value: "createdAt", label: "Recently created" },
  { value: "updatedAt", label: "Recently updated" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
];

export function TaskFilterBar({
  filters,
  searchInput,
  onSearchChange,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  projects = [],
  members = [],
  labels = [],
  hideProjectFilter = false,
  hideSort = false,
  placeholder = "Search tasks by title, key (e.g. SYNC-104), or description...",
  className = "",
}: TaskFilterBarProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top row: search bar and primary controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            id="task-search-input"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 pl-9 pr-8 text-sm"
            startIcon={
              <svg
                className="h-4 w-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            }
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-10 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Filter dropdowns row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Select */}
        <select
          id="filter-status-select"
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="h-8 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Priority Select */}
        <select
          id="filter-priority-select"
          value={filters.priority}
          onChange={(e) => onFilterChange("priority", e.target.value)}
          className="h-8 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Due Date Select */}
        <select
          id="filter-duedate-select"
          value={filters.dueDate}
          onChange={(e) => onFilterChange("dueDate", e.target.value as DueDateFilter)}
          className="h-8 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
        >
          {DUE_DATE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Project Select (when in workspace search) */}
        {!hideProjectFilter && projects.length > 0 && (
          <select
            id="filter-project-select"
            value={filters.projectId}
            onChange={(e) => onFilterChange("projectId", e.target.value)}
            className="h-8 max-w-[180px] truncate rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        )}

        {/* Assignee Select */}
        {members.length > 0 && (
          <select
            id="filter-assignee-select"
            value={filters.assigneeId}
            onChange={(e) => onFilterChange("assigneeId", e.target.value)}
            className="h-8 max-w-[160px] truncate rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
          >
            <option value="ALL">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        {/* Label Select */}
        {labels.length > 0 && (
          <select
            id="filter-label-select"
            value={filters.labelId}
            onChange={(e) => onFilterChange("labelId", e.target.value)}
            className="h-8 max-w-[150px] truncate rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
          >
            <option value="ALL">All Labels</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}

        {/* Sort Controls */}
        {!hideSort && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Sort:</span>
            <select
              id="filter-sort-select"
              value={filters.sort}
              onChange={(e) => onFilterChange("sort", e.target.value as TaskSortField)}
              className="h-8 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              id="filter-order-toggle"
              onClick={() => onFilterChange("order", filters.order === "asc" ? "desc" : "asc")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              title={`Sorting ${filters.order === "asc" ? "ascending" : "descending"}. Click to toggle.`}
            >
              {filters.order === "asc" ? (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Active filters pill chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground">Active filters:</span>

          {filters.search && (
            <FilterChip
              label={`Query: "${filters.search}"`}
              onRemove={() => {
                onSearchChange("");
                onFilterChange("search", "");
              }}
            />
          )}

          {filters.status !== "ALL" && (
            <FilterChip
              label={`Status: ${filters.status}`}
              onRemove={() => onFilterChange("status", "ALL")}
            />
          )}

          {filters.priority !== "ALL" && (
            <FilterChip
              label={`Priority: ${filters.priority}`}
              onRemove={() => onFilterChange("priority", "ALL")}
            />
          )}

          {filters.dueDate !== "all" && (
            <FilterChip
              label={`Due: ${filters.dueDate}`}
              onRemove={() => onFilterChange("dueDate", "all")}
            />
          )}

          {filters.projectId !== "ALL" && (
            <FilterChip
              label={`Project: ${projects.find((p) => p.id === filters.projectId)?.name || filters.projectId}`}
              onRemove={() => onFilterChange("projectId", "ALL")}
            />
          )}

          {filters.assigneeId !== "ALL" && (
            <FilterChip
              label={`Assignee: ${
                filters.assigneeId === "unassigned"
                  ? "Unassigned"
                  : members.find((m) => m.id === filters.assigneeId)?.name || filters.assigneeId
              }`}
              onRemove={() => onFilterChange("assigneeId", "ALL")}
            />
          )}

          {filters.labelId !== "ALL" && (
            <FilterChip
              label={`Label: ${labels.find((l) => l.id === filters.labelId)?.name || filters.labelId}`}
              onRemove={() => onFilterChange("labelId", "ALL")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-xs p-0.5 transition-colors hover:bg-primary/20 hover:text-foreground"
        aria-label={`Remove filter ${label}`}
      >
        <svg
          className="h-2.5 w-2.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
