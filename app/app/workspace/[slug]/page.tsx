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

interface WorkspaceDashboardPageProps {
  params: { slug: string };
}

export default async function WorkspaceDashboardPage({ params }: WorkspaceDashboardPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      workspace: { slug: params.slug },
    },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, plan: true },
      },
    },
  });

  if (!membership) {
    redirect("/app");
  }

  const workspace = membership.workspace;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
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

        <div className="mt-5">
          <DashboardStatsBar workspaceId={workspace.id} userId={user.id} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/app/projects">
            <Button size="sm" variant="default">
              Projects
            </Button>
          </Link>
          <Link href="/app/tasks">
            <Button size="sm" variant="outline">
              My Tasks
            </Button>
          </Link>
          <Link href="/app/workspaces/new">
            <Button size="sm" variant="ghost">
              New Workspace
            </Button>
          </Link>
        </div>
      </div>

      <WorkspaceAiAssistant workspaceId={workspace.id} workspaceName={workspace.name} />
      <ProjectsSection workspaceId={workspace.id} userId={user.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MyTasksSection workspaceId={workspace.id} userId={user.id} />
        </div>
        <div className="flex flex-col gap-6">
          <UpcomingSection workspaceId={workspace.id} userId={user.id} />
          <ActivitySection workspaceId={workspace.id} userId={user.id} />
        </div>
      </div>
    </div>
  );
}
