import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api";
import { createWorkspaceSchema, resolveWorkspaceSlug } from "@/lib/validation";

/**
 * GET /api/workspaces
 * Returns every workspace the authenticated user is an ACTIVE member of,
 * including their role and basic workspace metadata.
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
          createdAt: true,
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
    createdAt: m.workspace.createdAt,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
    // Viewer's own membership details
    membership: {
      id: m.id,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    },
  }));

  return apiSuccess(workspaces);
}

/**
 * POST /api/workspaces
 * Creates a new workspace and automatically makes the creator the OWNER
 * via a WorkspaceMember row.
 *
 * Body: { name: string, slug?: string }
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

  const parsed = createWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "Validation failed.",
      "VALIDATION_ERROR",
      422,
      parsed.error.flatten().fieldErrors
    );
  }

  const slug = resolveWorkspaceSlug(parsed.data);

  // Check slug uniqueness
  const existing = await prisma.workspace.findUnique({ where: { slug } });
  if (existing) {
    return apiError(
      `The slug "${slug}" is already taken. Choose a different workspace name or provide a custom slug.`,
      "SLUG_TAKEN",
      409
    );
  }

  try {
    // Transactionally create workspace + owner membership
    const { workspace, membership } = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: parsed.data.name,
          slug,
        },
      });

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      // Log the WORKSPACE_CREATED activity event
      await tx.activityEvent.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          action: "WORKSPACE_CREATED",
          metadata: { workspaceName: workspace.name, workspaceSlug: workspace.slug },
        },
      });

      return { workspace, membership };
    });

    return apiSuccess(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          logoUrl: workspace.logoUrl,
          plan: workspace.plan,
          createdAt: workspace.createdAt,
          memberCount: 1,
          projectCount: 0,
        },
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt,
        },
      },
      201
    );
  } catch (err) {
    return handleApiError(err, "Could not create workspace. Please try again.");
  }
}
