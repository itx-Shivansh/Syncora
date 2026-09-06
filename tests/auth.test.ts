import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as refreshHandler } from "@/app/api/auth/refresh/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { prisma } from "@/lib/db";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  verifyJwtToken,
  rotateRefreshToken,
} from "@/lib/auth";

describe("Authentication & Session Infrastructure Suite", () => {
  const testEmail = "test.architect@syncora.io";
  const testPassword = "StrongPassword2026!";
  const testName = "Test Architect";

  beforeAll(async () => {
    // Ensure clean state for test email
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it("1. successful registration: creates user and sets auth cookies", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe(testEmail);
    expect(json.data.user.name).toBe(testName);
    expect(json.data.user.passwordHash).toBeUndefined(); // Never expose password hash

    // Check cookies set on response
    const setCookieHeader = res.headers.get("set-cookie") || "";
    expect(setCookieHeader).toContain(ACCESS_COOKIE_NAME);
    expect(setCookieHeader).toContain(REFRESH_COOKIE_NAME);
  });

  it("2. duplicate-email rejection: rejects registration with existing email", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Person",
        email: testEmail,
        password: "AnotherPassword123",
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("EMAIL_EXISTS");
  });

  it("3. successful login: verifies credentials and issues token pair", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe(testEmail);
    expect(json.data.user.passwordHash).toBeUndefined();

    // Verify token payload cryptographic signature
    const cookiesSet = res.cookies.getAll();
    const accessCookie = cookiesSet.find((c) => c.name === ACCESS_COOKIE_NAME);
    const refreshCookie = cookiesSet.find((c) => c.name === REFRESH_COOKIE_NAME);

    expect(accessCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();

    const decoded = await verifyJwtToken(accessCookie!.value);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe(testEmail);
  });

  it("4. wrong-password rejection: rejects invalid credentials with 401", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "IncorrectPassword999",
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("5. protected route rejection when unauthenticated: denies unauthenticated me requests", async () => {
    const req = new Request("http://localhost:3000/api/auth/me", { method: "GET" });
    const res = await meHandler(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("6. token refresh: rotates access & refresh tokens and invalidates previous token", async () => {
    // 1. Log in to acquire a fresh refresh token
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginRes = await loginHandler(loginReq);
    const refreshCookie = loginRes.cookies.get(REFRESH_COOKIE_NAME);
    expect(refreshCookie).toBeDefined();
    const initialRefreshToken = refreshCookie!.value;

    // 2. Perform rotation via POST /api/auth/refresh
    const refreshReq = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: initialRefreshToken }),
    });

    const refreshRes = await refreshHandler(refreshReq);
    expect(refreshRes.status).toBe(200);

    const refreshJson = await refreshRes.json();
    expect(refreshJson.success).toBe(true);

    const rotatedCookies = refreshRes.cookies.getAll();
    const newAccessCookie = rotatedCookies.find((c) => c.name === ACCESS_COOKIE_NAME);
    const newRefreshCookie = rotatedCookies.find((c) => c.name === REFRESH_COOKIE_NAME);

    expect(newAccessCookie).toBeDefined();
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie!.value).not.toBe(initialRefreshToken);

    // 3. Confirm old refresh token is now revoked and cannot be reused
    const secondRotation = await rotateRefreshToken(initialRefreshToken);
    expect(secondRotation).toBeNull();
  });
});
