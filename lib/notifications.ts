import { prisma } from "@/lib/db";
import { NotificationType, Prisma } from "@prisma/client";

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

interface CreateNotificationParams {
  workspaceId: string;
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  resourceType: "TASK" | "PROJECT" | "WORKSPACE" | string;
  resourceId: string;
  title: string;
  message: string;
}

/**
 * Creates a notification safely.
 * Returns the created notification, or null if creation failed or recipient is the actor.
 */
export async function createNotification(
  params: CreateNotificationParams,
  client: PrismaClientOrTx = prisma
) {
  // Never notify oneself
  if (params.actorId && params.recipientId === params.actorId) {
    return null;
  }

  try {
    return await client.notification.create({
      data: {
        workspaceId: params.workspaceId,
        recipientId: params.recipientId,
        actorId: params.actorId ?? null,
        type: params.type,
        resourceType: params.resourceType.toUpperCase(),
        resourceId: params.resourceId,
        title: params.title,
        message: params.message,
      },
    });
  } catch (error) {
    console.error("[Notification] Failed to create notification:", error);
    return null;
  }
}

/**
 * Emit a notification when a user is assigned to a task.
 */
export async function notifyTaskAssigned({
  workspaceId,
  taskId,
  taskKey,
  taskTitle,
  assigneeId,
  actorId,
  actorName,
  client = prisma,
}: {
  workspaceId: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  assigneeId: string;
  actorId: string;
  actorName: string;
  client?: PrismaClientOrTx;
}) {
  if (!assigneeId || assigneeId === actorId) return null;

  return createNotification(
    {
      workspaceId,
      recipientId: assigneeId,
      actorId,
      type: "TASK_ASSIGNED",
      resourceType: "TASK",
      resourceId: taskId,
      title: "Task Assigned",
      message: `${actorName} assigned you to ${taskKey}: ${taskTitle}`,
    },
    client
  );
}

/**
 * Emit a notification when a task's status changes to the task's assignee.
 */
export async function notifyTaskStatusChanged({
  workspaceId,
  taskId,
  taskKey,
  newStatus,
  assigneeId,
  actorId,
  actorName,
  client = prisma,
}: {
  workspaceId: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  newStatus: string;
  assigneeId: string | null;
  actorId: string;
  actorName: string;
  client?: PrismaClientOrTx;
}) {
  if (!assigneeId || assigneeId === actorId) return null;

  return createNotification(
    {
      workspaceId,
      recipientId: assigneeId,
      actorId,
      type: "TASK_STATUS_CHANGED",
      resourceType: "TASK",
      resourceId: taskId,
      title: "Task Status Updated",
      message: `${actorName} moved ${taskKey} to ${newStatus}`,
    },
    client
  );
}

/**
 * Emit notifications when a comment is added to a task.
 * Notifies creator, assignee, and prior commenters on the task (excluding the comment author).
 */
export async function notifyTaskCommentStakeholders({
  workspaceId,
  taskId,
  taskKey,
  creatorId,
  assigneeId,
  commentId,
  commentSnippet,
  isReply,
  actorId,
  actorName,
  client = prisma,
}: {
  workspaceId: string;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  creatorId: string;
  assigneeId: string | null;
  commentId: string;
  commentSnippet: string;
  isReply?: boolean;
  actorId: string;
  actorName: string;
  client?: PrismaClientOrTx;
}) {
  // Collect all prior commenters on this task
  const priorComments = await client.comment.findMany({
    where: {
      taskId,
      id: { not: commentId },
    },
    select: { authorId: true },
    distinct: ["authorId"],
  });

  const recipientIds = new Set<string>();

  // Add creator if not author
  if (creatorId && creatorId !== actorId) {
    recipientIds.add(creatorId);
  }

  // Add assignee if not author
  if (assigneeId && assigneeId !== actorId) {
    recipientIds.add(assigneeId);
  }

  // Add prior commenters if not author
  for (const c of priorComments) {
    if (c.authorId !== actorId) {
      recipientIds.add(c.authorId);
    }
  }

  if (recipientIds.size === 0) return [];

  const truncatedSnippet =
    commentSnippet.length > 80 ? `${commentSnippet.slice(0, 77)}...` : commentSnippet;

  const notifications = await Promise.all(
    Array.from(recipientIds).map((recipientId) =>
      createNotification(
        {
          workspaceId,
          recipientId,
          actorId,
          type: isReply ? "COMMENT_REPLY" : "MENTION",
          resourceType: "TASK",
          resourceId: taskId,
          title: isReply ? `Reply on ${taskKey}` : `New comment on ${taskKey}`,
          message: `${actorName}: "${truncatedSnippet}"`,
        },
        client
      )
    )
  );

  return notifications.filter(Boolean);
}

/**
 * Emit a notification when a user is added to a project.
 */
export async function notifyProjectMemberAdded({
  workspaceId,
  projectId,
  projectName,
  memberId,
  role,
  actorId,
  actorName,
  client = prisma,
}: {
  workspaceId: string;
  projectId: string;
  projectName: string;
  memberId: string;
  role: string;
  actorId: string;
  actorName: string;
  client?: PrismaClientOrTx;
}) {
  if (!memberId || memberId === actorId) return null;

  return createNotification(
    {
      workspaceId,
      recipientId: memberId,
      actorId,
      type: "PROJECT_INVITE",
      resourceType: "PROJECT",
      resourceId: projectId,
      title: "Added to Project",
      message: `${actorName} added you to project ${projectName} as ${role}.`,
    },
    client
  );
}
