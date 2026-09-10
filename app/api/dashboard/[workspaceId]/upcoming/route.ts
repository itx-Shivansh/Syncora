import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/dashboard/:workspaceId/upcoming
 *
 * Returns two lists for the dashboard's timeline section:
 *
 * 1. `upcoming`: Tasks assigned to the current user with dueDate within the
 *    next 7 days (active statuses only), sorted ascending by due date.
 *
 * 2. `recentlyCompleted`: Tasks assigned to the current user that were
 *    updated to DONE or CANCELLED in the last 7 days, sorted descending
 *    by updatedAt. Capped at 10 items.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) return apiError("Authentication required.", "UNAUTHORIZED", 401);

  const { workspaceId } = params;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) return apiError(auth.message, auth.code, auth.status);

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [upcomingRaw, recentlyCompletedRaw] = await Promise.all([
      prisma.task.findMany({
        where: {
          workspaceId,
          assigneeId: user.id,
          status: { notIn: ["DONE", "CANCELLED"] },
          dueDate: { gte: now, lte: sevenDaysFromNow },
        },
        include: {
          project: { select: { id: true, name: true, key: true, color: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 15,
      }),
      prisma.task.findMany({
        where: {
          workspaceId,
          assigneeId: user.id,
          status: { in: ["DONE", "CANCELLED"] },
          updatedAt: { gte: sevenDaysAgo },
        },
        include: {
          project: { select: { id: true, name: true, key: true, color: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
    ]);

    const mapTask = (t: (typeof upcomingRaw)[number]) => ({
      id: t.id,
      taskKey: `${t.project.key}-${t.taskNumber}`,
      taskNumber: t.taskNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null,
      updatedAt: t.updatedAt.toISOString(),
      project: t.project,
    });

    return apiSuccess({
      upcoming: upcomingRaw.map(mapTask),
      recentlyCompleted: recentlyCompletedRaw.map(mapTask),
    });
  } catch (err) {
    console.error("[dashboard/upcoming] Error:", err);
    return apiError("Could not load upcoming tasks.", "INTERNAL_ERROR", 500);
  }
}
