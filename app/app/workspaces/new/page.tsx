import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { CreateWorkspaceForm } from "@/components/features/WorkspaceOnboarding";
import { Card } from "@/components/ui/card";

/**
 * /app/workspaces/new
 *
 * Renders the workspace creation form.
 * If the user is not authenticated, redirect to /login.
 * After creation the form redirects to /app/workspace/[slug].
 */
export default async function NewWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <Link
            href="/app"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to app
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create workspace</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Set up a dedicated workspace for your team, client, or initiative.
          </p>
        </div>

        <Card glass className="p-6">
          <CreateWorkspaceForm />
        </Card>
      </div>
    </div>
  );
}
