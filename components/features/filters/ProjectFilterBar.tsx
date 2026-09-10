"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectFilterState } from "@/lib/filter-utils";

export interface ProjectFilterBarProps {
  filters: ProjectFilterState;
  searchInput: string;
  onSearchChange: (val: string) => void;
  onFilterChange: <K extends keyof ProjectFilterState>(key: K, val: ProjectFilterState[K]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PLANNING", label: "Planning" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

const SORT_OPTIONS: Array<{
  value: "name" | "createdAt" | "updatedAt" | "progressPercent";
  label: string;
}> = [
  { value: "createdAt", label: "Recently created" },
  { value: "updatedAt", label: "Recently updated" },
  { value: "name", label: "Project name" },
  { value: "progressPercent", label: "Progress" },
];

export function ProjectFilterBar({
  filters,
  searchInput,
  onSearchChange,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  className = "",
}: ProjectFilterBarProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <Input
            id="project-search-input"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects by name, key (e.g. CORE), or description..."
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
              aria-label="Clear project search"
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

        {/* Status select */}
        <select
          id="project-status-select"
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="h-10 rounded-lg border border-border/60 bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Sort select */}
        <div className="flex items-center gap-1.5">
          <select
            id="project-sort-select"
            value={filters.sort}
            onChange={(e) =>
              onFilterChange(
                "sort",
                e.target.value as "name" | "createdAt" | "updatedAt" | "progressPercent"
              )
            }
            className="h-10 rounded-lg border border-border/60 bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 focus:border-primary focus:outline-hidden"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            id="project-order-toggle"
            onClick={() => onFilterChange("order", filters.order === "asc" ? "desc" : "asc")}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
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

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-10 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Active filters pill chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground">Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Query: &ldquo;{filters.search}&rdquo;
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  onFilterChange("search", "");
                }}
                className="rounded-xs p-0.5 hover:bg-primary/20"
              >
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}

          {filters.status !== "ALL" && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Status: {filters.status}
              <button
                type="button"
                onClick={() => onFilterChange("status", "ALL")}
                className="rounded-xs p-0.5 hover:bg-primary/20"
              >
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
