import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/notifications/:id
 * Retrieve a single notification.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
    include: {
      actor: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  if (!notification || notification.recipientId !== user.id) {
    return apiError("Notification not found.", "NOT_FOUND", 404);
  }

  return apiSuccess({ notification });
}

/**
 * PATCH /api/notifications/:id
 * Marks a single notification as read (or updates read status).
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  if (!notification || notification.recipientId !== user.id) {
    return apiError("Notification not found.", "NOT_FOUND", 404);
  }

  try {
    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return apiSuccess({ notification: updated });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return apiError("Could not update notification.", "INTERNAL_ERROR", 500);
  }
}
