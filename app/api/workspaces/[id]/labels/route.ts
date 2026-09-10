import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createLabelSchema } from "@/lib/validation";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/workspaces/:id/labels
 * List all labels for a workspace.
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

  const labels = await prisma.label.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });

  return apiSuccess({ labels });
}

/**
 * POST /api/workspaces/:id/labels
 * Create a new label in a workspace.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const workspaceId = params.id;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "MEMBER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = createLabelSchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422
    );
  }

  const { name, color, description } = parseResult.data;

  try {
    const label = await prisma.label.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
      update: {
        color,
        description: description || null,
      },
      create: {
        workspaceId,
        name,
        color,
        description: description || null,
      },
    });

    return apiSuccess({ label }, 201);
  } catch (error) {
    console.error("Failed to create label:", error);
    return apiError("Could not create label.", "INTERNAL_ERROR", 500);
  }
}
