/**
 * Project Management & Authorization Security Suite
 *
 * Verifies:
 *   1. Project creation with key derivation & duplicate key rejection (409)
 *   2. Validation failures (422) on invalid payloads
 *   3. PRIVATE project visibility enforcement:
 *      - Private project appears only to its members in workspace project list
 *      - Direct GET /api/projects/:id by non-member workspace peer returns 404
 *   4. Cross-tenant isolation:
 *      - User from different workspace receives 404 on project access
 *   5. Role-gated DELETE & PATCH:
 *      - Project MEMBER cannot delete project (403)
 *      - Project LEAD / Workspace ADMIN can update and delete project
 *   6. Project Member management:
 *      - Project LEAD can add an active workspace member (201)
 *      - Adding non-workspace member is rejected (400)
 *      - Project LEAD can change member role (200)
 *      - Project member can be removed (200)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteWorkspaceMemberHandler } from "@/app/api/workspaces/[id]/invite/route";
import {
  POST as createProjectHandler,
  GET as listProjectsHandler,
} from "@/app/api/workspaces/[id]/projects/route";
import {
  GET as getProjectHandler,
  PATCH as patchProjectHandler,
  DELETE as deleteProjectHandler,
} from "@/app/api/projects/[id]/route";
import {
  GET as listProjectMembersHandler,
  POST as addProjectMemberHandler,
} from "@/app/api/projects/[id]/members/route";
import {
  PATCH as patchProjectMemberHandler,
  DELETE as deleteProjectMemberHandler,
} from "@/app/api/projects/[id]/members/[userId]/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";

// -----------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------

async function registerAndLogin(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    await prisma.projectMember.deleteMany({ where: { userId: existing.id } });
    await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
    await prisma.project.deleteMany({ where: { ownerId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const regReq = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const regRes = await registerHandler(regReq);
  expect(regRes.status).toBe(201);
  const data = await regRes.json();

  return {
    cookie: getAuthCookie(regRes),
    user: data.data.user,
  };
}

function getAuthCookie(res: Response): string {
  const setCookieHeader = res.headers.get("set-cookie") || "";
  const match = setCookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
  expect(match).not.toBeNull();
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
// Test Suite
// -----------------------------------------------------------------------

describe("Project Management & Security Integration Suite", () => {
  let ownerCookie: string;
  let ownerUser: { id: string; name: string; email: string };

  let peerMemberCookie: string; // Member of same workspace, but not project
  let peerMemberUser: { id: string; name: string; email: string };

  let outsiderCookie: string; // Member of a different workspace
  let outsiderUser: { id: string; name: string; email: string };

  let workspaceId: string;
  let outsiderWorkspaceId: string;

  const testPassword = "ProjectTestPass2026!";

  beforeAll(async () => {
    // 1. Create Workspace Owner
    const ownerRes = await registerAndLogin(
      `proj.owner.${Date.now()}@syncora.test`,
      testPassword,
      "Project Owner"
    );
    ownerCookie = ownerRes.cookie;
    ownerUser = ownerRes.user;

    // 2. Create Workspace Peer (added to same workspace as standard MEMBER)
    const peerRes = await registerAndLogin(
      `proj.peer.${Date.now()}@syncora.test`,
      testPassword,
      "Peer Member"
    );
    peerMemberCookie = peerRes.cookie;
    peerMemberUser = peerRes.user;

    // 3. Create Outsider (in another workspace)
    const outsiderRes = await registerAndLogin(
      `proj.outsider.${Date.now()}@syncora.test`,
      testPassword,
      "Outsider"
    );
    outsiderCookie = outsiderRes.cookie;
    outsiderUser = outsiderRes.user;

    // 4. Owner creates main workspace
    const wsReq = authedRequest("POST", "http://localhost:3000/api/workspaces", ownerCookie, {
      name: "Project Test Workspace",
      slug: `proj-test-${Date.now()}`,
    });
    const wsRes = await createWorkspaceHandler(wsReq);
    expect(wsRes.status).toBe(201);
    const wsJson = await wsRes.json();
    workspaceId = wsJson.data.workspace.id;

    // 5. Add peer member to main workspace
    const inviteReq = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/invite`,
      ownerCookie,
      { email: peerMemberUser.email, role: "MEMBER" }
    );
    const inviteRes = await inviteWorkspaceMemberHandler(inviteReq, {
      params: { id: workspaceId },
    });
    expect(inviteRes.status).toBe(201);

    // 6. Outsider creates their own workspace
    const outsiderWsReq = authedRequest(
      "POST",
      "http://localhost:3000/api/workspaces",
      outsiderCookie,
      { name: "Outsider Corp", slug: `outsider-corp-${Date.now()}` }
    );
    const outsiderWsRes = await createWorkspaceHandler(outsiderWsReq);
    expect(outsiderWsRes.status).toBe(201);
    const outsiderWsJson = await outsiderWsRes.json();
    outsiderWorkspaceId = outsiderWsJson.data.workspace.id;
  });

  // ---------------------------------------------------------------------
  // 1. Creation & Key Uniqueness
  // ---------------------------------------------------------------------

  let createdProjectId: string;

  it("1a. Workspace member can create a project and is assigned LEAD role", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "Alpha Architecture",
        key: "ALPHA",
        description: "Core architectural redesign",
        status: "ACTIVE",
        visibility: "PUBLIC_TO_WORKSPACE",
      }
    );
    const res = await createProjectHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.project.name).toBe("Alpha Architecture");
    expect(json.data.project.key).toBe("ALPHA");
    expect(json.data.project.members[0].userId).toBe(ownerUser.id);
    expect(json.data.project.members[0].role).toBe("LEAD");

    createdProjectId = json.data.project.id;
  });

  it("1b. Rejects duplicate project key in the same workspace with 409", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "Alpha Duplicate",
        key: "ALPHA", // Duplicate key in same workspace
      }
    );
    const res = await createProjectHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("PROJECT_KEY_CONFLICT");
  });

  it("1c. Rejects invalid project payload with 422", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "", // Name too short
      }
    );
    const res = await createProjectHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(422);
  });

  // ---------------------------------------------------------------------
  // 2. Private Project Visibility Enforcement
  // ---------------------------------------------------------------------

  let privateProjectId: string;

  it("2a. Owner can create a PRIVATE project", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "Secret Initiative",
        key: "SECRET",
        visibility: "PRIVATE",
      }
    );
    const res = await createProjectHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(201);
    const json = await res.json();
    privateProjectId = json.data.project.id;
    expect(json.data.project.visibility).toBe("PRIVATE");
  });

  it("2b. Workspace peer who is NOT a project member cannot see PRIVATE project in list", async () => {
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      peerMemberCookie
    );
    const res = await listProjectsHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    const projectKeys = json.data.projects.map((p: { key: string }) => p.key);

    // Peer should see public ALPHA project, but NOT private SECRET project
    expect(projectKeys).toContain("ALPHA");
    expect(projectKeys).not.toContain("SECRET");
  });

  it("2c. Direct GET of PRIVATE project by non-member workspace peer returns 404", async () => {
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/projects/${privateProjectId}`,
      peerMemberCookie
    );
    const res = await getProjectHandler(req, { params: { id: privateProjectId } });
    // Returns 404 (not 403) to prevent private project existence discovery
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------
  // 3. Cross-Tenant Isolation
  // ---------------------------------------------------------------------

  it("3a. User from different workspace receives 404 when listing another workspace's projects", async () => {
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      outsiderCookie
    );
    const res = await listProjectsHandler(req, { params: { id: workspaceId } });
    expect(res.status).toBe(404);
  });

  it("3b. User from different workspace receives 404 on direct project GET", async () => {
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/projects/${createdProjectId}`,
      outsiderCookie
    );
    const res = await getProjectHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------
  // 4. Project Membership Management
  // ---------------------------------------------------------------------

  it("4a. Project LEAD can add a workspace peer to the project", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/projects/${createdProjectId}/members`,
      ownerCookie,
      {
        userId: peerMemberUser.id,
        role: "MEMBER",
      }
    );
    const res = await addProjectMemberHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.member.userId).toBe(peerMemberUser.id);
    expect(json.data.member.role).toBe("MEMBER");
  });

  it("4a-ii. GET /projects/:id/members returns all project members (endpoint used by CreateTaskDialog assignee dropdown)", async () => {
    // This test guards against the regression fixed in CreateTaskDialog:
    // the dialog was using the wrong cache key and reading .members off a
    // { project: {...} } shape, always getting undefined.
    // The dialog now calls GET /api/projects/:id/members directly.
    const req = authedRequest(
      "GET",
      `http://localhost:3000/api/projects/${createdProjectId}/members`,
      ownerCookie
    );
    const res = await listProjectMembersHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(200);
    const json = await res.json();

    const members = json.data.members as Array<{
      userId: string;
      role: string;
      user: { id: string; name: string; email: string };
    }>;

    // Must be an array
    expect(Array.isArray(members)).toBe(true);

    // Must include the owner (auto-added as LEAD on project creation)
    const ownerEntry = members.find((m) => m.userId === ownerUser.id);
    expect(ownerEntry).toBeDefined();
    expect(ownerEntry!.role).toBe("LEAD");
    expect(ownerEntry!.user.name).toBeTruthy();
    expect(ownerEntry!.user.email).toBeTruthy();

    // Must include the peer member (added in 4a)
    const peerEntry = members.find((m) => m.userId === peerMemberUser.id);
    expect(peerEntry).toBeDefined();
    expect(peerEntry!.role).toBe("MEMBER");
    expect(peerEntry!.user.name).toBeTruthy();

    // Must NOT include the outsider (never added to this project)
    const outsiderEntry = members.find((m) => m.userId === outsiderUser.id);
    expect(outsiderEntry).toBeUndefined();
  });

  it("4b. Adding a non-workspace member to project is rejected with 400", async () => {
    const req = authedRequest(
      "POST",
      `http://localhost:3000/api/projects/${createdProjectId}/members`,
      ownerCookie,
      {
        userId: outsiderUser.id, // Not a member of this workspace
        role: "MEMBER",
      }
    );
    const res = await addProjectMemberHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(400);
  });

  it("4c. Project LEAD can change member role to VIEWER", async () => {
    const req = authedRequest(
      "PATCH",
      `http://localhost:3000/api/projects/${createdProjectId}/members/${peerMemberUser.id}`,
      ownerCookie,
      { role: "VIEWER" }
    );
    const res = await patchProjectMemberHandler(req, {
      params: { id: createdProjectId, userId: peerMemberUser.id },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.member.role).toBe("VIEWER");
  });

  it("4d. Project member cannot delete the project (403)", async () => {
    const req = authedRequest(
      "DELETE",
      `http://localhost:3000/api/projects/${createdProjectId}`,
      peerMemberCookie // peer is VIEWER in project, MEMBER in workspace -> cannot delete
    );
    const res = await deleteProjectHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(403);
  });

  it("4e. Project LEAD can remove a member from the project", async () => {
    const req = authedRequest(
      "DELETE",
      `http://localhost:3000/api/projects/${createdProjectId}/members/${peerMemberUser.id}`,
      ownerCookie
    );
    const res = await deleteProjectMemberHandler(req, {
      params: { id: createdProjectId, userId: peerMemberUser.id },
    });
    expect(res.status).toBe(200);
  });

  // ---------------------------------------------------------------------
  // 5. Update & Delete
  // ---------------------------------------------------------------------

  it("5a. Project LEAD can update status and description", async () => {
    const req = authedRequest(
      "PATCH",
      `http://localhost:3000/api/projects/${createdProjectId}`,
      ownerCookie,
      {
        status: "COMPLETED",
        description: "Updated project description",
      }
    );
    const res = await patchProjectHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.project.status).toBe("COMPLETED");
    expect(json.data.project.description).toBe("Updated project description");
  });

  it("5b. Project LEAD can delete the project", async () => {
    const req = authedRequest(
      "DELETE",
      `http://localhost:3000/api/projects/${createdProjectId}`,
      ownerCookie
    );
    const res = await deleteProjectHandler(req, { params: { id: createdProjectId } });
    expect(res.status).toBe(200);

    // Verify it is gone
    const verifyReq = authedRequest(
      "GET",
      `http://localhost:3000/api/projects/${createdProjectId}`,
      ownerCookie
    );
    const verifyRes = await getProjectHandler(verifyReq, { params: { id: createdProjectId } });
    expect(verifyRes.status).toBe(404);
  });
});
