/**
 * Shared validation utilities and schemas placeholder.
 * Domain Zod schemas to be introduced in subsequent chunks.
 */

export type ValidationResult<T> =
  { success: true; data: T } | { success: false; errors: Record<string, string[]> };
