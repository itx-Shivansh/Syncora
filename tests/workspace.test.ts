/**
 * Workspace Isolation Security Test Suite
 *
 * This is one of the most important test suites in the entire project.
 * It verifies that workspace authorization is airtight: a member of
 * workspace "Acme" must receive 403/404 when attempting to access any
 * resource belonging to workspace "Nova" — and vice versa.
 *
 * Seeded tenants from prisma/seed.ts:
 *   - Acme Corp  (slug: "acme-corp")
 *   - Nova Cloud (slug: "nova-cloud")
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { GET as listWorkspacesHandler } from "@/app/api/workspaces/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteHandler } from "@/app/api/workspaces/[id]/invite/route";
import { GET as listInvitesHandler } from "@/app/api/workspaces/[id]/invites/route";
import { GET as activeWorkspacesHandler } from "@/app/api/workspaces/active/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function registerAndLogin(email: string, password: string, name: string) {
  // Clean up any pre-existing test user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const regReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const regRes = await registerHandler(regReq);
  expect(regRes.status, `Registration failed for ${email}`).toBe(201);

  return getAuthCookie(regRes);
}

function getAuthCookie(res: Response): string {
  const setCookieHeader = res.headers.get("set-cookie") || "";
  const match = setCookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
  expect(match, "Access cookie not found in response").not.toBeNull();
  return `${ACCESS_COOKIE_NAME}=${match![1]}`;
}

function authedRequest(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// -----------------------------------------------------------------------
// Suite
// -----------------------------------------------------------------------

describe("Workspace Isolation & Authorization Security Suite", () => {
  let acmeCookie: string; // Acme-only member
  let novaCookie: string; // Nova-only member
  let acmeWorkspaceId: string;
  let novaWorkspaceId: string;

  const acmeEmail = "acme.owner.isolation@syncora.test";
  const novaEmail = "nova.owner.isolation@syncora.test";
  const testPassword = "IsolationTest2026!";

  beforeAll(async () => {
    // Register two fresh users for isolation testing
    acmeCookie = await registerAndLogin(acmeEmail, testPassword, "Acme Owner");
    novaCookie = await registerAndLogin(novaEmail, testPassword, "Nova Owner");
  });

  // -----------------------------------------------------------------------
  // 1. Workspace creation
  // -----------------------------------------------------------------------

  it("1a. Acme owner can create their workspace", async () => {
    const req = authedRequest("POST", "http://localhost:3000/api/workspaces", acmeCookie, {
      name: "Acme Isolation Corp",
      slug: `acme-isolation-${Date.now()}`,
    });
    const res = await createWorkspaceHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.workspace.name).toBe("Acme Isolation Corp");
    expect(json.data.membership.role).toBe("OWNER");

    acmeWorkspaceId = json.data.workspace.id;
  });

  it("1b. Nova owner can create their workspace", async () => {
    const req = authedRequest("POST", "http://localhost:3000/api/workspaces", novaCookie, {
      name: "Nova Isolation Cloud",
      slug: `nova-isolation-${Date.now()}`,
    });
    const res = await createWorkspaceHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.membership.role).toBe("OWNER");

    novaWorkspaceId = json.data.workspace.id;
  });

  it("1c. Duplicate slug is rejected with 409", async () => {
    // Grab the slug from the Acme workspace
    const ws = await prisma.workspace.findUnique({ where: { id: acmeWorkspaceId } });
    const req = authedRequest("POST", "http://localhost:3000/api/workspaces", acmeCookie, {
      name: "Another Workspace",
      slug: ws!.slug,
    });
    const res = await createWorkspaceHandler(req);
    expect(res.status).toBe(409);

    const json = await res.json();
    expect(json.error.code).toBe("SLUG_TAKEN");
  });

  // -----------------------------------------------------------------------
  // 2. Listing — each user only sees their own workspaces
  // -----------------------------------------------------------------------

  it("2a. Acme owner's workspace list does NOT include Nova workspace", async () => {
    const req = authedRequest("GET", "http://localhost:3000/api/workspaces", acmeCookie);
    const res = await listWorkspacesHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const ids = json.data.map((w: { id: string }) => w.id);
    expect(ids).toContain(acmeWorkspaceId);
    expect(ids).not.toContain(novaWorkspaceId);
  });

  it("2b. Nova owner's workspace list does NOT include Acme workspace", async () => {
    const req = authedRequest("GET", "http://localhost:3000/api/workspaces", novaCookie);
    const res = await listWorkspacesHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    const ids = json.data.map((w: { id: string }) => w.id);
    expect(ids).toContain(novaWorkspaceId);
    expect(ids).not.toContain(acmeWorkspaceId);
  });

  // -----------------------------------------------------------------------
  // 3. Active workspace switcher
  // -----------------------------------------------------------------------

  it("3. /api/workspaces/active returns correct hasWorkspaces flag per tenant", async () => {
    const acmeReq = authedRequest("GET", "http://localhost:3000/api/workspaces/active", acmeCookie);
    const acmeRes = await activeWorkspacesHandler(acmeReq);
    const acmeJson = await acmeRes.json();
    expect(acmeJson.data.hasWorkspaces).toBe(true);

    // A brand-new user with no memberships would get hasWorkspaces=false
    // We simulate by checking the Nova user cannot see Acme's data
    const novaReq = authedRequest("GET", "http://localhost:3000/api/workspaces/active", novaCookie);
    const novaRes = await activeWorkspacesHandler(novaReq);
    const novaJson = await novaRes.json();
    const novaWorkspaceIds = novaJson.data.workspaces.map((w: { id: string }) => w.id);
    expect(novaWorkspaceIds).not.toContain(acmeWorkspaceId);
  });

  // -----------------------------------------------------------------------
  // 4. Cross-tenant invite access (THE critical isolation test)
  // -----------------------------------------------------------------------

  it("4a. Nova member cannot invite users into Acme workspace — must receive 404", async () => {
    // Nova owner does NOT have membership in acmeWorkspaceId
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${acmeWorkspaceId}/invite`,
      novaCookie,
      { email: "attacker@example.com", role: "MEMBER" }
    );
    const res = await inviteHandler(req, { params: { id: acmeWorkspaceId } });

    // Must be 404 (not 403) — never leak workspace existence
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("4b. Acme member cannot list members of Nova workspace — must receive 404", async () => {
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/workspaces/${novaWorkspaceId}/invites`,
      acmeCookie
    );
    const res = await listInvitesHandler(req, { params: { id: novaWorkspaceId } });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  // -----------------------------------------------------------------------
  // 5. Unauthenticated access always returns 401
  // -----------------------------------------------------------------------

  it("5a. Unauthenticated list-workspaces returns 401", async () => {
    const req = new Request("http://localhost:3000/api/workspaces");
    const res = await listWorkspacesHandler(req);
    expect(res.status).toBe(401);
  });

  it("5b. Unauthenticated invite attempt returns 401", async () => {
    const req = new Request(`http://localhost:3000/api/workspaces/${acmeWorkspaceId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hacker@evil.com" }),
    });
    const res = await inviteHandler(req, { params: { id: acmeWorkspaceId } });
    expect(res.status).toBe(401);
  });

  // -----------------------------------------------------------------------
  // 6. Invite role elevation guard
  // -----------------------------------------------------------------------

  it("6. ADMIN cannot escalate an invitee to ADMIN role", async () => {
    // Promote a new member to ADMIN in Acme, then verify they can't grant ADMIN
    const adminEmail = "acme.admin.test@syncora.test";
    const adminExisting = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (adminExisting) {
      await prisma.workspaceMember.deleteMany({ where: { userId: adminExisting.id } });
      await prisma.user.delete({ where: { id: adminExisting.id } });
    }

    // Register admin user
    const adminCookie = await registerAndLogin(adminEmail, testPassword, "Acme Admin");

    // Add them to Acme as ADMIN (owner doing this)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: acmeWorkspaceId,
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    // Now the ADMIN tries to invite someone else as ADMIN — should fail
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${acmeWorkspaceId}/invite`,
      adminCookie,
      { email: "newcomer@example.com", role: "ADMIN" }
    );
    const res = await inviteHandler(req, { params: { id: acmeWorkspaceId } });
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error.code).toBe("INSUFFICIENT_ROLE");
  });

  // -----------------------------------------------------------------------
  // 7. Invite valid user into workspace
  // -----------------------------------------------------------------------

  it("7. OWNER can invite an existing user into their workspace", async () => {
    const newMemberEmail = "new.member.invite@syncora.test";
    // Clean up
    const existing = await prisma.user.findUnique({ where: { email: newMemberEmail } });
    if (existing) {
      await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
    // Register the new user
    await registerAndLogin(newMemberEmail, testPassword, "New Member");

    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${acmeWorkspaceId}/invite`,
      acmeCookie,
      { email: newMemberEmail, role: "MEMBER" }
    );
    const res = await inviteHandler(req, { params: { id: acmeWorkspaceId } });
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.data.status).toBe("added");
    expect(json.data.membership.role).toBe("MEMBER");

    // Verify in DB
    const newUser = await prisma.user.findUniqueOrThrow({ where: { email: newMemberEmail } });
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: acmeWorkspaceId, userId: newUser.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.status).toBe("ACTIVE");
    expect(membership!.role).toBe("MEMBER");
  });

  it("8. Inviting unknown email returns 202 Accepted with pending status", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${acmeWorkspaceId}/invite`,
      acmeCookie,
      { email: "ghost.user.not.registered@example.com", role: "MEMBER" }
    );
    const res = await inviteHandler(req, { params: { id: acmeWorkspaceId } });
    expect(res.status).toBe(202);

    const json = await res.json();
    expect(json.data.status).toBe("pending");
    expect(json.data.pendingEmail).toBe("ghost.user.not.registered@example.com");
  });
});
