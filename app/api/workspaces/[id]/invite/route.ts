import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { inviteMemberSchema } from "@/lib/validation";

type RouteContext = { params: { id: string } };

/**
 * POST /api/workspaces/:id/invite
 * OWNER or ADMIN can invite a user to the workspace by email.
 *
 * Behavior:
 *  - If the email resolves to an existing User → create/upsert a WorkspaceMember
 *    row with status ACTIVE (direct admit) and role from the request body.
 *  - If the email is unknown → create a WorkspaceMember row without a userId?
 *    Per schema design, userId is required (NOT NULL). Therefore for unknown
 *    emails we create a pending WorkspaceMember row keyed to a "ghost" approach
 *    is not viable with the current schema. Instead we return a 202 Accepted
 *    with `pendingEmail` in the payload, signalling the caller that an
 *    out-of-band email flow should be triggered (email sending is outside scope
 *    per spec). We store nothing in the DB for non-existent users until they
 *    self-register and accept; the accept endpoint handles linking.
 *
 * Body: { email: string, role?: "VIEWER" | "MEMBER" | "ADMIN" }
 */
export async function POST(req: Request, { params }: RouteContext) {
  const { id: workspaceId } = params;

  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  // ADMIN or higher required to invite
  const auth = await requireWorkspaceMember(user.id, workspaceId, "ADMIN");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Request body must be valid JSON.", "BAD_REQUEST", 400);
  }

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parsed.error.flatten().fieldErrors
    );
  }

  const { email, role } = parsed.data;

  // OWNERs can invite up to ADMIN; only OWNERs can invite OWNERs (not allowed via API)
  // ADMINs cannot promote to OWNER or ADMIN (only up to MEMBER)
  // This enforces the hierarchy constraint: an ADMIN cannot grant a role >= their own.
  // ADMIN rank = 3; they can assign VIEWER(1) and MEMBER(2).
  if (auth.role === "ADMIN" && role === "ADMIN") {
    return apiError(
      "ADMIN-level members may only invite users as VIEWER or MEMBER.",
      "INSUFFICIENT_ROLE",
      403
    );
  }

  // Check if the invitee is already a member
  const targetUser = await prisma.user.findUnique({ where: { email } });

  if (targetUser) {
    // Prevent inviting the workspace's own actor
    if (targetUser.id === user.id) {
      return apiError("You cannot invite yourself.", "SELF_INVITE", 400);
    }

    // Upsert: if already a member (even suspended), update role; otherwise create
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
    });

    if (existingMembership) {
      if (existingMembership.status === "ACTIVE") {
        return apiError(
          `${email} is already an active member of this workspace.`,
          "ALREADY_MEMBER",
          409
        );
      }
      // Re-activate a suspended/invited member with the new role
      const updated = await prisma.workspaceMember.update({
        where: { id: existingMembership.id },
        data: { role, status: "ACTIVE" },
      });

      await prisma.activityEvent.create({
        data: {
          workspaceId,
          actorId: user.id,
          action: "MEMBER_INVITED",
          metadata: {
            inviteeId: targetUser.id,
            inviteeEmail: email,
            role,
          },
        },
      });

      return apiSuccess(
        {
          status: "reactivated",
          membership: {
            id: updated.id,
            userId: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            role: updated.role,
            memberStatus: updated.status,
          },
        },
        200
      );
    }

    // Brand new member — create directly as ACTIVE
    const newMembership = await prisma.$transaction(async (tx) => {
      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: targetUser.id,
          role,
          status: "ACTIVE",
        },
      });

      await tx.activityEvent.create({
        data: {
          workspaceId,
          actorId: user.id,
          action: "MEMBER_INVITED",
          metadata: {
            inviteeId: targetUser.id,
            inviteeEmail: email,
            role,
          },
        },
      });

      // Create a notification for the invitee
      await tx.notification.create({
        data: {
          workspaceId,
          recipientId: targetUser.id,
          actorId: user.id,
          type: "PROJECT_INVITE",
          resourceType: "WORKSPACE",
          resourceId: workspaceId,
          title: "Workspace Invitation",
          message: `${user.name} added you to a workspace as ${role}.`,
        },
      });

      return membership;
    });

    return apiSuccess(
      {
        status: "added",
        membership: {
          id: newMembership.id,
          userId: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          role: newMembership.role,
          memberStatus: newMembership.status,
        },
      },
      201
    );
  }

  // Unknown email: user doesn't have an account yet.
  // Return 202 Accepted — caller should send an invitation email.
  // No DB record is created until the user registers and accepts.
  return apiSuccess(
    {
      status: "pending",
      pendingEmail: email,
      role,
      message:
        "No Syncora account exists for this email. An invitation email should be sent to prompt sign-up and workspace join.",
    },
    202
  );
}
