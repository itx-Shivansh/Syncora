/**
 * Standard API response formatting helpers for route handlers.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function apiError(message: string, code = "BAD_REQUEST", status = 400, details?: unknown) {
  return Response.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status }
  );
}

/**
 * Centralized safe error handler for API route catch blocks.
 * Logs the full error with stack trace server-side, but ensures
 * raw database/Prisma internals or stack traces are never leaked to clients.
 */
export function handleApiError(
  err: unknown,
  fallbackMessage = "An unexpected error occurred. Please try again.",
  status = 500
) {
  console.error("[API_ERROR]", err);
  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: fallbackMessage,
      },
    },
    { status }
  );
}

