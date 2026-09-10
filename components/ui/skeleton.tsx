import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={cn("motion-safe:animate-pulse rounded-md border border-white/5 bg-muted/60", className)}
      {...props}
    />
  );
}
