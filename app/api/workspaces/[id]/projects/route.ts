import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createProjectSchema, deriveProjectKey } from "@/lib/validation";
import { computeProjectHealth } from "@/lib/project-health";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/workspaces/:id/projects
 * Create a new project in the specified workspace.
 * Gated to workspace MEMBER, ADMIN, or OWNER.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const workspaceId = params.id;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "MEMBER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = createProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;
  const resolvedKey = data.key || deriveProjectKey(data.name);

  // Check unique key within workspace
  const existingKey = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId, key: resolvedKey } },
  });

  if (existingKey) {
    return apiError(
      `Project with key "${resolvedKey}" already exists in this workspace.`,
      "PROJECT_KEY_CONFLICT",
      409
    );
  }

  // Filter valid workspace members if initialMembers are specified
  let validAdditionalMembers: { userId: string; role: "LEAD" | "MEMBER" | "VIEWER" }[] = [];
  if (data.initialMembers && data.initialMembers.length > 0) {
    const candidateIds = data.initialMembers.map((m) => m.userId).filter((id) => id !== user.id);

    if (candidateIds.length > 0) {
      const activeWsMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          userId: { in: candidateIds },
          status: "ACTIVE",
        },
        select: { userId: true },
      });

      const activeSet = new Set(activeWsMembers.map((m) => m.userId));
      validAdditionalMembers = data.initialMembers
        .filter((m) => activeSet.has(m.userId) && m.userId !== user.id)
        .map((m) => ({ userId: m.userId, role: m.role }));
    }
  }

  try {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        ownerId: user.id,
        name: data.name,
        key: resolvedKey,
        description: data.description || null,
        status: data.status,
        visibility: data.visibility,
        color: data.color || null,
        targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
        targetEndDate: data.targetEndDate ? new Date(data.targetEndDate) : null,
        members: {
          create: [{ userId: user.id, role: "LEAD" }, ...validAdditionalMembers],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: {
          select: { members: true, tasks: true },
        },
      },
    });

    // Log ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId,
        projectId: project.id,
        actorId: user.id,
        action: "PROJECT_CREATED",
        metadata: {
          projectName: project.name,
          key: project.key,
          visibility: project.visibility,
        },
      },
    });

    return apiSuccess({ project }, 201);
  } catch (error) {
    console.error("Failed to create project:", error);
    return apiError("Could not create project.", "INTERNAL_ERROR", 500);
  }
}

/**
 * GET /api/workspaces/:id/projects
 * List all projects in workspace.
 * Respects PRIVATE visibility: PRIVATE projects are only returned if the user is a member of that project.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const workspaceId = params.id;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        OR: [{ visibility: "PUBLIC_TO_WORKSPACE" }, { members: { some: { userId: user.id } } }],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
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
      orderBy: { createdAt: "desc" },
    });

    const enriched = projects.map((p) => {
      const taskCounts = p.tasks.reduce(
        (acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const totalTasks = p.tasks.length;
      const doneTasks = taskCounts["DONE"] || 0;
      const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      const health = computeProjectHealth({
        id: p.id,
        name: p.name,
        status: p.status,
        targetStartDate: p.targetStartDate,
        targetEndDate: p.targetEndDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        tasks: p.tasks,
      });

      const rest = { ...p };
      delete (rest as { tasks?: unknown }).tasks;
      return {
        ...rest,
        taskCounts,
        totalTasks,
        doneTasks,
        progressPercent,
        health,
      };
    });

    return apiSuccess({ projects: enriched });
  } catch (error) {
    console.error("Failed to list projects:", error);
    return apiError("Could not list projects.", "INTERNAL_ERROR", 500);
  }
}
