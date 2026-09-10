/**
 * Workspace-Wide Search & Discovery Test Suite
 *
 * Verifies:
 *   1. Filter-utils unit tests (no DB):
 *      - parseTaskFiltersFromParams / serializeTaskFiltersToParams round-trip
 *      - matchesDueDateFilter classification
 *      - hasActiveTaskFilters boolean logic
 *
 *   2. Workspace-wide search API (GET /api/workspaces/:id/tasks/search):
 *      - Keyword search across title, description, taskKey
 *      - status, priority, assigneeId, labelId, projectId, dueDate filters
 *      - Combined multi-filter narrowing
 *      - Empty-result case
 *      - Sorting by priority and createdAt
 *      - 401 when unauthenticated
 *
 *   3. PRIVATE project isolation (critical security):
 *      - Non-member never sees private project tasks (no filters, keyword, explicit projectId)
 *      - Workspace OWNER always sees them
 *      - After being added to the project, the member can see them
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteWorkspaceMemberHandler } from "@/app/api/workspaces/[id]/invite/route";
import { POST as createProjectHandler } from "@/app/api/workspaces/[id]/projects/route";
import { POST as addProjectMemberHandler } from "@/app/api/projects/[id]/members/route";
import { POST as createTaskHandler } from "@/app/api/projects/[id]/tasks/route";
import { POST as createLabelHandler } from "@/app/api/workspaces/[id]/labels/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { GET as searchHandler } from "@/app/api/workspaces/[id]/tasks/search/route";
import { PATCH as patchTaskHandler } from "@/app/api/tasks/[id]/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";
import {
  parseTaskFiltersFromParams,
  serializeTaskFiltersToParams,
  hasActiveTaskFilters,
  matchesDueDateFilter,
  DEFAULT_TASK_FILTERS,
  type TaskFilterState,
} from "@/lib/filter-utils";

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

async function cleanAndRegister(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const taskIds = (
      await prisma.task.findMany({
        where: { OR: [{ creatorId: existing.id }, { assigneeId: existing.id }] },
        select: { id: true },
      })
    ).map((t) => t.id);
    if (taskIds.length > 0) {
      await prisma.taskLabel.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.activityEvent.deleteMany({ where: { taskId: { in: taskIds } } });
    }
    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: existing.id },
      select: { id: true },
    });
    if (ownedProjects.length > 0) {
      const pIds = ownedProjects.map((p) => p.id);
      const prjTaskIds = (
        await prisma.task.findMany({
          where: { projectId: { in: pIds } },
          select: { id: true },
        })
      ).map((t) => t.id);
      if (prjTaskIds.length > 0) {
        await prisma.taskLabel.deleteMany({ where: { taskId: { in: prjTaskIds } } });
        await prisma.comment.deleteMany({ where: { taskId: { in: prjTaskIds } } });
        await prisma.activityEvent.deleteMany({ where: { taskId: { in: prjTaskIds } } });
        await prisma.task.deleteMany({ where: { id: { in: prjTaskIds } } });
      }
      await prisma.projectMember.deleteMany({ where: { projectId: { in: pIds } } });
      await prisma.project.deleteMany({ where: { id: { in: pIds } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
    await prisma.projectMember.deleteMany({ where: { userId: existing.id } });
    await prisma.workspaceMember.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const req = new Request("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const res = await registerHandler(req);
  expect(res.status, `Registration failed for ${email}`).toBe(201);
  const data = await res.json();
  return {
    cookie: getAuthCookie(res),
    user: data.data.user as { id: string; name: string; email: string },
  };
}

function getAuthCookie(res: Response): string {
  const setCookieHeader = res.headers.get("set-cookie") || "";
  const match = setCookieHeader.match(new RegExp(`${ACCESS_COOKIE_NAME}=([^;]+)`));
  expect(match, "Auth cookie missing from response").not.toBeNull();
  return `${ACCESS_COOKIE_NAME}=${match![1]}`;
}

function authedReq(method: string, url: string, cookie: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function searchUrl(workspaceId: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return `http://localhost:3000/api/workspaces/${workspaceId}/tasks/search${qs ? `?${qs}` : ""}`;
}

// -----------------------------------------------------------------------
// Suite 1 – filter-utils unit tests (no DB)
// -----------------------------------------------------------------------

describe("1. filter-utils — unit tests", () => {
  describe("parseTaskFiltersFromParams", () => {
    it("returns DEFAULT_TASK_FILTERS when no params provided", () => {
      expect(parseTaskFiltersFromParams(new URLSearchParams())).toEqual(DEFAULT_TASK_FILTERS);
    });

    it("parses all recognised params correctly", () => {
      const params = new URLSearchParams({
        search: "payment gateway",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: "user-abc",
        projectId: "proj-xyz",
        labelId: "label-123",
        dueDate: "overdue",
        sort: "priority",
        order: "asc",
      });
      expect(parseTaskFiltersFromParams(params)).toEqual<TaskFilterState>({
        search: "payment gateway",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: "user-abc",
        projectId: "proj-xyz",
        labelId: "label-123",
        dueDate: "overdue",
        sort: "priority",
        order: "asc",
      });
    });

    it("accepts 'q' as an alias for 'search'", () => {
      expect(parseTaskFiltersFromParams(new URLSearchParams({ q: "auth flow" })).search).toBe("auth flow");
    });

    it("falls back to defaults for unknown dueDate / sort / order values", () => {
      const result = parseTaskFiltersFromParams(
        new URLSearchParams({ dueDate: "next-month", sort: "taskNumber", order: "random" })
      );
      expect(result.dueDate).toBe("all");
      expect(result.sort).toBe("createdAt");
      expect(result.order).toBe("desc");
    });

    it("accepts plain object as well as URLSearchParams", () => {
      const result = parseTaskFiltersFromParams({ status: "TODO", priority: "URGENT" });
      expect(result.status).toBe("TODO");
      expect(result.priority).toBe("URGENT");
    });
  });

  describe("serializeTaskFiltersToParams", () => {
    it("omits all default values (produces empty string)", () => {
      expect(serializeTaskFiltersToParams(DEFAULT_TASK_FILTERS).toString()).toBe("");
    });

    it("serializes only non-default fields", () => {
      const filters: TaskFilterState = { ...DEFAULT_TASK_FILTERS, search: "billing", status: "IN_REVIEW", dueDate: "this-week" };
      const params = serializeTaskFiltersToParams(filters);
      expect(params.get("search")).toBe("billing");
      expect(params.get("status")).toBe("IN_REVIEW");
      expect(params.get("dueDate")).toBe("this-week");
      expect(params.has("priority")).toBe(false);
      expect(params.has("sort")).toBe(false);
      expect(params.has("order")).toBe(false);
    });

    it("round-trips: serialize -> parse yields original non-default state", () => {
      const original: TaskFilterState = {
        search: "invoice",
        status: "DONE",
        priority: "URGENT",
        assigneeId: "user-777",
        projectId: "proj-888",
        labelId: "label-999",
        dueDate: "overdue",
        sort: "dueDate",
        order: "asc",
      };
      expect(parseTaskFiltersFromParams(serializeTaskFiltersToParams(original))).toEqual(original);
    });
  });

  describe("hasActiveTaskFilters", () => {
    it("returns false for pure defaults", () => {
      expect(hasActiveTaskFilters(DEFAULT_TASK_FILTERS)).toBe(false);
    });
    it("returns true when search is set", () => {
      expect(hasActiveTaskFilters({ ...DEFAULT_TASK_FILTERS, search: "deploy" })).toBe(true);
    });
    it("returns true when status differs from ALL", () => {
      expect(hasActiveTaskFilters({ ...DEFAULT_TASK_FILTERS, status: "TODO" })).toBe(true);
    });
    it("ignores projectId when ignoreProject option is set", () => {
      const f: TaskFilterState = { ...DEFAULT_TASK_FILTERS, projectId: "some-project" };
      expect(hasActiveTaskFilters(f, { ignoreProject: true })).toBe(false);
      expect(hasActiveTaskFilters(f, { ignoreProject: false })).toBe(true);
    });
  });

  describe("matchesDueDateFilter", () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    it("'all' always matches regardless of value", () => {
      expect(matchesDueDateFilter(null, "all")).toBe(true);
      expect(matchesDueDateFilter(past, "all")).toBe(true);
    });
    it("'no-due-date' matches null/undefined only", () => {
      expect(matchesDueDateFilter(null, "no-due-date")).toBe(true);
      expect(matchesDueDateFilter(undefined, "no-due-date")).toBe(true);
      expect(matchesDueDateFilter(past, "no-due-date")).toBe(false);
    });
    it("'overdue' matches past dates, not future", () => {
      expect(matchesDueDateFilter(past, "overdue")).toBe(true);
      expect(matchesDueDateFilter(tomorrow, "overdue")).toBe(false);
      expect(matchesDueDateFilter(null, "overdue")).toBe(false);
    });
    it("'this-week' matches dates within the next 7 days", () => {
      expect(matchesDueDateFilter(tomorrow, "this-week")).toBe(true);
      expect(matchesDueDateFilter(past, "this-week")).toBe(false);
      expect(matchesDueDateFilter(null, "this-week")).toBe(false);
    });
  });
});

// -----------------------------------------------------------------------
// Suite 2 – Search API integration tests
// -----------------------------------------------------------------------

describe("2. Workspace-wide task search API", () => {
  let ownerCookie: string;
  let memberCookie: string;
  let memberUser: { id: string; name: string; email: string };
  let workspaceId: string;
  let publicProjectId: string;
  let labelId: string;

  let todoLowTaskId: string;
  let inProgressHighTaskId: string;
  let doneMediumTaskId: string;
  let labeledTaskId: string;
  let overdueTaskId: string;

  beforeAll(async () => {
    const ownerRes = await cleanAndRegister("search.owner@example.com", "SecurePass123!", "Search Owner");
    ownerCookie = ownerRes.cookie;
    const memberRes = await cleanAndRegister("search.member@example.com", "SecurePass123!", "Search Member");
    memberCookie = memberRes.cookie;
    memberUser = memberRes.user;

    const wsRes = await createWorkspaceHandler(
      authedReq("POST", "http://localhost:3000/api/workspaces", ownerCookie, {
        name: `Search Test WS ${Date.now()}`,
      })
    );
    expect(wsRes.status).toBe(201);
    workspaceId = (await wsRes.json()).data.workspace.id;

    await inviteWorkspaceMemberHandler(
      authedReq("POST", `http://localhost:3000/api/workspaces/${workspaceId}/invite`, ownerCookie, {
        email: memberUser.email, role: "MEMBER",
      }),
      { params: { id: workspaceId } }
    );

    const prjRes = await createProjectHandler(
      authedReq("POST", `http://localhost:3000/api/workspaces/${workspaceId}/projects`, ownerCookie, {
        name: "Public Alpha",
        key: "SRCH",
        visibility: "PUBLIC_TO_WORKSPACE",
        initialMembers: [{ userId: memberUser.id, role: "MEMBER" }],
      }),
      { params: { id: workspaceId } }
    );
    expect(prjRes.status).toBe(201);
    publicProjectId = (await prjRes.json()).data.project.id;

    const lblRes = await createLabelHandler(
      authedReq("POST", `http://localhost:3000/api/workspaces/${workspaceId}/labels`, ownerCookie, {
        name: "Frontend", color: "#f59e0b",
      }),
      { params: { id: workspaceId } }
    );
    expect(lblRes.status).toBe(201);
    labelId = (await lblRes.json()).data.label.id;

    const ct = async (body: Record<string, unknown>) => {
      const res = await createTaskHandler(
        authedReq("POST", `http://localhost:3000/api/projects/${publicProjectId}/tasks`, ownerCookie, body),
        { params: { id: publicProjectId } }
      );
      expect(res.status, `Task creation failed: ${JSON.stringify(body)}`).toBe(201);
      return (await res.json()).data.task.id as string;
    };

    todoLowTaskId = await ct({ title: "Implement payment gateway integration", status: "TODO", priority: "LOW" });
    inProgressHighTaskId = await ct({ title: "Refactor authentication module", status: "IN_PROGRESS", priority: "HIGH", assigneeId: memberUser.id });
    doneMediumTaskId = await ct({ title: "Write API documentation", status: "DONE", priority: "MEDIUM" });
    labeledTaskId = await ct({ title: "Build dashboard charts component", status: "TODO", priority: "MEDIUM", labelIds: [labelId] });
    overdueTaskId = await ct({ title: "Fix critical login bug", status: "IN_PROGRESS", priority: "URGENT" });

    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const patchRes = await patchTaskHandler(
      authedReq("PATCH", `http://localhost:3000/api/tasks/${overdueTaskId}`, ownerCookie, { dueDate: pastDate }),
      { params: { id: overdueTaskId } }
    );
    expect(patchRes.status).toBe(200);
  });

  it("returns all accessible tasks with no filters", async () => {
    const res = await searchHandler(authedReq("GET", searchUrl(workspaceId), ownerCookie), { params: { id: workspaceId } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.tasks.length).toBeGreaterThanOrEqual(5);
  });

  it("keyword search matches task title", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: "payment gateway" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].id).toBe(todoLowTaskId);
  });

  it("keyword search matches taskKey (e.g. SRCH-3)", async () => {
    const dbTask = await prisma.task.findUnique({ where: { id: doneMediumTaskId } });
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: dbTask!.taskKey }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(doneMediumTaskId);
  });

  it("status filter returns only matching tasks", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { status: "TODO" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.every((t: { status: string }) => t.status === "TODO")).toBe(true);
    const ids = data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(todoLowTaskId);
    expect(ids).toContain(labeledTaskId);
    expect(ids).not.toContain(inProgressHighTaskId);
  });

  it("priority filter returns only matching tasks", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { priority: "HIGH" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.every((t: { priority: string }) => t.priority === "HIGH")).toBe(true);
    expect(data.tasks.map((t: { id: string }) => t.id)).toContain(inProgressHighTaskId);
  });

  it("assigneeId filter returns only tasks assigned to that user", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { assigneeId: memberUser.id }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.every((t: { assignee: { id: string } | null }) => t.assignee?.id === memberUser.id)).toBe(true);
    expect(data.tasks.map((t: { id: string }) => t.id)).toContain(inProgressHighTaskId);
  });

  it("assigneeId=unassigned returns only unassigned tasks", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { assigneeId: "unassigned" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.every((t: { assignee: unknown }) => t.assignee === null)).toBe(true);
    const ids = data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(todoLowTaskId);
    expect(ids).not.toContain(inProgressHighTaskId);
  });

  it("labelId filter returns only tasks with that label", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { labelId }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(labeledTaskId);
    expect(ids).not.toContain(todoLowTaskId);
  });

  it("projectId filter scopes results to that project only", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { projectId: publicProjectId }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.every((t: { project: { id: string } }) => t.project.id === publicProjectId)).toBe(true);
  });

  it("dueDate=overdue returns active overdue tasks (excludes DONE)", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { dueDate: "overdue" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    const ids = data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(overdueTaskId);
    expect(ids).not.toContain(doneMediumTaskId);
  });

  it("combined status + priority + search narrows to exactly one matching task", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { status: "IN_PROGRESS", priority: "HIGH", search: "auth" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const data = (await res.json()).data;
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].id).toBe(inProgressHighTaskId);
  });

  it("returns empty tasks array when no results match combined filters", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { status: "CANCELLED", search: "nonexistent-xyz-9999" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.tasks).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("sort=priority desc returns URGENT tasks before LOW tasks", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { sort: "priority", order: "desc" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    const priorities = (await res.json()).data.tasks.map((t: { priority: string }) => t.priority);
    const urgentIdx = priorities.indexOf("URGENT");
    const lowIdx = priorities.indexOf("LOW");
    expect(urgentIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThanOrEqual(0);
    expect(urgentIdx).toBeLessThan(lowIdx);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await searchHandler(
      new Request(searchUrl(workspaceId), { method: "GET" }),
      { params: { id: workspaceId } }
    );
    expect(res.status).toBe(401);
  });
});

// -----------------------------------------------------------------------
// Suite 3 – PRIVATE project isolation (critical security)
// -----------------------------------------------------------------------

describe("3. PRIVATE project isolation in workspace-wide search", () => {
  let ownerCookie: string;
  let memberCookie: string;
  let memberUser: { id: string; name: string; email: string };
  let workspaceId: string;
  let privateProjectId: string;
  let privateTaskId: string;

  beforeAll(async () => {
    const ownerRes = await cleanAndRegister("isolation.owner@example.com", "SecurePass123!", "Isolation Owner");
    ownerCookie = ownerRes.cookie;
    const memberRes = await cleanAndRegister("isolation.member@example.com", "SecurePass123!", "Isolation Member");
    memberCookie = memberRes.cookie;
    memberUser = memberRes.user;

    const wsRes = await createWorkspaceHandler(
      authedReq("POST", "http://localhost:3000/api/workspaces", ownerCookie, {
        name: `Isolation Test WS ${Date.now()}`,
      })
    );
    expect(wsRes.status).toBe(201);
    workspaceId = (await wsRes.json()).data.workspace.id;

    await inviteWorkspaceMemberHandler(
      authedReq("POST", `http://localhost:3000/api/workspaces/${workspaceId}/invite`, ownerCookie, {
        email: memberUser.email, role: "MEMBER",
      }),
      { params: { id: workspaceId } }
    );

    // PRIVATE project — owner only (member is workspace member but NOT project member)
    const prjRes = await createProjectHandler(
      authedReq("POST", `http://localhost:3000/api/workspaces/${workspaceId}/projects`, ownerCookie, {
        name: "Secret Project",
        key: "SEC",
        visibility: "PRIVATE",
      }),
      { params: { id: workspaceId } }
    );
    expect(prjRes.status).toBe(201);
    privateProjectId = (await prjRes.json()).data.project.id;

    const taskRes = await createTaskHandler(
      authedReq("POST", `http://localhost:3000/api/projects/${privateProjectId}/tasks`, ownerCookie, {
        title: "Top secret implementation",
        status: "IN_PROGRESS",
        priority: "URGENT",
      }),
      { params: { id: privateProjectId } }
    );
    expect(taskRes.status).toBe(201);
    privateTaskId = (await taskRes.json()).data.task.id;
  });

  it("non-member cannot see private task in no-filter workspace search", async () => {
    const res = await searchHandler(authedReq("GET", searchUrl(workspaceId), memberCookie), { params: { id: workspaceId } });
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(privateTaskId);
  });

  it("non-member cannot find private task via keyword search", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: "Top secret" }), memberCookie),
      { params: { id: workspaceId } }
    );
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(privateTaskId);
  });

  it("non-member cannot find private task by specifying its projectId filter", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { projectId: privateProjectId }), memberCookie),
      { params: { id: workspaceId } }
    );
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(privateTaskId);
  });

  it("workspace OWNER can see private project tasks in workspace search", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: "secret" }), ownerCookie),
      { params: { id: workspaceId } }
    );
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(privateTaskId);
  });

  it("after being added to the private project, the member can see its tasks", async () => {
    // Confirm they cannot see it yet
    const before = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: "secret" }), memberCookie),
      { params: { id: workspaceId } }
    );
    expect((await before.json()).data.tasks.map((t: { id: string }) => t.id)).not.toContain(privateTaskId);

    // Add member to the private project
    const addRes = await addProjectMemberHandler(
      authedReq("POST", `http://localhost:3000/api/projects/${privateProjectId}/members`, ownerCookie, {
        userId: memberUser.id, role: "MEMBER",
      }),
      { params: { id: privateProjectId } }
    );
    expect([200, 201]).toContain(addRes.status);

    // Now the member should see the private task
    const after = await searchHandler(
      authedReq("GET", searchUrl(workspaceId, { search: "secret" }), memberCookie),
      { params: { id: workspaceId } }
    );
    expect(after.status).toBe(200);
    const ids = (await after.json()).data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(privateTaskId);
  });
});

// -----------------------------------------------------------------------
// Suite 4 – Exact real-world regression: Liam Torres / SOC2 project (Bug 2)
//
// This suite uses the SEEDED database identifiers (ws_nova_labs, usr_liam_torres,
// prj_soc2_audit) rather than a synthetic scenario so the specific real-world
// case described in the bug report is explicitly covered and cannot silently
// regress. The seed must NOT add Liam as a ProjectMember of prj_soc2_audit.
//
// If the seed is re-run and inadvertently re-adds Liam to that project,
// this test will catch it. If the backend search endpoint stops enforcing
// PRIVATE visibility, this test will catch it.
// -----------------------------------------------------------------------


describe("4. Seeded-data regression — Liam Torres cannot see SOC2 private project tasks", () => {
  // Fixed IDs from prisma/seed.ts
  const NOVA_WORKSPACE_ID = "ws_nova_labs";
  const SOC2_PROJECT_ID = "prj_soc2_audit";
  const LIAM_EMAIL = "liam.torres@novalabs.io";
  const ELENA_EMAIL = "elena.rostova@novalabs.io"; // SOC2 project LEAD — should see everything
  const PASSWORD = "password123";

  let liamCookie: string;
  let elenaCookie: string;

  beforeAll(async () => {
    // Log in as Liam (workspace MEMBER, NOT a project member of prj_soc2_audit)
    const liamLogin = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: LIAM_EMAIL, password: PASSWORD }),
      })
    );
    expect(liamLogin.status, `Liam login failed — has the seed been run? (npm run db:seed)`).toBe(200);
    liamCookie = getAuthCookie(liamLogin);

    // Log in as Elena (workspace ADMIN + SOC2 project LEAD — should see everything)
    const elenaLogin = await loginHandler(
      new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ELENA_EMAIL, password: PASSWORD }),
      })
    );
    expect(elenaLogin.status, `Elena login failed — has the seed been run? (npm run db:seed)`).toBe(200);
    elenaCookie = getAuthCookie(elenaLogin);
  });

  it("Liam is confirmed NOT a member of prj_soc2_audit in the database", async () => {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: SOC2_PROJECT_ID, userId: "usr_liam_torres" },
    });
    expect(membership).toBeNull();
  });

  it("prj_soc2_audit is confirmed PRIVATE in the database", async () => {
    const project = await prisma.project.findUnique({ where: { id: SOC2_PROJECT_ID } });
    expect(project).not.toBeNull();
    expect(project!.visibility).toBe("PRIVATE");
  });

  it("Liam cannot see SOC2 tasks in a no-filter workspace search", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(NOVA_WORKSPACE_ID), liamCookie),
      { params: { id: NOVA_WORKSPACE_ID } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    const projectIds = data.tasks.map((t: { project: { id: string } }) => t.project.id);
    // No task from prj_soc2_audit should appear
    expect(projectIds).not.toContain(SOC2_PROJECT_ID);
  });

  it("Liam cannot find SOC2 tasks via keyword search (terms from seeded task titles)", async () => {
    // The seed appends [SEC] to every title in prj_soc2_audit (key=SEC).
    // Searching for " [SEC]" uniquely targets SOC2 tasks.
    const res = await searchHandler(
      authedReq("GET", searchUrl(NOVA_WORKSPACE_ID, { search: "[SEC]" }), liamCookie),
      { params: { id: NOVA_WORKSPACE_ID } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    const projectIds = data.tasks.map((t: { project: { id: string } }) => t.project.id);
    expect(projectIds).not.toContain(SOC2_PROJECT_ID);
    expect(data.tasks.length).toBe(0);
  });

  it("Liam cannot find SOC2 tasks by specifying the projectId filter directly", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(NOVA_WORKSPACE_ID, { projectId: SOC2_PROJECT_ID }), liamCookie),
      { params: { id: NOVA_WORKSPACE_ID } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.tasks.length).toBe(0);
  });

  it("Elena (SOC2 project LEAD) CAN see SOC2 tasks in workspace search", async () => {
    const res = await searchHandler(
      authedReq("GET", searchUrl(NOVA_WORKSPACE_ID, { search: "[SEC]" }), elenaCookie),
      { params: { id: NOVA_WORKSPACE_ID } }
    );
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    const projectIds = data.tasks.map((t: { project: { id: string } }) => t.project.id);
    expect(projectIds.every((id: string) => id === SOC2_PROJECT_ID)).toBe(true);
    expect(data.tasks.length).toBeGreaterThan(0);
  });
});
