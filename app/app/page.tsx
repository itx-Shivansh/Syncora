import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { MyTasksSection } from "@/components/features/dashboard/MyTasksSection";
import { ProjectsSection } from "@/components/features/dashboard/ProjectsSection";
import { UpcomingSection } from "@/components/features/dashboard/UpcomingSection";
import { ActivitySection } from "@/components/features/dashboard/ActivitySection";
import { DashboardStatsBar } from "@/components/features/dashboard/DashboardStatsBar";
import { WorkspaceAiAssistant } from "@/components/features/ai/WorkspaceAiAssistant";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // No session → redirect to login
  if (!user) redirect("/login");

  // Resolve the user's first active workspace membership to establish context.
  // The workspace switcher in the app shell handles switching between workspaces.
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, plan: true },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  // No workspace → onboard
  if (!membership) {
    redirect("/app/workspaces/new");
  }

  const workspace = membership.workspace;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Derive greeting by time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      {/* ── Greeting header ── */}
      <div className="border-b border-border/40 pb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            {workspace.name}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span className="text-xs text-muted-foreground">{today}</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {greeting},{" "}
          <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
            {user.name.split(" ")[0]}
          </span>
          .
        </h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Here&apos;s your command center — what&apos;s in motion, what needs attention, and
          what&apos;s coming up.
        </p>

        {/* Stats bar — client component shares TanStack Query cache with section components */}
        <div className="mt-5">
          <DashboardStatsBar workspaceId={workspace.id} userId={user.id} />
        </div>

        {/* Quick actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/app/projects">
            <Button size="sm" variant="default">
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              Projects
            </Button>
          </Link>
          <Link href="/app/tasks">
            <Button size="sm" variant="outline">
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              My Tasks
            </Button>
          </Link>
          <Link href={`/app/workspaces/new`}>
            <Button size="sm" variant="ghost">
              <svg
                className="mr-1.5 h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Workspace
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Grounded AI Intelligence Assistant (Chunk 16) ── */}
      <WorkspaceAiAssistant workspaceId={workspace.id} workspaceName={workspace.name} />

      {/* ── Active projects overview ── */}
      {/* Independent TanStack Query fetch — a slow query here never blocks other sections */}
      <ProjectsSection workspaceId={workspace.id} userId={user.id} />

      {/* ── Main two-column grid: My Tasks + Timeline / Activity ── */}
      {/*
        Layout:
          [desktop] Left: My Tasks (2/3) | Right: two-column stack (Timeline top, Activity bottom)
          [mobile]  Stacked: Projects → My Tasks → Timeline → Activity
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* My Tasks — spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <MyTasksSection workspaceId={workspace.id} userId={user.id} />
        </div>

        {/* Right column: Timeline + Activity stacked */}
        <div className="flex flex-col gap-6">
          <UpcomingSection workspaceId={workspace.id} userId={user.id} />
          <ActivitySection workspaceId={workspace.id} userId={user.id} />
        </div>
      </div>
    </div>
  );
}
