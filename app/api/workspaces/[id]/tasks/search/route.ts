import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { TaskStatus, TaskPriority, Prisma } from "@prisma/client";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/workspaces/:id/tasks/search
 *
 * Workspace-wide task & project search and discovery.
 * Supports keyword search across title, description, and taskKey.
 * Combinable filters: status, priority, assigneeId, projectId, labelId, dueDate range.
 * Sorting options: dueDate, priority, updatedAt, createdAt (with asc/desc).
 *
 * SECURITY & ISOLATION:
 * Strictly respects PRIVATE project visibility:
 * Caller must be workspace OWNER, OR the task's project must be PUBLIC_TO_WORKSPACE,
 * OR the caller must be a member of the project. Tasks from private projects that the
 * user is not a member of are NEVER returned.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const workspaceId = params.id;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || url.searchParams.get("q") || "";
  const statusParam = url.searchParams.get("status");
  const priorityParam = url.searchParams.get("priority");
  const assigneeId = url.searchParams.get("assigneeId");
  const projectId = url.searchParams.get("projectId");
  const labelId = url.searchParams.get("labelId");
  const dueDate = url.searchParams.get("dueDate");
  const sort = url.searchParams.get("sort") || "createdAt";
  const order = (url.searchParams.get("order")?.toLowerCase() === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  // Build project visibility boundary filter:
  // If caller is workspace OWNER, they can access all projects in the workspace.
  // Otherwise, only PUBLIC_TO_WORKSPACE or projects where caller is a member.
  const projectVisibilityFilter: Prisma.ProjectWhereInput =
    auth.role === "OWNER"
      ? {}
      : {
          OR: [
            { visibility: "PUBLIC_TO_WORKSPACE" },
            { members: { some: { userId: user.id } } },
          ],
        };

  // Build base Task where clause
  const whereClause: Prisma.TaskWhereInput = {
    workspaceId,
    project: {
      is: {
        workspaceId,
        ...projectVisibilityFilter,
      },
    },
  };

  // 1. Text search across title, description, and taskKey
  if (search.trim()) {
    const term = search.trim();
    whereClause.AND = [
      {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { taskKey: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
  }

  // 2. Status filter (supports single or comma-separated)
  if (statusParam && statusParam !== "ALL") {
    const statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => Object.values(TaskStatus).includes(s as TaskStatus)) as TaskStatus[];
    if (statuses.length > 0) {
      whereClause.status = { in: statuses };
    }
  }

  // 3. Priority filter (supports single or comma-separated)
  if (priorityParam && priorityParam !== "ALL") {
    const priorities = priorityParam
      .split(",")
      .map((p) => p.trim())
      .filter((p) => Object.values(TaskPriority).includes(p as TaskPriority)) as TaskPriority[];
    if (priorities.length > 0) {
      whereClause.priority = { in: priorities };
    }
  }

  // 4. Assignee filter
  if (assigneeId && assigneeId !== "ALL") {
    if (assigneeId === "unassigned") {
      whereClause.assigneeId = null;
    } else {
      whereClause.assigneeId = assigneeId;
    }
  }

  // 5. Project filter
  if (projectId && projectId !== "ALL") {
    whereClause.projectId = projectId;
  }

  // 6. Label filter
  if (labelId && labelId !== "ALL") {
    whereClause.labels = {
      some: { labelId },
    };
  }

  // 7. Due date range filter
  if (dueDate && dueDate !== "all") {
    const now = new Date();
    if (dueDate === "overdue") {
      whereClause.dueDate = { lt: now };
      // Overdue is typically only relevant for active tasks
      whereClause.status = whereClause.status || { notIn: ["DONE", "CANCELLED"] };
    } else if (dueDate === "this-week") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      whereClause.dueDate = {
        gte: today,
        lte: endOfWeek,
      };
    } else if (dueDate === "no-due-date") {
      whereClause.dueDate = null;
    }
  }

  // 8. Sorting
  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
  if (sort === "dueDate") {
    orderBy.push({ dueDate: order });
    orderBy.push({ createdAt: "desc" });
  } else if (sort === "priority") {
    orderBy.push({ priority: order });
    orderBy.push({ createdAt: "desc" });
  } else if (sort === "updatedAt") {
    orderBy.push({ updatedAt: order });
  } else {
    orderBy.push({ createdAt: order });
  }

  try {
    const [tasks, matchingProjects] = await Promise.all([
      prisma.task.findMany({
        where: whereClause,
        include: {
          project: {
            select: { id: true, name: true, key: true, color: true, visibility: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          labels: {
            include: {
              label: { select: { id: true, name: true, color: true } },
            },
          },
          _count: {
            select: { comments: true, subTasks: true },
          },
        },
        orderBy,
        take: 100,
      }),

      // Also search projects by keyword if search term provided
      search.trim()
        ? prisma.project.findMany({
            where: {
              workspaceId,
              ...projectVisibilityFilter,
              OR: [
                { name: { contains: search.trim(), mode: "insensitive" } },
                { key: { contains: search.trim(), mode: "insensitive" } },
                { description: { contains: search.trim(), mode: "insensitive" } },
              ],
            },
            select: {
              id: true,
              name: true,
              key: true,
              color: true,
              status: true,
              visibility: true,
              _count: { select: { tasks: true, members: true } },
            },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    return apiSuccess({
      tasks,
      projects: matchingProjects,
      total: tasks.length,
    });
  } catch (error) {
    console.error("Workspace task search failed:", error);
    return apiError("Failed to search tasks.", "INTERNAL_ERROR", 500);
  }
}
