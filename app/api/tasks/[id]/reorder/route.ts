import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reorderTaskSchema } from "@/lib/validation";
import { notifyTaskStatusChanged } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

/**
 * PATCH /api/tasks/:id/reorder
 * Persists a new status and/or orderIndex position so board order survives reload.
 * Writes ActivityEvent if status transitioned.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = reorderTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422
    );
  }

  const { status: newStatus, orderIndex } = parseResult.data;
  const statusChanged = newStatus && newStatus !== task.status;

  try {
    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        orderIndex,
        ...(newStatus && { status: newStatus }),
      },
      select: {
        id: true,
        projectId: true,
        workspaceId: true,
        taskKey: true,
        status: true,
        orderIndex: true,
      },
    });

    if (statusChanged) {
      await prisma.activityEvent.create({
        data: {
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
          actorId: user.id,
          action: "STATUS_CHANGED",
          metadata: {
            taskKey: task.taskKey,
            previousStatus: task.status,
            newStatus,
          },
        },
      });

      if (task.assigneeId) {
        await notifyTaskStatusChanged({
          workspaceId: task.workspaceId,
          taskId: task.id,
          taskKey: task.taskKey,
          taskTitle: task.title,
          newStatus,
          assigneeId: task.assigneeId,
          actorId: user.id,
          actorName: user.name,
        });
      }
    }

    return apiSuccess({ task: updated });
  } catch (error) {
    console.error("Failed to reorder task:", error);
    return apiError("Could not reorder task.", "INTERNAL_ERROR", 500);
  }
}
