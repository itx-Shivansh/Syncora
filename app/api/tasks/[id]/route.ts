import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember, ROLE_RANK } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { updateTaskSchema } from "@/lib/validation";
import { ActivityAction, Prisma } from "@prisma/client";
import { notifyTaskAssigned, notifyTaskStatusChanged } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/tasks/:id
 * Retrieve single task detail with relations.
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
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      },
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
      labels: { include: { label: true } },
      subTasks: {
        select: {
          id: true,
          taskKey: true,
          taskNumber: true,
          title: true,
          status: true,
          priority: true,
          orderIndex: true,
          createdAt: true,
        },
        orderBy: { taskNumber: "asc" },
      },
      comments: {
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { subTasks: true, comments: true } },
    },
  });

  if (!task) {
    return apiError("Task not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, task.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const callerMember = task.project.members.find((m) => m.userId === user.id);
  const callerProjectRole = callerMember ? callerMember.role : null;
  const isLeadOrAdmin = callerProjectRole === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (task.project.visibility === "PRIVATE" && !callerMember && auth.role !== "OWNER") {
    return apiError("Task not found.", "NOT_FOUND", 404);
  }

  return apiSuccess({
    task,
    callerProjectRole,
    isLeadOrAdmin,
  });
}

/**
 * PATCH /api/tasks/:id
 * Update any task field and write appropriate ActivityEvent.
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

  const parseResult = updateTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;

  // Determine ActivityAction and metadata
  let activityAction: ActivityAction = "TASK_UPDATED";
  const metadata: Record<string, string | number | boolean | null | undefined> = {
    taskKey: task.taskKey,
  };

  if (data.status && data.status !== task.status) {
    activityAction = "STATUS_CHANGED";
    metadata.previousStatus = task.status;
    metadata.newStatus = data.status;
  } else if (data.priority && data.priority !== task.priority) {
    activityAction = "PRIORITY_CHANGED";
    metadata.previousPriority = task.priority;
    metadata.newPriority = data.priority;
  } else if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
    activityAction = "ASSIGNEE_CHANGED";
    metadata.previousAssigneeId = task.assigneeId;
    metadata.newAssigneeId = data.assigneeId;
  } else if (data.dueDate !== undefined) {
    const newDueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;
    const oldDueDate = task.dueDate ? task.dueDate.toISOString() : null;
    if (newDueDate !== oldDueDate) {
      activityAction = "DUE_DATE_CHANGED";
      metadata.previousDueDate = oldDueDate;
      metadata.newDueDate = newDueDate;
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Update label connections if provided
      if (data.labelIds !== undefined) {
        await tx.taskLabel.deleteMany({ where: { taskId: task.id } });
        if (data.labelIds.length > 0) {
          await tx.taskLabel.createMany({
            data: data.labelIds.map((labelId) => ({
              taskId: task.id,
              labelId,
            })),
          });
        }
      }

      return tx.task.update({
        where: { id: params.id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
          ...(data.dueDate !== undefined && {
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
          }),
          ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
          ...(data.actualHours !== undefined && { actualHours: data.actualHours }),
        },
        include: {
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
          labels: { include: { label: true } },
        },
      });
    });

    // Write ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        actorId: user.id,
        action: activityAction,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });

    // Notify new assignee if assignee changed
    if (
      data.assigneeId !== undefined &&
      data.assigneeId !== task.assigneeId &&
      data.assigneeId !== null
    ) {
      await notifyTaskAssigned({
        workspaceId: task.workspaceId,
        taskId: task.id,
        taskKey: task.taskKey,
        taskTitle: updated.title,
        assigneeId: data.assigneeId,
        actorId: user.id,
        actorName: user.name,
      });
    }

    // Notify assignee if status changed
    if (data.status && data.status !== task.status && updated.assigneeId) {
      await notifyTaskStatusChanged({
        workspaceId: task.workspaceId,
        taskId: task.id,
        taskKey: task.taskKey,
        taskTitle: updated.title,
        newStatus: data.status,
        assigneeId: updated.assigneeId,
        actorId: user.id,
        actorName: user.name,
      });
    }

    return apiSuccess({ task: updated });
  } catch (error) {
    console.error("Failed to update task:", error);
    return apiError("Could not update task.", "INTERNAL_ERROR", 500);
  }
}

/**
 * DELETE /api/tasks/:id
 * Role-gated task deletion (creator, assignee, project LEAD, or workspace ADMIN+).
 */
export async function DELETE(req: Request, { params }: RouteParams) {
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

  // Check delete authorization
  const isCreator = task.creatorId === user.id;
  const isAssignee = task.assigneeId === user.id;
  const callerProjectMember = task.project.members.find((m) => m.userId === user.id);
  const isProjectLead = callerProjectMember?.role === "LEAD";
  const isWorkspaceAdminOrOwner = ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (!isCreator && !isAssignee && !isProjectLead && !isWorkspaceAdminOrOwner) {
    return apiError(
      "You are not authorized to delete this task. Only task creator, assignee, project lead, or workspace admins may delete.",
      "FORBIDDEN",
      403
    );
  }

  try {
    await prisma.task.delete({
      where: { id: params.id },
    });

    return apiSuccess({ deleted: true, id: params.id });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return apiError("Could not delete task.", "INTERNAL_ERROR", 500);
  }
}
