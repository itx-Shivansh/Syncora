import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  rotateRefreshToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  getCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let refreshToken: string | undefined;

    // 1. Try reading from Request cookie headers
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${REFRESH_COOKIE_NAME}=([^;]*)`));
      if (match) {
        refreshToken = decodeURIComponent(match[1]);
      }
    }

    // 2. Try Next.js cookies() helper if available
    if (!refreshToken) {
      try {
        const cookieStore = cookies();
        refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
      } catch {
        // Outside Next.js request context (e.g. test environment)
      }
    }

    // 3. Fallback to JSON body
    if (!refreshToken) {
      try {
        const body = await request.clone().json();
        if (body?.refreshToken) {
          refreshToken = body.refreshToken;
        }
      } catch {
        // Empty or non-JSON body
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Refresh token is required",
          },
        },
        { status: 401 }
      );
    }

    const rotatedTokens = await rotateRefreshToken(refreshToken);

    if (!rotatedTokens) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Refresh token is invalid, expired, or revoked",
          },
        },
        { status: 401 }
      );

      response.cookies.set(ACCESS_COOKIE_NAME, "", getCookieOptions(0));
      response.cookies.set(REFRESH_COOKIE_NAME, "", getCookieOptions(0));

      return response;
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Token refreshed successfully",
      },
      { status: 200 }
    );

    // Set rotated token cookies
    response.cookies.set(
      ACCESS_COOKIE_NAME,
      rotatedTokens.accessToken,
      getCookieOptions(ACCESS_TOKEN_MAX_AGE)
    );
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      rotatedTokens.refreshToken,
      getCookieOptions(REFRESH_TOKEN_MAX_AGE)
    );

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during token refresh",
        },
      },
      { status: 500 }
    );
  }
}
