/**
 * Workspace Authorization Helpers
 *
 * The single, canonical pattern for enforcing workspace-scoped RBAC across all
 * route handlers and server actions. Every handler that touches workspace-owned
 * resources MUST call requireWorkspaceMember() before touching the database.
 *
 * Role hierarchy (documented in PROJECT_CONTEXT.md § 10):
 *   VIEWER (1) < MEMBER (2) < ADMIN (3) < OWNER (4)
 */

import { prisma } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";

// -----------------------------------------------------------------------
// Numeric rank map — never change the values; higher is more privileged.
// -----------------------------------------------------------------------
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export type AuthorizationResult =
  | { authorized: true; role: WorkspaceRole; memberId: string }
  | { authorized: false; status: 401 | 403 | 404; code: string; message: string };

/**
 * Verifies that `userId` is an ACTIVE member of `workspaceId` with at least
 * `minRole` privilege.
 *
 * Usage pattern (copy-paste into any route handler):
 *
 * ```ts
 * const auth = await requireWorkspaceMember(user.id, workspaceId, "ADMIN");
 * if (!auth.authorized) {
 *   return apiError(auth.message, auth.code, auth.status);
 * }
 * // auth.role is now safe to use
 * ```
 *
 * @param userId      - The authenticated user's ID (from getCurrentUser()).
 * @param workspaceId - The target workspace UUID from the route parameter.
 * @param minRole     - Minimum role required (default: MEMBER). Pass "VIEWER"
 *                      for read-only endpoints that any member can reach.
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = "MEMBER"
): Promise<AuthorizationResult> {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true, role: true, status: true },
  });

  if (!membership) {
    // Return 404 (not 403) to avoid leaking workspace existence to non-members
    return {
      authorized: false,
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
      message: "Workspace not found.",
    };
  }

  if (membership.status !== "ACTIVE") {
    return {
      authorized: false,
      status: 403,
      code: "MEMBERSHIP_INACTIVE",
      message: "Your workspace membership is not active.",
    };
  }

  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    return {
      authorized: false,
      status: 403,
      code: "INSUFFICIENT_ROLE",
      message: `This action requires at least the ${minRole} role.`,
    };
  }

  return { authorized: true, role: membership.role, memberId: membership.id };
}

/**
 * Returns the workspace member record if the user is an active OWNER of the
 * workspace. Convenience wrapper used for ownership-only operations.
 */
export async function requireWorkspaceOwner(
  userId: string,
  workspaceId: string
): Promise<AuthorizationResult> {
  return requireWorkspaceMember(userId, workspaceId, "OWNER");
}
