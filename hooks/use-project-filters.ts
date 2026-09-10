"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ProjectFilterState,
  DEFAULT_PROJECT_FILTERS,
  parseProjectFiltersFromParams,
  serializeProjectFiltersToParams,
  hasActiveProjectFilters,
} from "@/lib/filter-utils";
import { useDebounce } from "@/hooks/use-debounce";

export function useProjectFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = React.useMemo(() => {
    return parseProjectFiltersFromParams(searchParams);
  }, [searchParams]);

  const [searchInput, setSearchInput] = React.useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  React.useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      const nextFilters: ProjectFilterState = {
        ...filters,
        search: debouncedSearch,
      };
      const params = serializeProjectFiltersToParams(nextFilters);
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }
  }, [debouncedSearch, filters, pathname, router]);

  const setFilter = React.useCallback(
    <K extends keyof ProjectFilterState>(key: K, value: ProjectFilterState[K]) => {
      const nextFilters: ProjectFilterState = {
        ...filters,
        [key]: value,
      };
      if (key === "search") {
        setSearchInput(value as string);
      }
      const params = serializeProjectFiltersToParams(nextFilters);
      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [filters, pathname, router]
  );

  const clearFilters = React.useCallback(() => {
    setSearchInput("");
    const params = serializeProjectFiltersToParams(DEFAULT_PROJECT_FILTERS);
    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router]);

  return {
    filters,
    searchInput,
    setSearchInput,
    setFilter,
    clearFilters,
    hasActiveFilters: hasActiveProjectFilters(filters),
  };
}
