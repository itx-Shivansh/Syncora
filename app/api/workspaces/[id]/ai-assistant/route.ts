import { getCurrentUser } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/workspace-auth";
import { apiSuccess, apiError } from "@/lib/api";
import { checkAiRateLimit, fetchWorkspaceContext, executeGroundedAiQuery } from "@/lib/ai-assistant";
import { z } from "zod";

interface RouteParams {
  params: { id: string };
}

const aiQuerySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty.")
    .max(1000, "Message is too long (maximum 1000 characters)."),
});

/**
 * POST /api/workspaces/:id/ai-assistant
 *
 * Grounded Workspace Intelligence Query Endpoint (Chunk 16)
 *
 * Takes a natural-language query from the user, securely retrieves live operational
 * data strictly scoped to the authorized workspace (and caller's project visibility),
 * rate-limits callers, and returns a factual, grounded response.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError("Authentication required.", "UNAUTHORIZED", 401);
  }

  const workspaceId = params.id;
  const auth = await requireWorkspaceMember(user.id, workspaceId, "VIEWER");
  if (!auth.authorized) {
    return apiError(auth.message, auth.code, auth.status);
  }

  // Rate limiting (15 requests/minute per user/workspace)
  const rateLimit = checkAiRateLimit(user.id, workspaceId);
  if (!rateLimit.allowed) {
    return apiError(
      `Rate limit exceeded. Please wait ${rateLimit.retryAfter || 60} seconds before asking another question.`,
      "RATE_LIMIT_EXCEEDED",
      429
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON payload.", "INVALID_INPUT", 400);
  }

  const parseResult = aiQuerySchema.safeParse(body);
  if (!parseResult.success) {
    return apiError(
      parseResult.error.issues[0]?.message || "Validation failed.",
      "VALIDATION_ERROR",
      422
    );
  }

  try {
    const context = await fetchWorkspaceContext(workspaceId, user.id);
    if (!context) {
      return apiError("Workspace not found.", "NOT_FOUND", 404);
    }

    const { answer, modelUsed } = await executeGroundedAiQuery(parseResult.data.message, context);

    return apiSuccess({
      answer,
      modelUsed,
      contextSummary: {
        workspaceName: context.workspace.name,
        monitoredProjects: context.projects.length,
        accessibleTasks: context.tasks.length,
      },
    });
  } catch (error) {
    console.error("[ai-assistant/query] Error:", error);
    return apiError("Could not process your question. Please try again.", "INTERNAL_ERROR", 500);
  }
}
