import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification count for the current user.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId") || undefined;

  try {
    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: user.id,
        isRead: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
    });

    return apiSuccess({ unreadCount });
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return apiError("Could not retrieve unread count.", "INTERNAL_ERROR", 500);
  }
}
