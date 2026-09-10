import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember, ROLE_RANK } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { addProjectMemberSchema } from "@/lib/validation";
import { notifyProjectMemberAdded } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/projects/:id/members
 * Add an active workspace member to the project.
 * Gated to Project LEAD or Workspace ADMIN+.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { members: true },
  });

  if (!project) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, project.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const callerMembership = project.members.find((m) => m.userId === user.id);
  const isLeadOrAdmin =
    callerMembership?.role === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (!isLeadOrAdmin) {
    return apiError(
      "Only project leads or workspace administrators can add project members.",
      "FORBIDDEN",
      403
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = addProjectMemberSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422
    );
  }

  const { userId, role } = parseResult.data;

  // Confirm target user is an active workspace member
  const targetWsMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: project.workspaceId,
        userId,
      },
    },
  });

  if (!targetWsMember || targetWsMember.status !== "ACTIVE") {
    return apiError(
      "User is not an active member of this workspace.",
      "INVALID_WORKSPACE_MEMBER",
      400
    );
  }

  // Check if user is already a project member
  const existingProjectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId,
      },
    },
  });

  if (existingProjectMember) {
    return apiError("User is already a member of this project.", "CONFLICT", 409);
  }

  try {
    const newMember = await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Notify the added member
    await notifyProjectMemberAdded({
      workspaceId: project.workspaceId,
      projectId: project.id,
      projectName: project.name,
      memberId: userId,
      role,
      actorId: user.id,
      actorName: user.name,
    });

    return apiSuccess({ member: newMember }, 201);
  } catch (error) {
    console.error("Failed to add project member:", error);
    return apiError("Could not add project member.", "INTERNAL_ERROR", 500);
  }
}

/**
 * GET /api/projects/:id/members
 * List all members of a project.
 */
export async function GET(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, workspaceId: true, visibility: true },
  });

  if (!project) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, project.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (
    project.visibility === "PRIVATE" &&
    !members.some((m) => m.userId === user.id) &&
    auth.role !== "OWNER"
  ) {
    return apiError("Project not found.", "NOT_FOUND", 404);
  }

  return apiSuccess({ members });
}
