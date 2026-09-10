import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 * Strict recipient authorization: returns 404 if notification not owned by user.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  // Strict anti-probing check: non-existent or not belonging to current user returns 404
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
