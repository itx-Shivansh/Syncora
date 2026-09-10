import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { notifyTaskCommentStakeholders } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Comment content cannot be empty" })
    .max(5000, { message: "Comment cannot exceed 5000 characters" }),
  parentId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/tasks/:id/comments
 * Lists all comments for a task.
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
    const comments = await prisma.comment.findMany({
      where: { taskId: task.id },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return apiSuccess({ comments });
  } catch (error) {
    console.error("Failed to list comments:", error);
    return apiError("Could not retrieve comments.", "INTERNAL_ERROR", 500);
  }
}

/**
 * POST /api/tasks/:id/comments
 * Adds a comment or threaded reply to a task.
 * Logs COMMENT_ADDED ActivityEvent.
 */
export async function POST(req: Request, { params }: RouteParams) {
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

  const auth = await requireWorkspaceMember(user.id, task.workspaceId, "MEMBER");
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
    return apiError("Invalid JSON body.", "BAD_REQUEST", 400);
  }

  const parseResult = createCommentSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed",
      "VALIDATION_ERROR",
      422,
      parseResult.error.flatten().fieldErrors
    );
  }

  const data = parseResult.data;

  // Verify parent comment exists if replying
  if (data.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: data.parentId },
    });
    if (!parentComment || parentComment.taskId !== task.id) {
      return apiError("Parent comment not found on this task.", "BAD_REQUEST", 400);
    }
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        authorId: user.id,
        parentId: data.parentId || null,
        content: data.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Write ActivityEvent
    await prisma.activityEvent.create({
      data: {
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
        actorId: user.id,
        action: "COMMENT_ADDED",
        metadata: {
          taskKey: task.taskKey,
          commentId: comment.id,
          isReply: Boolean(data.parentId),
        },
      },
    });

    // Notify stakeholders (creator, assignee, prior commenters)
    await notifyTaskCommentStakeholders({
      workspaceId: task.workspaceId,
      taskId: task.id,
      taskKey: task.taskKey,
      taskTitle: task.title,
      creatorId: task.creatorId,
      assigneeId: task.assigneeId,
      commentId: comment.id,
      commentSnippet: comment.content,
      isReply: Boolean(data.parentId),
      actorId: user.id,
      actorName: user.name,
    });

    return apiSuccess({ comment }, 201);
  } catch (error) {
    console.error("Failed to create comment:", error);
    return apiError("Could not create comment.", "INTERNAL_ERROR", 500);
  }
}
