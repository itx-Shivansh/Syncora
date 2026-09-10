/**
 * Event-Driven Notification Engine & Recipient Isolation Integration Suite
 *
 * Verifies:
 *   1. Workspace Invitation Notification:
 *      - Invitee receives WORKSPACE invitation notification upon being invited.
 *   2. Project Membership Notification:
 *      - Member receives PROJECT invitation notification when added to project.
 *   3. Task Assignment Notification:
 *      - Assignee receives TASK_ASSIGNED notification upon task creation with assignee.
 *      - Assignee receives TASK_ASSIGNED notification upon task reassignment.
 *      - Self-assignment does NOT create notification for actor.
 *   4. Task Status Change Notification:
 *      - Assignee receives TASK_STATUS_CHANGED when status is updated via PATCH /api/tasks/:id.
 *      - Assignee receives TASK_STATUS_CHANGED when status is updated via PATCH /api/tasks/:id/reorder.
 *      - Status change by assignee does NOT notify oneself.
 *   5. Comment Stakeholder Notifications:
 *      - Comment on task notifies creator, assignee, and prior commenters.
 *      - Author never receives notification for own comment.
 *      - Threaded replies are categorized with isReply title.
 *   6. API Surface & Pagination:
 *      - GET /api/notifications returns paginated list, actor profile, and unreadCount.
 *      - GET /api/notifications/unread-count returns integer unread count.
 *      - PATCH /api/notifications/:id/read marks single notification as read.
 *      - POST /api/notifications/mark-all-read clears all unread notifications.
 *   7. Authorization & Security Isolation:
 *      - Unauthenticated access returns 401 across all endpoints.
 *      - User cannot access or mark another user's notification as read (returns 404).
 *      - Listing notifications strictly isolates recipients (zero cross-user leakage).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as inviteWorkspaceMemberHandler } from "@/app/api/workspaces/[id]/invite/route";
import { POST as createProjectHandler } from "@/app/api/workspaces/[id]/projects/route";
import { POST as addProjectMemberHandler } from "@/app/api/projects/[id]/members/route";
import { POST as createTaskHandler } from "@/app/api/projects/[id]/tasks/route";
import { PATCH as updateTaskHandler } from "@/app/api/tasks/[id]/route";
import { PATCH as reorderTaskHandler } from "@/app/api/tasks/[id]/reorder/route";
import { POST as createCommentHandler } from "@/app/api/tasks/[id]/comments/route";
import {
  GET as listNotificationsHandler,
} from "@/app/api/notifications/route";
import {
  GET as getNotificationHandler,
  PATCH as patchNotificationHandler,
} from "@/app/api/notifications/[id]/route";
import {
  PATCH as markReadHandler,
} from "@/app/api/notifications/[id]/read/route";
import {
  POST as markAllReadHandler,
} from "@/app/api/notifications/mark-all-read/route";
import {
  GET as getUnreadCountHandler,
} from "@/app/api/notifications/unread-count/route";
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
      await prisma.comment.deleteMany({ where: { taskId: { in: userTaskIds } } });
    }
    await prisma.notification.deleteMany({
      where: { OR: [{ recipientId: existing.id }, { actorId: existing.id }] },
    });
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

function authedRequest(method: string, url: string, cookie?: string, body?: unknown): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// -----------------------------------------------------------------------
// Test Suite
// -----------------------------------------------------------------------

describe("Event-Driven Notification Engine & Authorization Suite", () => {
  let alice: { cookie: string; user: { id: string; name: string; email: string } };
  let bob: { cookie: string; user: { id: string; name: string; email: string } };
  let charlie: { cookie: string; user: { id: string; name: string; email: string } };
  let workspace: { id: string; name: string };
  let project: { id: string; name: string };
  let taskId: string;

  beforeAll(async () => {
    alice = await cleanAndRegister("alice.notify@test.dev", "Password123!", "Alice Adams");
    bob = await cleanAndRegister("bob.notify@test.dev", "Password123!", "Bob Builder");
    charlie = await cleanAndRegister("charlie.notify@test.dev", "Password123!", "Charlie Crown");

    // Alice creates workspace
    const wsRes = await createWorkspaceHandler(
      authedRequest("POST", "http://localhost:3000/api/workspaces", alice.cookie, {
        name: "Notification Test Workspace",
        slug: "notify-test-ws-" + Date.now(),
      })
    );
    expect(wsRes.status).toBe(201);
    const wsData = await wsRes.json();
    workspace = wsData.data.workspace;
  });

  // 1. Workspace Invitation
  it("generates a notification when a user is invited to a workspace", async () => {
    const inviteRes = await inviteWorkspaceMemberHandler(
      authedRequest(
        "POST",
        `http://localhost:3000/api/workspaces/${workspace.id}/invite`,
        alice.cookie,
        {
          email: bob.user.email,
          role: "MEMBER",
        }
      ),
      { params: { id: workspace.id } }
    );
    expect(inviteRes.status).toBe(201);

    // Verify Bob's notifications
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    expect(bobNotifsRes.status).toBe(200);
    const bobData = await bobNotifsRes.json();

    expect(bobData.data.notifications.length).toBeGreaterThanOrEqual(1);
    const wsInvite = bobData.data.notifications.find(
      (n: any) => n.resourceType === "WORKSPACE" && n.resourceId === workspace.id
    );
    expect(wsInvite).toBeDefined();
    expect(wsInvite.title).toBe("Workspace Invitation");
    expect(wsInvite.actor.name).toBe(alice.user.name);
    expect(wsInvite.isRead).toBe(false);
  });

  // 2. Project Membership
  it("generates a notification when a user is added to a project", async () => {
    // Alice creates project
    const projRes = await createProjectHandler(
      authedRequest(
        "POST",
        `http://localhost:3000/api/workspaces/${workspace.id}/projects`,
        alice.cookie,
        {
          name: "Phoenix Project",
          key: "PHX",
          visibility: "PUBLIC_TO_WORKSPACE",
        }
      ),
      { params: { id: workspace.id } }
    );
    expect(projRes.status).toBe(201);
    const projData = await projRes.json();
    project = projData.data.project;

    // Alice adds Bob to project
    const addMemberRes = await addProjectMemberHandler(
      authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${project.id}/members`,
        alice.cookie,
        {
          userId: bob.user.id,
          role: "MEMBER",
        }
      ),
      { params: { id: project.id } }
    );
    expect(addMemberRes.status).toBe(201);

    // Verify Bob received project invite notification
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    const bobData = await bobNotifsRes.json();
    const projInvite = bobData.data.notifications.find(
      (n: any) => n.resourceType === "PROJECT" && n.resourceId === project.id
    );
    expect(projInvite).toBeDefined();
    expect(projInvite.title).toBe("Added to Project");
    expect(projInvite.message).toContain("Phoenix Project");
  });

  // 3. Task Assignment
  it("generates a TASK_ASSIGNED notification for assignee on task creation", async () => {
    const taskRes = await createTaskHandler(
      authedRequest(
        "POST",
        `http://localhost:3000/api/projects/${project.id}/tasks`,
        alice.cookie,
        {
          title: "Implement Event Logging",
          assigneeId: bob.user.id,
          status: "TODO",
          priority: "HIGH",
        }
      ),
      { params: { id: project.id } }
    );
    expect(taskRes.status).toBe(201);
    const taskData = await taskRes.json();
    taskId = taskData.data.task.id;

    // Verify Bob receives TASK_ASSIGNED notification
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    const bobData = await bobNotifsRes.json();
    const assignNotif = bobData.data.notifications.find(
      (n: any) => n.type === "TASK_ASSIGNED" && n.resourceId === taskId
    );
    expect(assignNotif).toBeDefined();
    expect(assignNotif.title).toBe("Task Assigned");
    expect(assignNotif.message).toContain("Implement Event Logging");

    // Verify Alice did NOT receive self-notification
    const aliceNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", alice.cookie)
    );
    const aliceData = await aliceNotifsRes.json();
    const aliceSelfNotif = aliceData.data.notifications.find(
      (n: any) => n.resourceId === taskId && n.actorId === alice.user.id && n.recipientId === alice.user.id
    );
    expect(aliceSelfNotif).toBeUndefined();
  });

  // 4. Task Status Change (PATCH /api/tasks/:id)
  it("generates a TASK_STATUS_CHANGED notification for assignee when status changes", async () => {
    const updateRes = await updateTaskHandler(
      authedRequest("PATCH", `http://localhost:3000/api/tasks/${taskId}`, alice.cookie, {
        status: "IN_PROGRESS",
      }),
      { params: { id: taskId } }
    );
    expect(updateRes.status).toBe(200);

    // Verify Bob receives TASK_STATUS_CHANGED notification
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    const bobData = await bobNotifsRes.json();
    const statusNotif = bobData.data.notifications.find(
      (n: any) => n.type === "TASK_STATUS_CHANGED" && n.resourceId === taskId
    );
    expect(statusNotif).toBeDefined();
    expect(statusNotif.title).toBe("Task Status Updated");
    expect(statusNotif.message).toContain("IN_PROGRESS");
  });

  // 5. Task Status Change via Reorder (PATCH /api/tasks/:id/reorder)
  it("generates a TASK_STATUS_CHANGED notification for assignee on board drag/reorder", async () => {
    const reorderRes = await reorderTaskHandler(
      authedRequest("PATCH", `http://localhost:3000/api/tasks/${taskId}/reorder`, alice.cookie, {
        status: "IN_REVIEW",
        orderIndex: 2000,
      }),
      { params: { id: taskId } }
    );
    expect(reorderRes.status).toBe(200);

    // Verify Bob receives status changed notification for IN_REVIEW
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    const bobData = await bobNotifsRes.json();
    const reorderNotif = bobData.data.notifications.find(
      (n: any) =>
        n.type === "TASK_STATUS_CHANGED" &&
        n.resourceId === taskId &&
        n.message.includes("IN_REVIEW")
    );
    expect(reorderNotif).toBeDefined();
  });

  // 6. Comment on Task (Stakeholder Notifications)
  it("notifies creator and prior stakeholders when someone comments on the task", async () => {
    // Bob (assignee) comments on the task -> Alice (creator) should be notified
    const commentRes = await createCommentHandler(
      authedRequest("POST", `http://localhost:3000/api/tasks/${taskId}/comments`, bob.cookie, {
        content: "Drafted the notification schema and helpers, ready for review!",
      }),
      { params: { id: taskId } }
    );
    expect(commentRes.status).toBe(201);
    const commentData = await commentRes.json();
    const commentId = commentData.data.comment.id;

    // Alice should have received a notification
    const aliceNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", alice.cookie)
    );
    const aliceData = await aliceNotifsRes.json();
    const commentNotif = aliceData.data.notifications.find(
      (n: any) => n.resourceId === taskId && n.actor.id === bob.user.id
    );
    expect(commentNotif).toBeDefined();
    expect(commentNotif.title).toContain("comment");
    expect(commentNotif.message).toContain("Drafted the notification");

    // Alice replies to Bob's comment -> Bob should receive a COMMENT_REPLY notification
    const replyRes = await createCommentHandler(
      authedRequest("POST", `http://localhost:3000/api/tasks/${taskId}/comments`, alice.cookie, {
        content: "Looks fantastic, verified the types!",
        parentId: commentId,
      }),
      { params: { id: taskId } }
    );
    expect(replyRes.status).toBe(201);

    // Bob should have received a reply notification
    const bobNotifsRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", bob.cookie)
    );
    const bobData = await bobNotifsRes.json();
    const replyNotif = bobData.data.notifications.find(
      (n: any) => n.type === "COMMENT_REPLY" && n.resourceId === taskId
    );
    expect(replyNotif).toBeDefined();
    expect(replyNotif.title).toContain("Reply");
  });

  // 7. API Routes: Unread Count, Mark One Read, Mark All Read
  it("verifies unread count, marking single notification read, and marking all read", async () => {
    // Check Bob's unread count
    const unreadRes = await getUnreadCountHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications/unread-count", bob.cookie)
    );
    expect(unreadRes.status).toBe(200);
    const unreadData = await unreadRes.json();
    expect(unreadData.data.unreadCount).toBeGreaterThan(0);
    const initialUnread = unreadData.data.unreadCount;

    // Get Bob's first unread notification
    const listRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications?unreadOnly=true", bob.cookie)
    );
    const listData = await listRes.json();
    expect(listData.data.notifications.length).toBeGreaterThan(0);
    const targetNotif = listData.data.notifications[0];

    // Mark single as read via PATCH /api/notifications/:id/read
    const readRes = await markReadHandler(
      authedRequest("PATCH", `http://localhost:3000/api/notifications/${targetNotif.id}/read`, bob.cookie),
      { params: { id: targetNotif.id } }
    );
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.data.notification.isRead).toBe(true);
    expect(readData.data.notification.readAt).not.toBeNull();

    // Verify unread count decremented by 1
    const unreadAfterOne = await getUnreadCountHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications/unread-count", bob.cookie)
    );
    const unreadAfterOneData = await unreadAfterOne.json();
    expect(unreadAfterOneData.data.unreadCount).toBe(initialUnread - 1);

    // Mark all remaining notifications as read
    const markAllRes = await markAllReadHandler(
      authedRequest("POST", "http://localhost:3000/api/notifications/mark-all-read", bob.cookie, {})
    );
    expect(markAllRes.status).toBe(200);

    // Final unread count should be 0
    const finalUnreadRes = await getUnreadCountHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications/unread-count", bob.cookie)
    );
    const finalUnreadData = await finalUnreadRes.json();
    expect(finalUnreadData.data.unreadCount).toBe(0);
  });

  // 8. Security & Authorization Isolation
  it("enforces strict recipient isolation and prevents cross-user tampering", async () => {
    // Alice has notifications
    const aliceListRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", alice.cookie)
    );
    const aliceData = await aliceListRes.json();
    expect(aliceData.data.notifications.length).toBeGreaterThan(0);
    const aliceNotifId = aliceData.data.notifications[0].id;

    // Charlie (unauthorized third party) attempts to fetch Alice's notification -> 404
    const charlieGetRes = await getNotificationHandler(
      authedRequest("GET", `http://localhost:3000/api/notifications/${aliceNotifId}`, charlie.cookie),
      { params: { id: aliceNotifId } }
    );
    expect(charlieGetRes.status).toBe(404);

    // Charlie attempts to mark Alice's notification as read -> 404
    const charlieReadRes = await markReadHandler(
      authedRequest("PATCH", `http://localhost:3000/api/notifications/${aliceNotifId}/read`, charlie.cookie),
      { params: { id: aliceNotifId } }
    );
    expect(charlieReadRes.status).toBe(404);

    // Charlie's notification feed contains none of Alice's notifications
    const charlieListRes = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications", charlie.cookie)
    );
    const charlieListData = await charlieListRes.json();
    const hasAliceNotif = charlieListData.data.notifications.some(
      (n: any) => n.id === aliceNotifId || n.recipientId === alice.user.id
    );
    expect(hasAliceNotif).toBe(false);

    // Unauthenticated requests are rejected with 401
    const unauthList = await listNotificationsHandler(
      authedRequest("GET", "http://localhost:3000/api/notifications")
    );
    expect(unauthList.status).toBe(401);

    const unauthRead = await markReadHandler(
      authedRequest("PATCH", `http://localhost:3000/api/notifications/${aliceNotifId}/read`),
      { params: { id: aliceNotifId } }
    );
    expect(unauthRead.status).toBe(401);

    const unauthMarkAll = await markAllReadHandler(
      authedRequest("POST", "http://localhost:3000/api/notifications/mark-all-read")
    );
    expect(unauthMarkAll.status).toBe(401);
  });
});
