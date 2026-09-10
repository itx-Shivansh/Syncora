import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * POST /api/notifications/mark-all-read
 * Marks all notifications for the current user as read.
 * Optionally filtered by workspaceId.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  let workspaceId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.workspaceId === "string") {
      workspaceId = body.workspaceId;
    }
  } catch {
    // Body is optional; query params can also provide workspaceId
    const { searchParams } = new URL(req.url);
    workspaceId = searchParams.get("workspaceId") || undefined;
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        recipientId: user.id,
        isRead: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return apiSuccess({ updatedCount: result.count });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return apiError("Could not mark notifications as read.", "INTERNAL_ERROR", 500);
  }
}
