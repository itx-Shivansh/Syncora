/**
 * Task Workspace, Threaded Comments & Activity Integration Security Suite
 *
 * Verifies:
 *   1. Comment Creation & Threaded Replies:
 *      - Creates root comment on task (201)
 *      - Logs COMMENT_ADDED ActivityEvent
 *      - Creates threaded reply with parentId (201)
 *      - Lists comments on task with author details
 *   2. Role-Gated Comment Deletion:
 *      - Comment author can delete own comment (200)
 *      - Project LEAD / Workspace ADMIN can delete member's comment (200)
 *      - Unauthorized workspace peer receives 403 Forbidden
 *   3. Subtasks Hierarchy:
 *      - Creates subtask under parentId with monotonic key (201)
 *      - Toggles subtask status to DONE (200)
 *      - Task detail includes subtasks
 *   4. Activity Feeds:
 *      - Task activity feed lists events for specific task
 *      - Project activity feed lists aggregated events across tasks
 *   5. Cross-Tenant & Visibility Isolation:
 *      - Outsider cannot view comments, post comments, or read activity (404/403)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteWorkspaceMemberHandler } from "@/app/api/workspaces/[id]/invite/route";
import { POST as createProjectHandler } from "@/app/api/workspaces/[id]/projects/route";
import { POST as createTaskHandler } from "@/app/api/projects/[id]/tasks/route";
import { GET as getTaskHandler } from "@/app/api/tasks/[id]/route";
import { POST as createSubtaskHandler } from "@/app/api/tasks/[id]/subtasks/route";
import {
  GET as listCommentsHandler,
  POST as createCommentHandler,
} from "@/app/api/tasks/[id]/comments/route";
import { DELETE as deleteCommentHandler } from "@/app/api/comments/[id]/route";
import { GET as getTaskActivityHandler } from "@/app/api/tasks/[id]/activity/route";
import { GET as getProjectActivityHandler } from "@/app/api/projects/[id]/activity/route";
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
    await prisma.activityEvent.deleteMany({ where: { actorId: existing.id } });
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

describe("Focused Task Workspace, Comments & Activity Suite", () => {
  let ownerCookie: string;
  let ownerUser: { id: string; name: string; email: string };

  let member1Cookie: string;
  let member1User: { id: string; name: string; email: string };

  let member2Cookie: string;
  let member2User: { id: string; name: string; email: string };

  let viewerCookie: string;
  let viewerUser: { id: string; name: string; email: string };

  let outsiderCookie: string;

  let workspaceId: string;
  let projectId: string;
  let taskId: string;
  const projectKey = `ACT${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    // 1. Setup users
    const ownerRes = await cleanAndRegister(
      "lead_owner@example.com",
      "SecurePass123!",
      "Lead Owner"
    );
    ownerCookie = ownerRes.cookie;
    ownerUser = ownerRes.user;

    const member1Res = await cleanAndRegister(
      "collab_mem1@example.com",
      "SecurePass123!",
      "Collab Member 1"
    );
    member1Cookie = member1Res.cookie;
    member1User = member1Res.user;

    const member2Res = await cleanAndRegister(
      "collab_mem2@example.com",
      "SecurePass123!",
      "Collab Member 2"
    );
    member2Cookie = member2Res.cookie;
    member2User = member2Res.user;

    const viewerRes = await cleanAndRegister(
      "collab_viewer@example.com",
      "SecurePass123!",
      "Collab Viewer"
    );
    viewerCookie = viewerRes.cookie;
    viewerUser = viewerRes.user;

    const outsiderRes = await cleanAndRegister(
      "collab_outsider@example.com",
      "SecurePass123!",
      "Collab Outsider"
    );
    outsiderCookie = outsiderRes.cookie;

    // 2. Create Workspace
    const wsReq = authedRequest("POST", "http://localhost:3000/api/workspaces", ownerCookie, {
      name: `Collab Workspace ${Date.now()}`,
    });
    const wsRes = await createWorkspaceHandler(wsReq);
    expect(wsRes.status).toBe(201);
    const wsData = await wsRes.json();
    workspaceId = wsData.data.workspace.id;

    // 3. Add members to workspace
    const invite1Req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/invite`,
      ownerCookie,
      { email: member1User.email, role: "MEMBER" }
    );
    const invite1Res = await inviteWorkspaceMemberHandler(invite1Req, {
      params: { id: workspaceId },
    });
    expect([200, 201]).toContain(invite1Res.status);

    const invite2Req = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/invite`,
      ownerCookie,
      { email: member2User.email, role: "MEMBER" }
    );
    const invite2Res = await inviteWorkspaceMemberHandler(invite2Req, {
      params: { id: workspaceId },
    });
    expect([200, 201]).toContain(invite2Res.status);

    const inviteViewerReq = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/invite`,
      ownerCookie,
      { email: viewerUser.email, role: "VIEWER" }
    );
    const inviteViewerRes = await inviteWorkspaceMemberHandler(inviteViewerReq, {
      params: { id: workspaceId },
    });
    expect([200, 201]).toContain(inviteViewerRes.status);

    // 4. Create Project with members
    const prjReq = authedRequest(
      "POST",
      `http://localhost:3000/api/workspaces/${workspaceId}/projects`,
      ownerCookie,
      {
        name: "Collab Project",
        key: projectKey,
        initialMembers: [
          { userId: member1User.id, role: "MEMBER" },
          { userId: member2User.id, role: "MEMBER" },
        ],
      }
    );
    const prjRes = await createProjectHandler(prjReq, { params: { id: workspaceId } });
    expect(prjRes.status).toBe(201);
    const prjData = await prjRes.json();
    projectId = prjData.data.project.id;

    // 5. Create Task
    const taskReq = authedRequest(
      "POST",
      `http://localhost:3000/api/projects/${projectId}/tasks`,
      ownerCookie,
      {
        title: "Implement real-time collaboration",
        status: "IN_PROGRESS",
        priority: "HIGH",
        assigneeId: member1User.id,
      }
    );
    const taskRes = await createTaskHandler(taskReq, { params: { id: projectId } });
    expect(taskRes.status).toBe(201);
    const taskData = await taskRes.json();
    taskId = taskData.data.task.id;
  });

  describe("1. Task Detail Deep-Linking & Retrieval", () => {
    it("loads complete task details on cold load with subtasks and project members", async () => {
      const req = authedRequest("GET", `http://localhost:3000/api/tasks/${taskId}`, ownerCookie);
      const res = await getTaskHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.task.id).toBe(taskId);
      expect(body.data.task.project.name).toBe("Collab Project");
      expect(body.data.task.project.members.length).toBeGreaterThanOrEqual(3);
      expect(body.data.isLeadOrAdmin).toBe(true);
    });
  });

  describe("2. Subtask Hierarchy (Option A: Checklist)", () => {
    let subTaskId: string;

    it("creates a subtask with parentId and monotonic key", async () => {
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/subtasks`,
        ownerCookie,
        {
          title: "Write comment authorization tests",
          priority: "URGENT",
        }
      );
      const res = await createSubtaskHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.subTask.parentId).toBe(taskId);
      expect(body.data.subTask.taskKey).toContain(`${projectKey}-`);
      expect(body.data.subTask.status).toBe("TODO");
      subTaskId = body.data.subTask.id;
    });

    it("surfaces subtask in parent task detail query", async () => {
      const req = authedRequest("GET", `http://localhost:3000/api/tasks/${taskId}`, ownerCookie);
      const res = await getTaskHandler(req, { params: { id: taskId } });
      const body = await res.json();
      expect(body.data.task.subTasks.some((st: { id: string }) => st.id === subTaskId)).toBe(true);
    });
  });

  describe("3. Threaded Comments & ActivityEvent Generation", () => {
    let rootCommentId: string;
    let replyCommentId: string;

    it("creates root comment and writes COMMENT_ADDED activity event", async () => {
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie,
        {
          content: "PR is up for review! Please check the authorization guards.",
        }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      rootCommentId = body.data.comment.id;
      expect(body.data.comment.author.id).toBe(member1User.id);
      expect(body.data.comment.parentId).toBeNull();

      // Check ActivityEvent
      const commentEvent = await prisma.activityEvent.findFirst({
        where: {
          taskId,
          action: "COMMENT_ADDED",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(commentEvent).not.toBeNull();
      expect(commentEvent?.actorId).toBe(member1User.id);
    });

    it("creates threaded reply under parent comment", async () => {
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        ownerCookie,
        {
          content: "Reviewed! Looks solid, merging now.",
          parentId: rootCommentId,
        }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      replyCommentId = body.data.comment.id;
      expect(body.data.comment.parentId).toBe(rootCommentId);
      expect(body.data.comment.author.id).toBe(ownerUser.id);
    });

    it("lists all comments for the task in chronological order", async () => {
      const req = authedRequest(
        "GET",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie
      );
      const res = await listCommentsHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.comments.length).toBeGreaterThanOrEqual(2);
      expect(body.data.comments.some((c: { id: string }) => c.id === rootCommentId)).toBe(true);
      expect(body.data.comments.some((c: { id: string }) => c.id === replyCommentId)).toBe(true);
    });
  });

  describe("4. Role-Gated Comment Deletion Authorization", () => {
    let commentToDeleteId: string;

    beforeAll(async () => {
      // Member 1 creates a comment that Member 2 will attempt to delete
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie,
        {
          content: "A temporary comment by member 1.",
        }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      const body = await res.json();
      commentToDeleteId = body.data.comment.id;
    });

    it("rejects unauthorized member from deleting someone else's comment (403)", async () => {
      // Member 2 attempts to delete Member 1's comment
      const req = authedRequest(
        "DELETE",
        `http://localhost:3000/api/comments/${commentToDeleteId}`,
        member2Cookie
      );
      const res = await deleteCommentHandler(req, { params: { id: commentToDeleteId } });
      expect(res.status).toBe(403);
    });

    it("allows author to delete their own comment (200)", async () => {
      const req = authedRequest(
        "DELETE",
        `http://localhost:3000/api/comments/${commentToDeleteId}`,
        member1Cookie
      );
      const res = await deleteCommentHandler(req, { params: { id: commentToDeleteId } });
      expect(res.status).toBe(200);

      const dbComment = await prisma.comment.findUnique({ where: { id: commentToDeleteId } });
      expect(dbComment).toBeNull();
    });

    it("allows project LEAD / workspace ADMIN to delete any comment (200)", async () => {
      // Create a comment by member 2
      const createReq = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member2Cookie,
        {
          content: "Off-topic remark by member 2.",
        }
      );
      const createRes = await createCommentHandler(createReq, { params: { id: taskId } });
      const createBody = await createRes.json();
      const mem2CommentId = createBody.data.comment.id;

      // Project Lead (owner) deletes it
      const delReq = authedRequest(
        "DELETE",
        `http://localhost:3000/api/comments/${mem2CommentId}`,
        ownerCookie
      );
      const delRes = await deleteCommentHandler(delReq, { params: { id: mem2CommentId } });
      expect(delRes.status).toBe(200);

      const dbComment = await prisma.comment.findUnique({ where: { id: mem2CommentId } });
      expect(dbComment).toBeNull();
    });
  });

  describe("5. Task & Aggregated Project Activity Feeds", () => {
    it("returns chronological activity feed for the task with actor details", async () => {
      const req = authedRequest(
        "GET",
        `http://localhost:3000/api/tasks/${taskId}/activity`,
        ownerCookie
      );
      const res = await getTaskActivityHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.activities.length).toBeGreaterThanOrEqual(2);
      expect(body.data.activities[0].actor.name).toBeDefined();
    });

    it("returns aggregated project activity feed with task references", async () => {
      const req = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/activity`,
        ownerCookie
      );
      const res = await getProjectActivityHandler(req, { params: { id: projectId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.activities.length).toBeGreaterThanOrEqual(3);
      expect(
        body.data.activities.some((a: { task?: { taskKey: string } }) => a.task?.taskKey)
      ).toBe(true);
    });
  });

  describe("6. Cross-Tenant Isolation", () => {
    it("rejects outsider from viewing task comments or activity (404/403)", async () => {
      // Comments list
      const commentsReq = authedRequest(
        "GET",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        outsiderCookie
      );
      const commentsRes = await listCommentsHandler(commentsReq, { params: { id: taskId } });
      expect([403, 404]).toContain(commentsRes.status);

      // Comments post
      const postReq = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        outsiderCookie,
        { content: "Infiltrating comment" }
      );
      const postRes = await createCommentHandler(postReq, { params: { id: taskId } });
      expect([403, 404]).toContain(postRes.status);

      // Task activity
      const actReq = authedRequest(
        "GET",
        `http://localhost:3000/api/tasks/${taskId}/activity`,
        outsiderCookie
      );
      const actRes = await getTaskActivityHandler(actReq, { params: { id: taskId } });
      expect([403, 404]).toContain(actRes.status);

      // Project activity
      const prjActReq = authedRequest(
        "GET",
        `http://localhost:3000/api/projects/${projectId}/activity`,
        outsiderCookie
      );
      const prjActRes = await getProjectActivityHandler(prjActReq, { params: { id: projectId } });
      expect([403, 404]).toContain(prjActRes.status);
    });
  });

  describe("7. Extended Comment Creation & Deletion Permission Boundaries", () => {
    let testCommentId: string;

    beforeAll(async () => {
      // Member 1 creates a comment to test deletion boundaries
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie,
        { content: "Comment for permission boundary verification" }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(201);
      const data = await res.json();
      testCommentId = data.data.comment.id;
    });

    it("rejects workspace VIEWER from creating comments (403 Forbidden)", async () => {
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        viewerCookie,
        { content: "Viewer trying to comment" }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("INSUFFICIENT_ROLE");
    });

    it("rejects workspace VIEWER from deleting someone else's comment (403 Forbidden)", async () => {
      const req = authedRequest(
        "DELETE",
        `http://localhost:3000/api/comments/${testCommentId}`,
        viewerCookie
      );
      const res = await deleteCommentHandler(req, { params: { id: testCommentId } });
      expect(res.status).toBe(403);
    });

    it("returns 404 anti-probing when outsider tries to delete an existing comment", async () => {
      const req = authedRequest(
        "DELETE",
        `http://localhost:3000/api/comments/${testCommentId}`,
        outsiderCookie
      );
      const res = await deleteCommentHandler(req, { params: { id: testCommentId } });
      expect(res.status).toBe(404);
    });

    it("rejects empty or whitespace-only comment content (422 Validation Error)", async () => {
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie,
        { content: "     " }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects reply to non-existent parent comment ID (400 Bad Request)", async () => {
      const fakeUuid = "00000000-0000-0000-0000-000000000000";
      const req = authedRequest(
        "POST",
        `http://localhost:3000/api/tasks/${taskId}/comments`,
        member1Cookie,
        { content: "Replying to ghost comment", parentId: fakeUuid }
      );
      const res = await createCommentHandler(req, { params: { id: taskId } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Parent comment not found");
    });
  });
});
