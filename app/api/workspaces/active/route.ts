import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * GET /api/workspaces/active
 * Returns the "active" workspace context for the authenticated user.
 *
 * This endpoint drives the workspace switcher UI. It returns:
 *   - The user's list of workspaces (same as GET /api/workspaces)
 *   - A `hasWorkspaces` boolean — falsy triggers the onboarding flow
 *
 * The client stores the last-used workspace ID in Zustand / localStorage;
 * this endpoint just provides the full membership list for the switcher.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          plan: true,
          _count: {
            select: { members: true, projects: true },
          },
        },
      },
    },
    orderBy: { workspace: { name: "asc" } },
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logoUrl: m.workspace.logoUrl,
    plan: m.workspace.plan,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  return apiSuccess({
    hasWorkspaces: workspaces.length > 0,
    workspaces,
  });
}
