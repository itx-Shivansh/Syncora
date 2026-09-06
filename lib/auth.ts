/**
 * Authentication and session utilities placeholder.
 * Full custom JWT implementation to be scaffolded in Chunk 3.
 */

export interface AuthSession {
  userId: string;
  email: string;
  role?: string;
}

export const AUTH_COOKIE_NAME = "syncora_session";
