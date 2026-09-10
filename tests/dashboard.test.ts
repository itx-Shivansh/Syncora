/**
 * Dashboard API Integration Test Suite
 *
 * Tests the four dashboard-specific API routes via direct route handler invocation
 * (no live HTTP server required — follows the same pattern as other test suites):
 *
 *   - GET /api/dashboard/:workspaceId/my-tasks
 *   - GET /api/dashboard/:workspaceId/projects
 *   - GET /api/dashboard/:workspaceId/activity
 *   - GET /api/dashboard/:workspaceId/upcoming
 *
 * Validates: authentication guards, workspace RBAC, response shape,
 * cross-tenant isolation, overdue task ordering, and at-risk heuristic flags.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as createProjectHandler } from "@/app/api/workspaces/[id]/projects/route";
import { POST as createTaskHandler } from "@/app/api/projects/[id]/tasks/route";
import { GET as myTasksHandler } from "@/app/api/dashboard/[workspaceId]/my-tasks/route";
import { GET as dashProjectsHandler } from "@/app/api/dashboard/[workspaceId]/projects/route";
import { GET as activityHandler } from "@/app/api/dashboard/[workspaceId]/activity/route";
import { GET as upcomingHandler } from "@/app/api/dashboard/[workspaceId]/upcoming/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Test helpers (same pattern as comment-activity.test.ts)
// ---------------------------------------------------------------------------

async function cleanAndRegister(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.activityEvent.deleteMany({ where: { actorId: existing.id } });
    await prisma.comment.deleteMany({ where: { authorId: existing.id } });
    await prisma.task.deleteMany({ where: { creatorId: existing.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    await prisma.projectMember.deleteMany({ where: { userId: existing.id } });
    await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
    await prisma.project.deleteMany({ where: { ownerId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const req = new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const res = await registerHandler(req);
  expect(res.status).toBe(201);
  const data = await res.json();
  return {
    cookie: getAuthCookie(res),
    user: data.data.user as { id: string; name: string; email: string },
  };
}

function getAuthCookie(res: Response): string {
  const setCookieHeader = res.headers.get("set-cookie") ?? "";
  const match = setCookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
  expect(match).not.toBeNull();
  return `${ACCESS_COOKIE_NAME}=${match![1]}`;
}

function authedReq(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Suite state
// ---------------------------------------------------------------------------

describe("Dashboard API Suite", () => {
  let ownerCookie: string;
  let ownerId: string;
  let memberCookie: string;
  let outsiderCookie: string;

  let workspaceId: string;
  let projectId: string;
  let overdueTaskId: string;
  let upcomingTaskId: string;

  const PROJECT_KEY = `DSH${Math.floor(Math.random() * 9000 + 1000)}`;

  beforeAll(async () => {
    // 1. Register users
    const ownerRes = await cleanAndRegister(
      `dash-owner-${Date.now()}@test.com`,
      "Test1234!",
      "Dash Owner"
    );
    ownerCookie = ownerRes.cookie;
    ownerId = ownerRes.user.id;

    const memberRes = await cleanAndRegister(
      `dash-member-${Date.now()}@test.com`,
      "Test1234!",
      "Dash Member"
    );
    memberCookie = memberRes.cookie;

    const outsiderRes = await cleanAndRegister(
      `dash-outsider-${Date.now()}@test.com`,
      "Test1234!",
      "Dash Outsider"
    );
    outsiderCookie = outsiderRes.cookie;

    // 2. Create workspace
    const wsRes = await createWorkspaceHandler(
      authedReq("POST", "http://localhost/api/workspaces", ownerCookie, {
        name: `DashTestWS ${Date.now()}`,
        slug: `dash-test-${Date.now()}`,
      })
    );
    expect(wsRes.status).toBe(201);
    const wsJson = await wsRes.json();
    workspaceId = wsJson.data.workspace.id;

    // 3. Invite member
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: memberRes.user.id,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    // 4. Create project with a near deadline (3 days from now)
    const projRes = await createProjectHandler(
      authedReq("POST", `http://localhost/api/workspaces/${workspaceId}/projects`, ownerCookie, {
        name: "Dash Test Project",
        key: PROJECT_KEY,
        status: "ACTIVE",
        visibility: "PUBLIC_TO_WORKSPACE",
        targetEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { params: { id: workspaceId } }
    );
    expect(projRes.status).toBe(201);
    const projJson = await projRes.json();
    projectId = projJson.data.project.id;

    // 5. Create an overdue task (due 2 days ago, IN_PROGRESS, assigned to owner)
    const overdueRes = await createTaskHandler(
      authedReq("POST", `http://localhost/api/projects/${projectId}/tasks`, ownerCookie, {
        title: "Overdue Task",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: ownerId,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { params: { id: projectId } }
    );
    expect(overdueRes.status).toBe(201);
    const overdueJson = await overdueRes.json();
    overdueTaskId = overdueJson.data.task.id;

    // 6. Create a task due tomorrow (within 7-day window) assigned to owner
    const upcomingRes = await createTaskHandler(
      authedReq("POST", `http://localhost/api/projects/${projectId}/tasks`, ownerCookie, {
        title: "Upcoming Task",
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: ownerId,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      { params: { id: projectId } }
    );
    expect(upcomingRes.status).toBe(201);
    const upcomingJson = await upcomingRes.json();
    upcomingTaskId = upcomingJson.data.task.id;

    // 7. Create a completed task (for recentlyCompleted)
    await createTaskHandler(
      authedReq("POST", `http://localhost/api/projects/${projectId}/tasks`, ownerCookie, {
        title: "Done Task",
        status: "DONE",
        priority: "LOW",
        assigneeId: ownerId,
      }),
      { params: { id: projectId } }
    );
  });

  // ── 1. Authentication guards ──────────────────────────────────────────────
  describe("1. Authentication Guards", () => {
    it("rejects unauthenticated requests to my-tasks (401)", async () => {
      const res = await myTasksHandler(
        new Request(`http://localhost/api/dashboard/${workspaceId}/my-tasks`),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to projects (401)", async () => {
      const res = await dashProjectsHandler(
        new Request(`http://localhost/api/dashboard/${workspaceId}/projects`),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to activity (401)", async () => {
      const res = await activityHandler(
        new Request(`http://localhost/api/dashboard/${workspaceId}/activity`),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to upcoming (401)", async () => {
      const res = await upcomingHandler(
        new Request(`http://localhost/api/dashboard/${workspaceId}/upcoming`),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(401);
    });
  });

  // ── 2. Cross-tenant isolation ─────────────────────────────────────────────
  describe("2. Cross-Tenant Isolation", () => {
    it("blocks outsider from my-tasks with 404 (prevents workspace discovery)", async () => {
      const res = await myTasksHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/my-tasks`, outsiderCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(404);
    });

    it("blocks outsider from projects with 404", async () => {
      const res = await dashProjectsHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/projects`, outsiderCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(404);
    });

    it("blocks outsider from activity with 404", async () => {
      const res = await activityHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/activity`, outsiderCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(404);
    });

    it("blocks outsider from upcoming with 404", async () => {
      const res = await upcomingHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/upcoming`, outsiderCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(404);
    });
  });

  // ── 3. My Tasks ──────────────────────────────────────────────────────────
  describe("3. My Tasks API", () => {
    it("returns owner's active tasks with required shape", async () => {
      const res = await myTasksHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/my-tasks`, ownerCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      const { tasks, total } = json.data;

      expect(total).toBeGreaterThanOrEqual(2); // overdue + upcoming at minimum
      expect(Array.isArray(tasks)).toBe(true);

      const task = tasks[0];
      expect(task).toHaveProperty("id");
      expect(task).toHaveProperty("taskKey");
      expect(task).toHaveProperty("title");
      expect(task).toHaveProperty("isOverdue");
      expect(task).toHaveProperty("project");
      expect(task.project).toHaveProperty("name");
    });

    it("sorts overdue tasks to the top", async () => {
      const res = await myTasksHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/my-tasks`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const tasks = json.data.tasks as Array<{ id: string; isOverdue: boolean }>;

      const overdueTask = tasks.find((t) => t.id === overdueTaskId);
      expect(overdueTask).toBeDefined();
      expect(overdueTask!.isOverdue).toBe(true);

      // All non-overdue tasks should appear after all overdue tasks
      const firstNonOverdueIndex = tasks.findIndex((t) => !t.isOverdue);
      const lastOverdueIndex = tasks.reduce((acc, t, i) => (t.isOverdue ? i : acc), -1);
      if (firstNonOverdueIndex !== -1 && lastOverdueIndex !== -1) {
        expect(lastOverdueIndex).toBeLessThan(firstNonOverdueIndex);
      }
    });

    it("excludes DONE and CANCELLED tasks", async () => {
      const res = await myTasksHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/my-tasks`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const tasks = json.data.tasks as Array<{ status: string }>;
      const hasDoneOrCancelled = tasks.some((t) => t.status === "DONE" || t.status === "CANCELLED");
      expect(hasDoneOrCancelled).toBe(false);
    });

    it("member with no assigned tasks gets empty results (200, not error)", async () => {
      const res = await myTasksHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/my-tasks`, memberCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.total).toBe(0);
      expect(json.data.tasks).toHaveLength(0);
    });
  });

  // ── 4. Dashboard Projects ─────────────────────────────────────────────────
  describe("4. Dashboard Projects API", () => {
    it("returns ACTIVE projects with enriched fields", async () => {
      const res = await dashProjectsHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/projects`, ownerCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      const { projects } = json.data;

      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBeGreaterThanOrEqual(1);

      const proj = projects.find((p: { id: string }) => p.id === projectId);
      expect(proj).toBeDefined();
      expect(proj).toHaveProperty("totalTasks");
      expect(proj).toHaveProperty("doneTasks");
      expect(proj).toHaveProperty("progressPercent");
      expect(proj).toHaveProperty("overdueCount");
      expect(proj).toHaveProperty("isAtRisk");
      expect(proj).toHaveProperty("members");
    });

    it("correctly detects overdue tasks and marks project as at-risk", async () => {
      const res = await dashProjectsHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/projects`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const proj = json.data.projects.find((p: { id: string }) => p.id === projectId);

      // 1 overdue out of 3 tasks = 33% > 25% threshold → isAtRisk = true
      expect(proj.overdueCount).toBeGreaterThanOrEqual(1);
      expect(proj.isAtRisk).toBe(true);
    });

    it("does not leak raw tasks array in response", async () => {
      const res = await dashProjectsHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/projects`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const proj = json.data.projects[0];
      expect(proj).not.toHaveProperty("tasks");
    });
  });

  // ── 5. Activity Feed ──────────────────────────────────────────────────────
  describe("5. Activity Feed API", () => {
    it("returns workspace activity with actor details", async () => {
      const res = await activityHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/activity`, ownerCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      const { activities } = json.data;

      expect(Array.isArray(activities)).toBe(true);
      if (activities.length > 0) {
        const item = activities[0];
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("action");
        expect(item).toHaveProperty("createdAt");
        expect(item).toHaveProperty("actor");
        expect(item.actor).toHaveProperty("name");
      }
    });

    it("sorts activity most-recent first", async () => {
      const res = await activityHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/activity`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const { activities } = json.data;

      for (let i = 1; i < activities.length; i++) {
        const prev = new Date(activities[i - 1].createdAt).getTime();
        const curr = new Date(activities[i].createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  // ── 6. Upcoming / Recently Completed ─────────────────────────────────────
  describe("6. Upcoming & Recently Completed API", () => {
    it("returns both upcoming and recentlyCompleted arrays", async () => {
      const res = await upcomingHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/upcoming`, ownerCookie),
        { params: { workspaceId } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data.upcoming)).toBe(true);
      expect(Array.isArray(json.data.recentlyCompleted)).toBe(true);
    });

    it("upcoming contains the task due tomorrow (within 7-day window)", async () => {
      const res = await upcomingHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/upcoming`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const { upcoming } = json.data;

      const found = upcoming.find((t: { id: string }) => t.id === upcomingTaskId);
      expect(found).toBeDefined();
    });

    it("upcoming tasks have taskKey and project info", async () => {
      const res = await upcomingHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/upcoming`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const { upcoming } = json.data;

      if (upcoming.length > 0) {
        const task = upcoming[0];
        expect(task).toHaveProperty("taskKey");
        expect(task).toHaveProperty("title");
        expect(task).toHaveProperty("dueDate");
        expect(task).toHaveProperty("project");
      }
    });

    it("overdue task is NOT included in upcoming (only future dates)", async () => {
      const res = await upcomingHandler(
        authedReq("GET", `http://localhost/api/dashboard/${workspaceId}/upcoming`, ownerCookie),
        { params: { workspaceId } }
      );
      const json = await res.json();
      const { upcoming } = json.data;

      // The overdue task has dueDate < now, so it should not appear in upcoming
      const overdueFound = upcoming.find((t: { id: string }) => t.id === overdueTaskId);
      expect(overdueFound).toBeUndefined();
    });
  });
});
