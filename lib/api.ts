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
