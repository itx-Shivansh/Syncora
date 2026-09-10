import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createTaskSchema } from "@/lib/validation";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { notifyTaskAssigned } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/projects/:id/tasks
 * List tasks for a project, supporting status, assignee, priority, label, and search filters.
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

  // Parse query parameters for filters
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const priorityParam = url.searchParams.get("priority");
  const assigneeId = url.searchParams.get("assigneeId");
  const labelId = url.searchParams.get("labelId");
  const search = url.searchParams.get("search") || url.searchParams.get("q");
  const dueDate = url.searchParams.get("dueDate");

  const whereClause: Record<string, unknown> = {
    projectId: project.id,
  };

  if (statusParam && statusParam !== "ALL") {
    const statuses = statusParam.split(",").map((s) => s.trim()) as TaskStatus[];
    whereClause.status = { in: statuses };
  }

  if (priorityParam && priorityParam !== "ALL") {
    const priorities = priorityParam.split(",").map((p) => p.trim()) as TaskPriority[];
    whereClause.priority = { in: priorities };
  }

  if (assigneeId && assigneeId !== "ALL") {
    if (assigneeId === "unassigned") {
      whereClause.assigneeId = null;
    } else {
      whereClause.assigneeId = assigneeId;
    }
  }

  if (labelId && labelId !== "ALL") {
    whereClause.labels = { some: { labelId } };
  }

  if (search && search.trim()) {
    const term = search.trim();
    whereClause.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { taskKey: { contains: term, mode: "insensitive" } },
    ];
  }

  if (dueDate && dueDate !== "all") {
    const now = new Date();
    if (dueDate === "overdue") {
      whereClause.dueDate = { lt: now };
      if (!whereClause.status) {
        whereClause.status = { notIn: ["DONE", "CANCELLED"] };
      }
    } else if (dueDate === "this-week") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      whereClause.dueDate = { gte: today, lte: endOfWeek };
    } else if (dueDate === "no-due-date") {
      whereClause.dueDate = null;
    }
  }

  try {
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: { include: { label: true } },
        _count: { select: { comments: true, subTasks: true } },
      },
      orderBy: { orderIndex: "asc" },
    });

    return apiSuccess({ tasks });
  } catch (error) {
    console.error("Failed to list tasks:", error);
    return apiError("Could not list tasks.", "INTERNAL_ERROR", 500);
  }
}

/**
 * POST /api/projects/:id/tasks
 * Create a new task within a project.
 * Assigns next monotonic taskNumber/taskKey (e.g. SYNC-104) and initial orderIndex.
 */
export async function POST(req: Request, { params }: RouteParams) {
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

  const auth = await requireWorkspaceMember(user.id, project.workspaceId, "MEMBER");
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = createTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;

  // Validate assignee if supplied
  if (data.assigneeId) {
    const assigneeMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId: data.assigneeId,
        },
      },
    });
    if (!assigneeMember || assigneeMember.status !== "ACTIVE") {
      return apiError("Assignee must be an active workspace member.", "INVALID_ASSIGNEE", 400);
    }
  }

  try {
    // Process newLabels if provided inline
    const finalLabelIds = new Set<string>(data.labelIds || []);
    if (data.newLabels && data.newLabels.length > 0) {
      for (const nl of data.newLabels) {
        const createdLabel = await prisma.label.upsert({
          where: {
            workspaceId_name: {
              workspaceId: project.workspaceId,
              name: nl.name.trim(),
            },
          },
          update: { color: nl.color },
          create: {
            workspaceId: project.workspaceId,
            name: nl.name.trim(),
            color: nl.color,
          },
        });
        finalLabelIds.add(createdLabel.id);
      }
    }

    // Monotonic taskNumber and taskKey derivation
    const lastTask = await prisma.task.findFirst({
      where: { projectId: project.id },
      orderBy: { taskNumber: "desc" },
      select: { taskNumber: true },
    });
    const taskNumber = (lastTask?.taskNumber ?? 0) + 1;
    const taskKey = `${project.key}-${taskNumber}`;

    // OrderIndex calculation for the status column
    const lastInColumn = await prisma.task.findFirst({
      where: { projectId: project.id, status: data.status },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const orderIndex = (lastInColumn?.orderIndex ?? 0) + 1000;

    const task = await prisma.task.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        creatorId: user.id,
        assigneeId: data.assigneeId || null,
        taskNumber,
        taskKey,
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        orderIndex,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        estimatedHours: data.estimatedHours || null,
        labels: {
          create: Array.from(finalLabelIds).map((labelId) => ({ labelId })),
        },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: { include: { label: true } },
        _count: { select: { comments: true, subTasks: true } },
      },
    });

    // Write ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        taskId: task.id,
        actorId: user.id,
        action: "TASK_CREATED",
        metadata: {
          taskKey: task.taskKey,
          title: task.title,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
        },
      },
    });

    // Notify assignee if assigned to someone other than creator
    if (task.assigneeId) {
      await notifyTaskAssigned({
        workspaceId: project.workspaceId,
        taskId: task.id,
        taskKey: task.taskKey,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        actorId: user.id,
        actorName: user.name,
      });
    }

    return apiSuccess({ task }, 201);
  } catch (error) {
    console.error("Failed to create task:", error);
    return apiError("Could not create task.", "INTERNAL_ERROR", 500);
  }
}
