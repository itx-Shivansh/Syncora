import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { computeProjectHealth } from "@/lib/project-health";

interface RouteParams {
  params: { workspaceId: string };
}

/**
 * GET /api/dashboard/:workspaceId/projects
 *
 * Returns the workspace's active/in-flight projects enriched with:
 *   - taskCounts by status
 *   - progressPercent (DONE / total)
 *   - overdueCount (tasks with dueDate < now and active status)
 *   - health: computed 0-100 Project Health Index with driver reasons
 *   - isAtRisk: boolean flag (preserves backward compatibility)
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) return apiError("Authentication required.", "UNAUTHORIZED", 401);

  const { workspaceId } = params;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) return apiError(auth.message, auth.code, auth.status);

  try {
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        status: { in: ["ACTIVE", "ON_HOLD"] },
        OR: [{ visibility: "PUBLIC_TO_WORKSPACE" }, { members: { some: { userId: user.id } } }],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          take: 5,
          orderBy: { createdAt: "asc" },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { tasks: true, members: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const now = new Date();

    const enriched = projects.map((p) => {
      const rawTasks = p.tasks;

      const taskCounts = rawTasks.reduce((acc: Record<string, number>, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1;
        return acc;
      }, {});

      const totalTasks = rawTasks.length;
      const doneTasks = taskCounts["DONE"] ?? 0;
      const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      const overdueCount = rawTasks.filter(
        (t) =>
          t.dueDate !== null &&
          new Date(t.dueDate) < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;

      // Compute health index and honest driver reasons
      const health = computeProjectHealth({
        id: p.id,
        name: p.name,
        status: p.status,
        targetStartDate: p.targetStartDate,
        targetEndDate: p.targetEndDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        tasks: rawTasks,
      });

      return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name,
        key: p.key,
        description: p.description,
        status: p.status,
        visibility: p.visibility,
        color: p.color,
        ownerId: p.ownerId,
        members: p.members,
        _count: p._count,
        targetStartDate: p.targetStartDate?.toISOString() ?? null,
        targetEndDate: p.targetEndDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        taskCounts,
        totalTasks,
        doneTasks,
        progressPercent,
        overdueCount,
        isAtRisk: health.isAtRisk,
        health,
      };
    });

    return apiSuccess({ projects: enriched });
  } catch (err) {
    console.error("[dashboard/projects] Error:", err);
    return apiError("Could not load projects.", "INTERNAL_ERROR", 500);
  }
}
