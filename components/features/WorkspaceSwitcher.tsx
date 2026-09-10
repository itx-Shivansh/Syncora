"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WorkspaceMembership {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: string;
  memberCount: number;
  projectCount: number;
  role: string;
  joinedAt: string;
}

interface WorkspaceSwitcherProps {
  /** Currently active workspace ID */
  activeWorkspaceId?: string;
  className?: string;
}

export function WorkspaceSwitcher({ activeWorkspaceId, className = "" }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/workspaces/active");
        if (!res.ok) return;
        const json = await res.json();
        setWorkspaces(json.data?.workspaces ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return <Skeleton className={cn("h-10 w-full rounded-lg", className)} />;
  }

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        id="workspace-switcher-trigger"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-border/80 bg-card/60 px-3 py-2 text-left shadow-subtle transition-all duration-150 hover:bg-accent/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "border-primary/50 bg-accent/60 ring-2 ring-primary/20"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {active ? (
          <>
            <Avatar name={active.name} src={active.logoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {active.name}
              </p>
              <p className="text-[11px] font-medium capitalize text-muted-foreground">
                {active.plan.toLowerCase()} plan
              </p>
            </div>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Select workspace</span>
        )}
        <svg
          className={cn(
            "ml-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-primary"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="animate-in fade-in zoom-in-95 absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover/95 p-1.5 shadow-glass backdrop-blur-xl duration-150"
        >
          {/* Header */}
          <div className="border-b border-border/50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspaces
            </p>
          </div>

          {/* Workspace list */}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto py-1">
            {workspaces.map((ws) => (
              <li key={ws.id} role="option" aria-selected={ws.id === active?.id}>
                <button
                  id={`workspace-option-${ws.slug}`}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/app/workspace/${ws.slug}`);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100 hover:bg-accent",
                    ws.id === active?.id && "bg-accent/80 font-medium text-foreground"
                  )}
                >
                  <Avatar name={ws.name} src={ws.logoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{ws.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ws.memberCount} member{ws.memberCount !== 1 ? "s" : ""} ·{" "}
                      <span className="capitalize">{ws.role.toLowerCase()}</span>
                    </p>
                  </div>
                  {ws.id === active?.id && (
                    <svg
                      className="h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Divider + Create action */}
          <div className="mt-1 border-t border-border/50 pt-1">
            <button
              id="workspace-switcher-create"
              onClick={() => {
                setOpen(false);
                router.push("/app/workspaces/new");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors duration-100 hover:bg-accent"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Create new workspace
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
