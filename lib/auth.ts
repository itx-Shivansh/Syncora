import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// Cookie configurations
export const ACCESS_COOKIE_NAME = "syncora_access_token";
export const REFRESH_COOKIE_NAME = "syncora_refresh_token";

// Expiration lifetimes
export const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes in seconds

export const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  name: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
}

/**
 * Returns Uint8Array encoded secret for jose JWT signing and verification.
 */
export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || "syncora-development-jwt-secret-key-32-chars-long";
  return new TextEncoder().encode(secret);
}

/**
 * Hash a plain text password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain text password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a SHA-256 hash for raw refresh tokens before database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Signs a short-lived access JWT.
 */
export async function signAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecretKey());
}

/**
 * Signs a longer-lived refresh JWT with a unique jti identifier.
 */
export async function signRefreshToken(payload: TokenPayload, tokenId: string): Promise<string> {
  return new SignJWT({ ...payload, jti: tokenId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getJwtSecretKey());
}

/**
 * Verifies and decodes a JWT token. Returns null if invalid or expired.
 */
export async function verifyJwtToken<T = TokenPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Issues new access and refresh token pair, recording the hashed refresh token in PostgreSQL.
 */
export async function issueTokenPair(user: { id: string; email: string; name: string }) {
  const tokenId = crypto.randomUUID();
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload, tokenId),
  ]);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      tokenHash,
      userId: user.id,
      expiresAt,
      revoked: false,
    },
  });

  return { accessToken, refreshToken, expiresAt };
}

/**
 * Rotates an existing valid refresh token: revokes the old one and issues a new pair.
 */
export async function rotateRefreshToken(oldRefreshToken: string) {
  const payload = await verifyJwtToken<TokenPayload & { jti: string }>(oldRefreshToken);
  if (!payload || !payload.sub) {
    return null;
  }

  const oldTokenHash = hashToken(oldRefreshToken);
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: oldTokenHash },
    include: { user: true },
  });

  // If token not found, already revoked, or expired -> invalidate and reject
  if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
    if (tokenRecord && !tokenRecord.revoked) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { revoked: true },
      });
    }
    return null;
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revoked: true },
  });

  // Issue brand new token pair
  return issueTokenPair({
    id: tokenRecord.user.id,
    email: tokenRecord.user.email,
    name: tokenRecord.user.name,
  });
}

/**
 * Revokes a refresh token in the database upon user logout.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cookie options helper for consistent secure attributes.
 */
export function getCookieOptions(maxAge: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * The single source of truth for "who is logged in" on the server.
 * Verifies cryptographic signature and expiry, then queries the active user.
 * Supports optional Request parameter for route handlers and test harnesses.
 */
export async function getCurrentUser(req?: Request): Promise<SafeUser | null> {
  try {
    let accessToken: string | undefined;

    if (req) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`(?:^|; )${ACCESS_COOKIE_NAME}=([^;]*)`));
        if (match) {
          accessToken = decodeURIComponent(match[1]);
        }
      }
    }

    if (!accessToken) {
      try {
        const cookieStore = cookies();
        accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
      } catch {
        // Outside Next.js request context (e.g. unit test runner)
      }
    }

    if (!accessToken) {
      return null;
    }

    const payload = await verifyJwtToken<TokenPayload>(accessToken);
    if (!payload || !payload.sub) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}
