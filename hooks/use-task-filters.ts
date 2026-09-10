"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  TaskFilterState,
  DEFAULT_TASK_FILTERS,
  parseTaskFiltersFromParams,
  serializeTaskFiltersToParams,
  hasActiveTaskFilters,
} from "@/lib/filter-utils";
import { useDebounce } from "@/hooks/use-debounce";

interface UseTaskFiltersOptions {
  ignoreProject?: boolean;
}

export function useTaskFilters(options?: UseTaskFiltersOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse filters directly from URL
  const filters = React.useMemo(() => {
    return parseTaskFiltersFromParams(searchParams);
  }, [searchParams]);

  // Local immediate search input state to avoid typing lag
  const [searchInput, setSearchInput] = React.useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Synchronize local input if URL search param changes externally (e.g. back/forward navigation)
  React.useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // When debounced search changes, push to URL if different
  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      const nextFilters: TaskFilterState = {
        ...filters,
        search: debouncedSearch,
      };
      const params = serializeTaskFiltersToParams(nextFilters);
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }
  }, [debouncedSearch, filters, pathname, router]);

  const setFilter = React.useCallback(
    <K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) => {
      const nextFilters: TaskFilterState = {
        ...filters,
        [key]: value,
      };
      if (key === "search") {
        setSearchInput(value as string);
      }
      const params = serializeTaskFiltersToParams(nextFilters);
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [filters, pathname, router]
  );

  const clearFilters = React.useCallback(() => {
    setSearchInput("");
    // Keep project if on a single project board and ignoreProject is set
    const nextFilters: TaskFilterState = {
      ...DEFAULT_TASK_FILTERS,
      projectId: options?.ignoreProject ? filters.projectId : "ALL",
    };
    const params = serializeTaskFiltersToParams(nextFilters);
    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [filters.projectId, options?.ignoreProject, pathname, router]);

  const active = React.useMemo(() => {
    return hasActiveTaskFilters(filters, { ignoreProject: options?.ignoreProject });
  }, [filters, options?.ignoreProject]);

  return {
    filters,
    searchInput,
    setSearchInput,
    setFilter,
    clearFilters,
    hasActiveFilters: active,
  };
}
