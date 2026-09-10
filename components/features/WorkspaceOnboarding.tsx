"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  slug: string;
  slugTouched: boolean;
  loading: boolean;
  error: string | null;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * CreateWorkspaceForm
 * Used on both the /app/workspaces/new route and the onboarding flow
 * for users who have no active workspace memberships.
 */
export function CreateWorkspaceForm({ onSuccess }: { onSuccess?: (slug: string) => void }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    name: "",
    slug: "",
    slugTouched: false,
    loading: false,
    error: null,
  });

  const derivedSlug = state.slugTouched ? state.slug : toSlug(state.name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim(),
          slug: derivedSlug || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: json.error?.message ?? "Something went wrong. Please try again.",
        }));
        return;
      }

      const createdSlug: string = json.data.workspace.slug;
      if (onSuccess) {
        onSuccess(createdSlug);
      } else {
        router.push(`/app/workspace/${createdSlug}`);
      }
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Network error. Please try again." }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" id="create-workspace-form">
      <div className="space-y-1.5">
        <label htmlFor="ws-name" className="block text-sm font-medium text-foreground">
          Workspace name
        </label>
        <input
          id="ws-name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder="Acme Corp"
          value={state.name}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              name: e.target.value,
            }))
          }
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-card/60 px-3.5 py-2 text-sm text-foreground shadow-subtle transition-all duration-150",
            "placeholder:text-muted-foreground/60",
            "focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ws-slug" className="block text-sm font-medium text-foreground">
          URL slug
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            (auto-generated from name)
          </span>
        </label>
        <div className="flex items-center overflow-hidden rounded-lg border border-input bg-card/60 shadow-subtle transition-all duration-150 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring">
          <span className="select-none whitespace-nowrap pl-3.5 pr-1 font-mono text-sm text-muted-foreground">
            syncora.app/
          </span>
          <input
            id="ws-slug"
            type="text"
            required
            minLength={2}
            maxLength={64}
            placeholder="acme-corp"
            value={derivedSlug}
            onChange={(e) => setState((s) => ({ ...s, slug: e.target.value, slugTouched: true }))}
            className="flex-1 bg-transparent px-1 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only lowercase letters, numbers, and hyphens. Cannot be changed later.
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-sm text-destructive"
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {state.error}
        </div>
      )}

      <Button
        id="create-workspace-submit"
        type="submit"
        disabled={state.loading || !state.name.trim()}
        isLoading={state.loading}
        className="h-11 w-full rounded-xl text-sm font-semibold"
      >
        Create workspace
      </Button>
    </form>
  );
}

/**
 * WorkspaceOnboarding
 * Full-page onboarding shell rendered when a user has no active workspace
 * memberships.
 */
export function WorkspaceOnboarding() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow">
              <svg
                className="h-5 w-5 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Syncora</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Create your first workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            A workspace is where your team&apos;s projects and tasks live. You can create more and
            invite teammates after setup.
          </p>
        </div>

        {/* Card */}
        <Card glass className="p-6">
          <CreateWorkspaceForm onSuccess={(slug) => router.push(`/app/workspace/${slug}`)} />
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By creating a workspace you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
