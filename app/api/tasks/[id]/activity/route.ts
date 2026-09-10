import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/tasks/:id/activity
 * Lists chronological activity events for a specific task.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: { members: true },
      },
    },
  });

  if (!task) {
    return apiError("Task not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, task.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  if (
    task.project.visibility === "PRIVATE" &&
    !task.project.members.some((m) => m.userId === user.id) &&
    auth.role !== "OWNER"
  ) {
    return apiError("Task not found.", "NOT_FOUND", 404);
  }

  try {
    const activities = await prisma.activityEvent.findMany({
      where: { taskId: task.id },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return apiSuccess({ activities });
  } catch (error) {
    console.error("Failed to list task activities:", error);
    return apiError("Could not retrieve task activities.", "INTERNAL_ERROR", 500);
  }
}
