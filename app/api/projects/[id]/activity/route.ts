import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/projects/:id/activity
 * Lists recent activity events across the entire project (tasks, comments, status transitions).
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { members: true },
  });

  if (!project) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, project.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  if (
    project.visibility === "PRIVATE" &&
    !project.members.some((m) => m.userId === user.id) &&
    auth.role !== "OWNER"
  ) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  try {
    const activities = await prisma.activityEvent.findMany({
      where: {
        OR: [
          { projectId: project.id },
          { task: { projectId: project.id } },
        ],
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        task: {
          select: { id: true, taskKey: true, taskNumber: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess({ activities });
  } catch (error) {
    console.error("Failed to list project activities:", error);
    return apiError("Could not retrieve project activities.", "INTERNAL_ERROR", 500);
  }
}
