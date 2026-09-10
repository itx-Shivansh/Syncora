import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/dashboard/:workspaceId/activity
 *
 * Returns the 40 most recent ActivityEvents across the entire workspace,
 * enriched with actor info and optional task/project references.
 * Used by the workspace-wide Activity Feed section on the dashboard.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) return apiError("Authentication required.", "UNAUTHORIZED", 401);

  const { workspaceId } = params;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) return apiError(auth.message, auth.code, auth.status);

  try {
    const activities = await prisma.activityEvent.findMany({
      where: { workspaceId },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        task: {
          select: { id: true, taskNumber: true, title: true, project: { select: { key: true } } },
        },
        project: {
          select: { id: true, name: true, key: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const enriched = activities.map((a) => ({
      id: a.id,
      action: a.action,
      metadata: a.metadata as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
      actor: a.actor,
      task: a.task
        ? {
            id: a.task.id,
            taskKey: `${a.task.project.key}-${a.task.taskNumber}`,
            title: a.task.title,
          }
        : null,
      project: a.project ? { id: a.project.id, name: a.project.name, key: a.project.key } : null,
    }));

    return apiSuccess({ activities: enriched });
  } catch (err) {
    console.error("[dashboard/activity] Error:", err);
    return apiError("Could not load activity.", "INTERNAL_ERROR", 500);
  }
}
