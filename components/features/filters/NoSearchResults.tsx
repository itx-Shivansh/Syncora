"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface NoSearchResultsProps {
  onClearFilters: () => void;
  searchTerm?: string;
  className?: string;
}

/**
 * Dedicated "no results" state rendered when active filters or search keywords
 * match 0 tasks or projects, prompting the user to relax/clear their filters.
 */
export function NoSearchResults({
  onClearFilters,
  searchTerm,
  className = "",
}: NoSearchResultsProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-10 text-center backdrop-blur-xs ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-glow">
        <svg
          className="h-6 w-6 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
          />
        </svg>
      </div>

      <h3 className="text-base font-semibold tracking-tight text-foreground">
        No matching results found
      </h3>

      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {searchTerm ? (
          <>
            No items matched your query &ldquo;
            <span className="font-medium text-foreground">{searchTerm}</span>
            &rdquo; with current filter criteria.
          </>
        ) : (
          "No items match the currently applied combination of filters."
        )}
      </p>

      <div className="mt-5 flex items-center justify-center gap-3">
        <Button
          id="clear-filters-button"
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="gap-1.5"
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
          Clear all filters
        </Button>
      </div>
    </div>
  );
}
