"use client";

import * as React from "react";

/**
 * Custom hook to debounce any fast-changing value (e.g. search input).
 * @param value The value to debounce.
 * @param delay Milliseconds to wait before committing change. Default: 300ms.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
