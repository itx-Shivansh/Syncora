import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  revokeRefreshToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let refreshToken: string | undefined;

    // Check request headers
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${REFRESH_COOKIE_NAME}=([^;]*)`));
      if (match) refreshToken = decodeURIComponent(match[1]);
    }

    if (!refreshToken) {
      try {
        const cookieStore = cookies();
        refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
      } catch {
        // Outside Next request scope
      }
    }

    if (!refreshToken) {
      try {
        const body = await request.clone().json();
        if (body?.refreshToken) {
          refreshToken = body.refreshToken;
        }
      } catch {
        // No body
      }
    }

    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );

    // Clear authentication cookies
    response.cookies.set(ACCESS_COOKIE_NAME, "", getCookieOptions(0));
    response.cookies.set(REFRESH_COOKIE_NAME, "", getCookieOptions(0));

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during logout",
        },
      },
      { status: 500 }
    );
  }
}
