import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TaskPriority } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

const createSubtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Subtask title is required" })
    .max(255, { message: "Title cannot exceed 255 characters" }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).default("MEDIUM"),
});

/**
 * POST /api/tasks/:id/subtasks
 * Creates a new subtask attached to parentId: params.id.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const parentTask = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      project: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!parentTask) {
    return apiError("Parent task not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, parentTask.workspaceId, "MEMBER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  if (
    parentTask.project.visibility === "PRIVATE" &&
    !parentTask.project.members.some((m) => m.userId === user.id) &&
    auth.role !== "OWNER"
  ) {
    return apiError("Parent task not found.", "NOT_FOUND", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body.", "BAD_REQUEST", 400);
  }

  const parseResult = createSubtaskSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;

  try {
    // Derive next monotonic task number for the project
    const lastTask = await prisma.task.findFirst({
      where: { projectId: parentTask.projectId },
      orderBy: { taskNumber: "desc" },
      select: { taskNumber: true },
    });
    const taskNumber = (lastTask?.taskNumber ?? 0) + 1;
    const taskKey = `${parentTask.project.key}-${taskNumber}`;

    const subTask = await prisma.task.create({
      data: {
        workspaceId: parentTask.workspaceId,
        projectId: parentTask.projectId,
        parentId: parentTask.id,
        creatorId: user.id,
        taskNumber,
        taskKey,
        title: data.title,
        status: "TODO",
        priority: data.priority as TaskPriority,
        orderIndex: 1000,
      },
      select: {
        id: true,
        parentId: true,
        taskKey: true,
        taskNumber: true,
        title: true,
        status: true,
        priority: true,
        orderIndex: true,
        createdAt: true,
      },
    });

    // Write ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId: parentTask.workspaceId,
        projectId: parentTask.projectId,
        taskId: parentTask.id,
        actorId: user.id,
        action: "TASK_CREATED",
        metadata: {
          subTaskId: subTask.id,
          subTaskKey: subTask.taskKey,
          title: subTask.title,
        },
      },
    });

    return apiSuccess({ subTask }, 201);
  } catch (error) {
    console.error("Failed to create subtask:", error);
    return apiError("Could not create subtask.", "INTERNAL_ERROR", 500);
  }
}
