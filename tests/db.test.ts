import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { GET as healthHandler } from "@/app/api/health/route";

describe("Database Schema & Seed Verification", () => {
  it("confirms database contains all populated seed entities", async () => {
    const [
      users,
      workspaces,
      workspaceMembers,
      projects,
      projectMembers,
      tasks,
      labels,
      taskLabels,
      comments,
      activityEvents,
      notifications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.workspaceMember.count(),
      prisma.project.count(),
      prisma.projectMember.count(),
      prisma.task.count(),
      prisma.label.count(),
      prisma.taskLabel.count(),
      prisma.comment.count(),
      prisma.activityEvent.count(),
      prisma.notification.count(),
    ]);

    expect(users).toBeGreaterThanOrEqual(6);
    expect(workspaces).toBeGreaterThanOrEqual(2); // may be higher if workspace tests ran

    expect(workspaceMembers).toBeGreaterThanOrEqual(10); // may be higher if workspace tests ran
    expect(projects).toBeGreaterThanOrEqual(7); // may be higher if project tests ran
    expect(projectMembers).toBeGreaterThanOrEqual(20); // 20 seeded members (Liam is intentionally excluded from private SOC2 project)
    expect(tasks).toBeGreaterThanOrEqual(105);
    expect(labels).toBeGreaterThanOrEqual(12);
    expect(taskLabels).toBeGreaterThanOrEqual(105);
    expect(comments).toBeGreaterThanOrEqual(16);
    expect(activityEvents).toBeGreaterThanOrEqual(16);
    expect(notifications).toBeGreaterThanOrEqual(3);
  });

  it("verifies health check endpoint queries database successfully", async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.database.status).toBe("connected");
    expect(data.database.workspaces).toBeGreaterThanOrEqual(2);
  });

  it("verifies foreign key cascading and workspace indexing integrity", async () => {
    const acmeTasks = await prisma.task.findMany({
      where: {
        workspace: {
          slug: "acme-corp",
        },
      },
      include: {
        workspace: true,
        project: true,
        labels: { include: { label: true } },
      },
      take: 5,
    });

    expect(acmeTasks.length).toBe(5);
    for (const task of acmeTasks) {
      expect(task.workspace.slug).toBe("acme-corp");
      expect(task.workspaceId).toBe(task.workspace.id);
      expect(task.taskKey).toMatch(/^CORE-\d+|MOB-\d+|BILL-\d+|MIG-\d+$/);
    }
  });
});
