import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/dashboard/:workspaceId/my-tasks
 *
 * Returns all tasks assigned to the current user within the given workspace,
 * including project info and label chips. Sorted by:
 *   1. Overdue first (dueDate < now, active statuses)
 *   2. Then by priority (URGENT → LOW)
 *   3. Then by dueDate ascending (soonest first)
 *
 * Query params:
 *   ?sort=priority|dueDate  (default: priority)
 *   ?group=dueDate|priority (optional, frontend handles grouping)
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) return apiError("Authentication required.", "UNAUTHORIZED", 401);

  const { workspaceId } = params;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) return apiError(auth.message, auth.code, auth.status);

  try {
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        assigneeId: user.id,
        status: { notIn: ["DONE", "CANCELLED"] },
      },
      include: {
        project: {
          select: { id: true, name: true, key: true, color: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        labels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
        _count: { select: { comments: true, subTasks: true } },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    const now = new Date();
    const enriched = tasks.map((t) => ({
      ...t,
      taskKey: `${t.project.key}-${t.taskNumber}`,
      isOverdue:
        t.dueDate !== null &&
        new Date(t.dueDate) < now &&
        t.status !== "DONE" &&
        t.status !== "CANCELLED",
      dueDate: t.dueDate?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    // Sort: overdue first, then by priority rank, then by due date
    const PRIORITY_RANK: Record<string, number> = {
      URGENT: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    enriched.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      if (a.dueDate && b.dueDate)
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });

    return apiSuccess({ tasks: enriched, total: enriched.length });
  } catch (err) {
    console.error("[dashboard/my-tasks] Error:", err);
    return apiError("Could not load tasks.", "INTERNAL_ERROR", 500);
  }
}
