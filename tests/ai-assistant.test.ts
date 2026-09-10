/**
 * AI Assistant API Integration Test Suite (Chunk 16)
 *
 * Tests the workspace-grounded AI intelligence endpoint:
 *   - POST /api/workspaces/:id/ai-assistant
 *
 * Verifies:
 *   1. 401 on unauthenticated access
 *   2. 404 anti-probing on cross-tenant access (unauthorized user)
 *   3. 422 on empty or invalid message payloads
 *   4. Factual, grounded answers for real questions (e.g. Marcus Vance overdue tasks)
 *   5. Project health queries (e.g. at risk projects)
 *   6. Rate limiting enforcement (15 requests/minute)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as aiAssistantHandler } from "@/app/api/workspaces/[id]/ai-assistant/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";
import { checkAiRateLimit } from "@/lib/ai-assistant";

function getAuthCookie(res: Response): string {
  const setCookieHeader = res.headers.get("set-cookie") ?? "";
  const match = setCookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
  return match ? `${ACCESS_COOKIE_NAME}=${match[1]}` : "";
}

function authedReq(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Workspace AI Assistant API (Chunk 16)", () => {
  let alexCookie: string;
  let outsiderCookie: string;
  let acmeWsId: string;

  beforeAll(async () => {
    // 1. Resolve seeded Acme workspace
    const acmeWs = await prisma.workspace.findFirst({
      where: { slug: "acme-corp" },
    });
    expect(acmeWs).toBeDefined();
    acmeWsId = acmeWs!.id;

    // 2. Login as Alex Chen (Acme Owner)
    const alexRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alex.chen@acme.dev", password: "password123" }),
      })
    );
    expect(alexRes.status).toBe(200);
    alexCookie = getAuthCookie(alexRes);

    // 3. Login as Liam Torres (Nova Labs member, NOT in Acme)
    const liamRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "liam.torres@novalabs.io", password: "password123" }),
      })
    );
    expect(liamRes.status).toBe(200);
    outsiderCookie = getAuthCookie(liamRes);
  });

  it("1. Returns 401 if unauthenticated", async () => {
    const req = new Request(`http://localhost/api/workspaces/${acmeWsId}/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What tasks are overdue?" }),
    });

    const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
    expect(res.status).toBe(401);
  });

  it("2. Returns 404 anti-probing isolation for outsider from another workspace", async () => {
    const req = authedReq(
      "POST",
      `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
      outsiderCookie,
      { message: "What tasks are overdue?" }
    );

    const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
    expect(res.status).toBe(404);
  });

  it("3. Returns 422 if message payload is empty or invalid", async () => {
    const req = authedReq(
      "POST",
      `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
      alexCookie,
      { message: "   " }
    );

    const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
    expect(res.status).toBe(422);
  });

  it("4. Accurately answers 'what tasks does Marcus have overdue?' from real seed data", async () => {
    const req = authedReq(
      "POST",
      `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
      alexCookie,
      { message: "what tasks does Marcus have overdue?" }
    );

    const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data).toHaveProperty("answer");
    const answer = json.data.answer;

    // Must identify Marcus Vance
    expect(answer).toContain("Marcus Vance");
    // Must cite his actual overdue tasks: CORE-2 and BILL-14
    expect(answer).toContain("CORE-2");
    expect(answer).toContain("BILL-14");
    expect(answer).toContain("Core Platform 2.0");
    expect(answer).toContain("Billing & Invoicing V2");
  });

  it("5. Accurately identifies projects at risk (including Billing V2)", async () => {
    const req = authedReq(
      "POST",
      `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
      alexCookie,
      { message: "which projects are at risk?" }
    );

    const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
    expect(res.status).toBe(200);
    const json = await res.json();

    const answer = json.data.answer;
    expect(answer).toContain("Billing & Invoicing V2");
    expect(answer).toContain("BILL");
  });

  it("6. checkAiRateLimit allows 15 queries in 60s window and blocks the 16th", () => {
    const testUserId = "user_rate_test_" + Date.now();
    const testWsId = "ws_rate_test_" + Date.now();

    for (let i = 1; i <= 15; i++) {
      const res = checkAiRateLimit(testUserId, testWsId);
      expect(res.allowed).toBe(true);
      expect(res.retryAfter).toBeUndefined();
    }

    const blocked = checkAiRateLimit(testUserId, testWsId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("7. Route handler returns HTTP 429 when rate limit (15 requests/min) is exceeded", async () => {
    // Login as Sarah Jenkins (Acme Member)
    const sarahRes = await loginHandler(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sarah.jenkins@acme.dev", password: "password123" }),
      })
    );
    expect(sarahRes.status).toBe(200);
    const sarahCookie = getAuthCookie(sarahRes);

    // Send 15 requests — all must succeed (200)
    for (let i = 1; i <= 15; i++) {
      const req = authedReq(
        "POST",
        `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
        sarahCookie,
        { message: `Health overview query #${i}` }
      );
      const res = await aiAssistantHandler(req, { params: { id: acmeWsId } });
      expect(res.status).toBe(200);
    }

    // 16th request must trigger HTTP 429
    const blockedReq = authedReq(
      "POST",
      `http://localhost/api/workspaces/${acmeWsId}/ai-assistant`,
      sarahCookie,
      { message: "This 16th query must be rejected" }
    );
    const blockedRes = await aiAssistantHandler(blockedReq, { params: { id: acmeWsId } });
    expect(blockedRes.status).toBe(429);

    const body = await blockedRes.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.error.message).toContain("Rate limit exceeded");
  });
});
