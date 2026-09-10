import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { requireWorkspaceMember } from "@/lib/workspace-auth";

type RouteContext = { params: { id: string } };

/**
 * GET /api/workspaces/:id/invites
 * Returns a paginated list of all members (including ACTIVE, INVITED, SUSPENDED)
 * in the workspace. Requires at least MEMBER-level access to view.
 *
 * Query params:
 *  - status: filter by WorkspaceInvitationStatus (INVITED | ACTIVE | SUSPENDED)
 */
export async function GET(req: Request, { params }: RouteContext) {
  const { id: workspaceId } = params;

  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  // Any active member can list the workspace roster
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      ...(statusFilter ? { status: statusFilter as "INVITED" | "ACTIVE" | "SUSPENDED" } : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });

  return apiSuccess(
    members.map((m) => ({
      id: m.id,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      user: m.user,
    }))
  );
}
