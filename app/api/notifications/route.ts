import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * GET /api/notifications
 * Lists notifications for the current authenticated user.
 * Supports pagination, unread filter, and workspace scoping.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const workspaceId = searchParams.get("workspaceId") || undefined;

  const whereClause: {
    recipientId: string;
    isRead?: boolean;
    workspaceId?: string;
  } = {
    recipientId: user.id,
    ...(unreadOnly ? { isRead: false } : {}),
    ...(workspaceId ? { workspaceId } : {}),
  };

  try {
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({
        where: {
          recipientId: user.id,
          isRead: false,
          ...(workspaceId ? { workspaceId } : {}),
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return apiSuccess({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Failed to list notifications:", error);
    return apiError("Could not retrieve notifications.", "INTERNAL_ERROR", 500);
  }
}
