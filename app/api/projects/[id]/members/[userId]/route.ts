import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember, ROLE_RANK } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { updateProjectMemberRoleSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string; userId: string };
}

/**
 * PATCH /api/projects/:id/members/:userId
 * Update a project member's role (LEAD, MEMBER, VIEWER).
 * Gated to Project LEAD or Workspace ADMIN+.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
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
      "Only project leads or workspace administrators can modify project roles.",
      "FORBIDDEN",
      403
    );
  }

  const targetMembership = project.members.find((m) => m.userId === params.userId);
  if (!targetMembership) {
    return apiError("Member not found in this project.", "NOT_FOUND", 404);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = updateProjectMemberRoleSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422
    );
  }

  const { role } = parseResult.data;

  // Prevent removing the last LEAD
  if (targetMembership.role === "LEAD" && role !== "LEAD") {
    const leadCount = project.members.filter((m) => m.role === "LEAD").length;
    if (leadCount <= 1) {
      return apiError(
        "Project must have at least one LEAD. Promote another member before downgrading this lead.",
        "CANNOT_DEMOTE_LAST_LEAD",
        400
      );
    }
  }

  try {
    const updated = await prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: params.userId,
        },
      },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return apiSuccess({ member: updated });
  } catch (error) {
    console.error("Failed to update project member role:", error);
    return apiError("Could not update member role.", "INTERNAL_ERROR", 500);
  }
}

/**
 * DELETE /api/projects/:id/members/:userId
 * Remove a member from the project.
 * Gated to Project LEAD, Workspace ADMIN+, or self-removal.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
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

  const isSelf = user.id === params.userId;
  const callerMembership = project.members.find((m) => m.userId === user.id);
  const isLeadOrAdmin =
    callerMembership?.role === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  if (!isSelf && !isLeadOrAdmin) {
    return apiError(
      "Only project leads, workspace administrators, or the user themselves can remove project membership.",
      "FORBIDDEN",
      403
    );
  }

  const targetMembership = project.members.find((m) => m.userId === params.userId);
  if (!targetMembership) {
    return apiError("Member not found in this project.", "NOT_FOUND", 404);
  }

  // Prevent removing the last LEAD if there are other members
  if (targetMembership.role === "LEAD") {
    const leadCount = project.members.filter((m) => m.role === "LEAD").length;
    if (leadCount <= 1 && project.members.length > 1) {
      return apiError(
        "Cannot remove the only LEAD while other members exist. Assign a new LEAD first.",
        "CANNOT_REMOVE_LAST_LEAD",
        400
      );
    }
  }

  try {
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: params.userId,
        },
      },
    });

    return apiSuccess({ removed: true, userId: params.userId });
  } catch (error) {
    console.error("Failed to remove project member:", error);
    return apiError("Could not remove project member.", "INTERNAL_ERROR", 500);
  }
}
