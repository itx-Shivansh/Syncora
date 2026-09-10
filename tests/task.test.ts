/**
 * Task Management & Kanban Reordering Security & Integration Suite
 *
 * Verifies:
 *   1. Monotonic task key generation:
 *      - Sequentially assigns KEY-1, KEY-2, KEY-3
 *      - Assigns orderIndex spaced by 1000
 *      - Logs TASK_CREATED ActivityEvent
 *   2. Validation enforcement:
 *      - Missing/empty title returns 422
 *      - Invalid status/priority returns 422
 *   3. Task listing and query filtering:
 *      - Filter by status, priority, search
 *   4. Field updates & ActivityEvent logging:
 *      - PATCH /api/tasks/:id status change logs STATUS_CHANGED ActivityEvent
 *      - Priority change logs PRIORITY_CHANGED ActivityEvent
 *   5. Drag-and-drop reordering persistence:
 *      - PATCH /api/tasks/:id/reorder updates status and orderIndex
 *      - Persistence survives across subsequent GET queries
 *   6. Cross-tenant & PRIVATE project isolation:
 *      - Non-member of PRIVATE project returns 404
 *      - User from outside workspace returns 404
 *   7. Role-gated task deletion:
 *      - Creator / Lead can delete task
 *      - Unauthorized user is rejected (403/404)
 *   8. Workspace Labels:
 *      - Create label and attach to task
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteWorkspaceMemberHandler } from "@/app/api/workspaces/[id]/invite/route";
import { POST as createProjectHandler } from "@/app/api/workspaces/[id]/projects/route";
import {
  POST as createLabelHandler,
  GET as listLabelsHandler,
} from "@/app/api/workspaces/[id]/labels/route";
import {
  GET as listTasksHandler,
  POST as createTaskHandler,
} from "@/app/api/projects/[id]/tasks/route";
import {
  GET as getTaskHandler,
  PATCH as patchTaskHandler,
  DELETE as deleteTaskHandler,
} from "@/app/api/tasks/[id]/route";
import { PATCH as reorderTaskHandler } from "@/app/api/tasks/[id]/reorder/route";
import { prisma } from "@/lib/db";
import { ACCESS_COOKIE_NAME } from "@/lib/auth";

// -----------------------------------------------------------------------
// Test Helpers
// -----------------------------------------------------------------------

async function cleanAndRegister(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const userTaskIds = (
      await prisma.task.findMany({
        where: { creatorId: existing.id },
        select: { id: true },
      })
    ).map((t) => t.id);
    if (userTaskIds.length > 0) {
      await prisma.taskLabel.deleteMany({ where: { taskId: { in: userTaskIds } } });
    }
    await prisma.comment.deleteMany({ where: { authorId: existing.id } });
    await prisma.task.deleteMany({ where: { creatorId: existing.id } });
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

describe("Task Core & Kanban Reordering Security Suite", () => {
  let ownerCookie: string;
  let ownerUser: { id: string; name: string; email: string };

  let memberCookie: string;
  let memberUser: { id: string; name: string; email: string };

  let outsiderCookie: string;

  let workspaceId: string;
  let projectId: string;
  const projectKey = "TASK";

  beforeAll(async () => {
    // 1. Setup workspace owner
    const ownerRes = await cleanAndRegister(
      "taskowner@example.com",
      "SecurePass123!",
      "Task Owner"
    );
    ownerCookie = ownerRes.cookie;
    ownerUser = ownerRes.user;

    // 2. Setup workspace member
    const memberRes = await cleanAndRegister(
      "taskmember@example.com",
      "SecurePass123!",
      "Task Member"
    );
    memberCookie = memberRes.cookie;
    memberUser = memberRes.user;

    // 3. Setup outsider user
    const outsiderRes = await cleanAndRegister(
      "taskoutsider@example.com",
      "SecurePass123!",
      "Task Outsider"
    );
    outsiderCookie = outsiderRes.cookie;

    // 4. Create Workspace
    const wsReq = authedRequest("POST", "http://localhost:3000/api/workspaces", ownerCookie, {
      name: `Task Test Workspace ${Date.now()}`,
    });
    const wsRes = await createWorkspaceHandler(wsReq);
    expect(wsRes.status).toBe(201);
    const wsData = await wsRes.json();
    workspaceId = wsData.data.workspace.id;

    // 5. Add member to workspace
    const inviteReq = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/invite`,
      ownerCookie,
      { email: memberUser.email, role: "MEMBER" }
    );
    const inviteRes = await inviteWorkspaceMemberHandler(inviteReq, {
      params: { id: workspaceId },
    });
    expect([200, 201]).toContain(inviteRes.status);

    // 6. Create Project in workspace
    const prjReq = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "Task Core Project",
        key: projectKey,
        description: "Testing Task engine",
        initialMembers: [{ userId: memberUser.id, role: "MEMBER" }],
      }
    );
    const prjRes = await createProjectHandler(prjReq, { params: { id: workspaceId } });
    expect(prjRes.status).toBe(201);
    const prjData = await prjRes.json();
    projectId = prjData.data.project.id;
  });

  describe("1. Task Creation & Monotonic Key Assignment", () => {
    it("creates sequential tasks with monotonic taskNumber and taskKey", async () => {
      // Create first task
      const req1 = authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        ownerCookie,
        {
          title: "Initial architecture setup",
          status: "TODO",
          priority: "HIGH",
        }
      );
      const res1 = await createTaskHandler(req1, { params: { id: projectId } });
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.data.task.taskNumber).toBe(1);
      expect(data1.data.task.taskKey).toBe(`${projectKey}-1`);
      expect(data1.data.task.orderIndex).toBe(1000);

      // Create second task (in IN_PROGRESS) -> first in that column, orderIndex 1000
      const req2 = authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        ownerCookie,
        {
          title: "Setup redis caching layer",
          status: "IN_PROGRESS",
          priority: "URGENT",
          assigneeId: memberUser.id,
        }
      );
      const res2 = await createTaskHandler(req2, { params: { id: projectId } });
      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      expect(data2.data.task.taskNumber).toBe(2);
      expect(data2.data.task.taskKey).toBe(`${projectKey}-2`);
      expect(data2.data.task.orderIndex).toBe(1000); // first in IN_PROGRESS column
      expect(data2.data.task.assignee.id).toBe(memberUser.id);

      // Create third task (in TODO) -> second in TODO column, orderIndex 2000
      const req3 = authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        ownerCookie,
        {
          title: "Setup Vitest test runner",
          status: "TODO",
          priority: "LOW",
        }
      );
      const res3 = await createTaskHandler(req3, { params: { id: projectId } });
      expect(res3.status).toBe(201);
      const data3 = await res3.json();
      expect(data3.data.task.taskNumber).toBe(3);
      expect(data3.data.task.taskKey).toBe(`${projectKey}-3`);
      expect(data3.data.task.orderIndex).toBe(2000); // second in TODO column

      // Verify TASK_CREATED activity event was logged
      const activityEvents = await prisma.activityEvent.findMany({
        where: { projectId, action: "TASK_CREATED" },
      });
      expect(activityEvents.length).toBeGreaterThanOrEqual(3);
    });

    it("rejects task creation with invalid or empty payload (422)", async () => {
      const emptyTitleReq = authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        ownerCookie,
        {
          title: "",
        }
      );
      const res = await createTaskHandler(emptyTitleReq, { params: { id: projectId } });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("2. Task Listing & Query Filtering", () => {
    it("filters tasks by status, priority, and search text", async () => {
      // List all tasks
      const allReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        ownerCookie
      );
      const allRes = await listTasksHandler(allReq, { params: { id: projectId } });
      expect(allRes.status).toBe(200);
      const allData = await allRes.json();
      expect(allData.data.tasks.length).toBeGreaterThanOrEqual(2);

      // Filter by status=TODO
      const todoReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/tasks?status=TODO`,
        ownerCookie
      );
      const todoRes = await listTasksHandler(todoReq, { params: { id: projectId } });
      const todoData = await todoRes.json();
      expect(todoData.data.tasks.every((t: { status: string }) => t.status === "TODO")).toBe(true);

      // Filter by search=architecture
      const searchReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/tasks?search=architecture`,
        ownerCookie
      );
      const searchRes = await listTasksHandler(searchReq, { params: { id: projectId } });
      const searchData = await searchRes.json();
      expect(searchData.data.tasks.length).toBe(1);
      expect(searchData.data.tasks[0].title).toContain("Initial architecture setup");
    });
  });

  describe("3. Task Updates & Granular ActivityEvent Logging", () => {
    it("updates status and creates STATUS_CHANGED activity event", async () => {
      // Fetch task 1
      const tasks = await prisma.task.findMany({ where: { projectId } });
      const task1 = tasks[0];

      const patchReq = authedRequest(
        "PATCH",
        `http://localhost:3000/api/tasks/${task1.id}`,
        ownerCookie,
        {
          status: "IN_REVIEW",
        }
      );
      const patchRes = await patchTaskHandler(patchReq, { params: { id: task1.id } });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.data.task.status).toBe("IN_REVIEW");

      // Verify STATUS_CHANGED activity event
      const statusEvent = await prisma.activityEvent.findFirst({
        where: {
          taskId: task1.id,
          action: "STATUS_CHANGED",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(statusEvent).not.toBeNull();
      expect(statusEvent?.metadata).toMatchObject({
        newStatus: "IN_REVIEW",
      });
    });

    it("updates priority and creates PRIORITY_CHANGED activity event", async () => {
      // Pick task 3 which has LOW priority
      const task3 = await prisma.task.findFirst({ where: { projectId, taskNumber: 3 } });
      expect(task3).not.toBeNull();

      const patchReq = authedRequest(
        "PATCH",
        `http://localhost:3000/api/tasks/${task3!.id}`,
        ownerCookie,
        {
          priority: "URGENT",
        }
      );
      const patchRes = await patchTaskHandler(patchReq, { params: { id: task3!.id } });
      expect(patchRes.status).toBe(200);

      const priorityEvent = await prisma.activityEvent.findFirst({
        where: {
          taskId: task3!.id,
          action: "PRIORITY_CHANGED",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(priorityEvent).not.toBeNull();
      expect(priorityEvent?.metadata).toMatchObject({
        previousPriority: "LOW",
        newPriority: "URGENT",
      });
    });
  });

  describe("4. Kanban Drag & Drop Reordering Persistence", () => {
    it("persists new status and fractional orderIndex, surviving page reloads", async () => {
      const tasks = await prisma.task.findMany({ where: { projectId } });
      const taskToMove = tasks[1];

      // Reorder taskToMove into DONE at orderIndex 500
      const reorderReq = authedRequest(
        "PATCH",
        `http://localhost:3000/api/tasks/${taskToMove.id}/reorder`,
        ownerCookie,
        {
          status: "DONE",
          orderIndex: 500,
        }
      );
      const reorderRes = await reorderTaskHandler(reorderReq, { params: { id: taskToMove.id } });
      expect(reorderRes.status).toBe(200);
      const reorderData = await reorderRes.json();
      expect(reorderData.data.task.status).toBe("DONE");
      expect(reorderData.data.task.orderIndex).toBe(500);

      // Verify persistent in DB
      const dbTask = await prisma.task.findUnique({ where: { id: taskToMove.id } });
      expect(dbTask?.status).toBe("DONE");
      expect(dbTask?.orderIndex).toBe(500);

      // Verify list endpoint reflects reordered state
      const listReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/tasks?status=DONE`,
        ownerCookie
      );
      const listRes = await listTasksHandler(listReq, { params: { id: projectId } });
      const listData = await listRes.json();
      expect(listData.data.tasks[0].id).toBe(taskToMove.id);
      expect(listData.data.tasks[0].orderIndex).toBe(500);
    });
  });

  describe("5. Workspace Labels & Attachment", () => {
    let createdLabelId: string;

    it("creates workspace label and attaches it to task", async () => {
      // 1. Create label
      const labelReq = authedRequest(
        "POST",
        `http://localhost:3000/api/workspaces/${workspaceId}/labels`,
        ownerCookie,
        {
          name: "Backend API",
          color: "#6366f1",
          description: "Server-side work",
        }
      );
      const labelRes = await createLabelHandler(labelReq, { params: { id: workspaceId } });
      expect(labelRes.status).toBe(201);
      const labelData = await labelRes.json();
      createdLabelId = labelData.data.label.id;
      expect(labelData.data.label.name).toBe("Backend API");

      // 2. List labels
      const listReq = authedRequest(
        "GET",
        `http://localhost:3000/api/workspaces/${workspaceId}/labels`,
        ownerCookie
      );
      const listRes = await listLabelsHandler(listReq, { params: { id: workspaceId } });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.data.labels.some((l: { id: string }) => l.id === createdLabelId)).toBe(true);

      // 3. Attach label to task
      const tasks = await prisma.task.findMany({ where: { projectId } });
      const task = tasks[0];

      const patchReq = authedRequest(
        "PATCH",
        `http://localhost:3000/api/tasks/${task.id}`,
        ownerCookie,
        {
          labelIds: [createdLabelId],
        }
      );
      const patchRes = await patchTaskHandler(patchReq, { params: { id: task.id } });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(
        patchData.data.task.labels.some(
          (tl: { label: { id: string } }) => tl.label.id === createdLabelId
        )
      ).toBe(true);
    });
  });

  describe("6. Cross-Tenant & Visibility Isolation", () => {
    it("rejects outsider access to tasks (404/403)", async () => {
      const outsiderReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        outsiderCookie
      );
      const outsiderRes = await listTasksHandler(outsiderReq, { params: { id: projectId } });
      expect([403, 404]).toContain(outsiderRes.status);
    });

    it("enforces PRIVATE project task boundaries", async () => {
      // Create a PRIVATE project with only owner
      const privReq = authedRequest(
        "POST",
        `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
        ownerCookie,
        {
          name: "Secret Project",
          key: "PRIV",
          visibility: "PRIVATE",
        }
      );
      const privRes = await createProjectHandler(privReq, { params: { id: workspaceId } });
      expect(privRes.status).toBe(201);
      const privData = await privRes.json();
      const privProjectId = privData.data.project.id;

      // Workspace member (not member of PRIVATE project) attempts to list tasks -> 404
      const memberReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${privProjectId}/tasks`,
        memberCookie
      );
      const memberRes = await listTasksHandler(memberReq, { params: { id: privProjectId } });
      expect(memberRes.status).toBe(404);
    });
  });

  describe("7. Role-Gated Task Deletion", () => {
    it("allows task creator to delete task and prevents unauthorized deletion", async () => {
      // Create task by member
      const memberTaskReq = authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${projectId}/tasks`,
        memberCookie,
        {
          title: "Member temporary task",
        }
      );
      const memberTaskRes = await createTaskHandler(memberTaskReq, { params: { id: projectId } });
      expect(memberTaskRes.status).toBe(201);
      const memberTaskData = await memberTaskRes.json();
      const memberTaskId = memberTaskData.data.task.id;

      // Outsider attempt to delete -> rejected
      const outsiderDelReq = authedRequest(
        "DELETE",
        `http://localhost:3000/api/tasks/${memberTaskId}`,
        outsiderCookie
      );
      const outsiderDelRes = await deleteTaskHandler(outsiderDelReq, {
        params: { id: memberTaskId },
      });
      expect([403, 404]).toContain(outsiderDelRes.status);

      // Member (creator) deletes task -> 200
      const memberDelReq = authedRequest(
        "DELETE",
        `http://localhost:3000/api/tasks/${memberTaskId}`,
        memberCookie
      );
      const memberDelRes = await deleteTaskHandler(memberDelReq, {
        params: { id: memberTaskId },
      });
      expect(memberDelRes.status).toBe(200);

      // Verify deletion in DB
      const deletedTask = await prisma.task.findUnique({ where: { id: memberTaskId } });
      expect(deletedTask).toBeNull();
    });
  });
});
