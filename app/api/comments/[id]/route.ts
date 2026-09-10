import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember, ROLE_RANK } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: { id: string };
}

/**
 * DELETE /api/comments/:id
 * Delete a comment.
 * Restricted to comment author, project LEAD, or workspace ADMIN+.
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    include: {
      task: {
        include: {
          project: {
            include: { members: true },
          },
        },
      },
    },
  });

  if (!comment) {
    return apiError("Comment not found.", "NOT_FOUND", 404);
  }

  const auth = await requireWorkspaceMember(user.id, comment.workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const callerMember = comment.task.project.members.find((m) => m.userId === user.id);
  const callerProjectRole = callerMember ? callerMember.role : null;
  const isLeadOrAdmin = callerProjectRole === "LEAD" || ROLE_RANK[auth.role] >= ROLE_RANK["ADMIN"];

  const isAuthor = comment.authorId === user.id;

  if (!isAuthor && !isLeadOrAdmin) {
    return apiError("You do not have permission to delete this comment.", "FORBIDDEN", 403);
  }

  try {
    await prisma.comment.delete({
      where: { id: comment.id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return apiError("Could not delete comment.", "INTERNAL_ERROR", 500);
  }
}
