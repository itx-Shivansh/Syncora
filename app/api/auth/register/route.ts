import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  issueTokenPair,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  getCookieOptions,
} from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid registration payload",
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // Check for existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_EXISTS",
            message: "An account with this email already exists",
          },
        },
        { status: 409 }
      );
    }

    // Hash password and persist user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Issue initial token pair
    const { accessToken, refreshToken } = await issueTokenPair(user);

    const response = NextResponse.json(
      {
        success: true,
        data: { user },
      },
      { status: 201 }
    );

    // Set secure httpOnly cookies
    response.cookies.set(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      refreshToken,
      getCookieOptions(REFRESH_TOKEN_MAX_AGE)
    );

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during registration",
        },
      },
      { status: 500 }
    );
  }
}
