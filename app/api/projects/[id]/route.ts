import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember, ROLE_RANK } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { updateProjectSchema } from "@/lib/validation";
import { computeProjectHealth } from "@/lib/project-health";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/projects/:id
 * Retrieve full project details, members, task status summary, and health score.
 * Enforces PRIVATE visibility: non-members receive 404.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        select: {
          id: true,
          status: true,
          priority: true,
          title: true,
          taskNumber: true,
          taskKey: true,
          dueDate: true,
          assigneeId: true,
          assignee: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: { members: true, tasks: true },
      },
    },
  });

  if (!project) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, project.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  // Check PRIVATE visibility
  const isProjectMember = project.members.some((m) => m.userId === user.id);
  if (project.visibility === "PRIVATE" && !isProjectMember && auth.role !== "OWNER") {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  // Calculate task counts
  const taskCounts = project.tasks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalTasks = project.tasks.length;
  const doneTasks = taskCounts["DONE"] || 0;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Compute Project Health Score and honest breakdown reasons
  const health = computeProjectHealth({
    id: project.id,
    name: project.name,
    status: project.status,
    targetStartDate: project.targetStartDate,
    targetEndDate: project.targetEndDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    tasks: project.tasks,
  });

  // Identify caller's project role
  const callerMembership = project.members.find((m) => m.userId === user.id);
  const callerProjectRole = callerMembership?.role ?? null;
  const isLeadOrAdmin = callerProjectRole === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  const rest = { ...project };
  delete (rest as { tasks?: unknown }).tasks;

  return apiSuccess({
    project: {
      ...rest,
      taskCounts,
      totalTasks,
      doneTasks,
      progressPercent,
      callerProjectRole,
      isLeadOrAdmin,
      health,
    },
  });
}

/**
 * PATCH /api/projects/:id
 * Update project metadata or status transitions.
 * Gated to Project LEAD or Workspace ADMIN+.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
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

  const callerMembership = project.members.find((m) => m.userId === user.id);
  const isLeadOrAdmin =
    callerMembership?.role === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (!isLeadOrAdmin) {
    return apiError(
      "Only project leads or workspace administrators can modify project settings.",
      "FORBIDDEN",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = updateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;

  try {
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.targetStartDate !== undefined && {
          targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
        }),
        ...(data.targetEndDate !== undefined && {
          targetEndDate: data.targetEndDate ? new Date(data.targetEndDate) : null,
        }),
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    // Log ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: user.id,
        action:
          data.status && data.status !== project.status ? "STATUS_CHANGED" : "PROJECT_UPDATED",
        metadata: {
          updatedFields: Object.keys(data),
          previousStatus: project.status,
          newStatus: data.status || project.status,
        },
      },
    });

    return apiSuccess({ project: updated });
  } catch (error) {
    console.error("Failed to update project:", error);
    return apiError("Could not update project.", "INTERNAL_ERROR", 500);
  }
}

/**
 * DELETE /api/projects/:id
 * Delete a project and its associated resources.
 * Gated strictly to Project LEAD or Workspace ADMIN+.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
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

  const callerMembership = project.members.find((m) => m.userId === user.id);
  const isLeadOrAdmin =
    callerMembership?.role === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (!isLeadOrAdmin) {
    return apiError(
      "Only project leads or workspace administrators can delete projects.",
      "FORBIDDEN",
      403
    );
  }

  try {
    await prisma.project.delete({
      where: { id: params.id },
    });

    return apiSuccess({ deleted: true, id: params.id });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return apiError("Could not delete project.", "INTERNAL_ERROR", 500);
  }
}
