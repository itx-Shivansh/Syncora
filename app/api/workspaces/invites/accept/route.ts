import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { z } from "zod";

const acceptSchema = z.object({
  workspaceId: z.string().uuid({ message: "workspaceId must be a valid UUID" }),
});

/**
 * POST /api/workspaces/invites/accept
 * A future-facing endpoint for email-link invite acceptance flows.
 *
 * When a user is invited but does not yet have an account, they register
 * and then hit this endpoint to link themselves to the pending invitation.
 *
 * Currently this resolves the case where the invite was stored as a
 * placeholder (status INVITED). For now, since we record no DB row for
 * non-existent users (see /api/workspaces/[id]/invite for rationale),
 * this endpoint handles the case where an admin ran the invite AFTER the
 * user registered — the WorkspaceMember row already exists as ACTIVE,
 * so this just confirms membership and returns it.
 *
 * Body: { workspaceId: string }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Request body must be valid JSON.", "BAD_REQUEST", 400);
  }

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parsed.error.flatten().fieldErrors
    );
  }

  const { workspaceId } = parsed.data;

  // Verify the workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });

  if (!workspace) {
    return apiError("Workspace not found.", "WORKSPACE_NOT_FOUND", 404);
  }

  // Check for existing or INVITED membership
  const existingMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });

  if (existingMembership?.status === "ACTIVE") {
    return apiSuccess({
      status: "already_active",
      membership: {
        id: existingMembership.id,
        role: existingMembership.role,
        workspaceId,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      },
    });
  }

  if (existingMembership?.status === "INVITED") {
    const activated = await prisma.workspaceMember.update({
      where: { id: existingMembership.id },
      data: { status: "ACTIVE", joinedAt: new Date() },
    });

    return apiSuccess({
      status: "accepted",
      membership: {
        id: activated.id,
        role: activated.role,
        workspaceId,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      },
    });
  }

  // No pending invite — user was not invited to this workspace
  return apiError(
    "You do not have a pending invitation to this workspace.",
    "NO_PENDING_INVITE",
    403
  );
}
