import { describe, it, expect } from "vitest";
import { computeProjectHealth, HealthInputProject } from "@/lib/project-health";

describe("Project Health & Risk Scoring Engine (Chunk 15)", () => {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  it("1. Healthy project with 0 overdue tasks scores high and marks ON_TRACK", () => {
    const project: HealthInputProject = {
      id: "prj_healthy",
      name: "Healthy Web App",
      status: "ACTIVE",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(30),
      tasks: [
        {
          id: "t1",
          status: "DONE",
          dueDate: daysAgo(5),
          updatedAt: daysAgo(2),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alice" },
        },
        {
          id: "t2",
          status: "DONE",
          dueDate: daysAgo(3),
          updatedAt: daysAgo(1),
          assigneeId: "u2",
          assignee: { id: "u2", name: "Bob" },
        },
        {
          id: "t3",
          status: "DONE",
          dueDate: daysAhead(5),
          updatedAt: daysAgo(1),
          assigneeId: "u3",
          assignee: { id: "u3", name: "Charlie" },
        },
        {
          id: "t4",
          status: "IN_PROGRESS",
          dueDate: daysAhead(10),
          updatedAt: daysAgo(1),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alice" },
        },
        {
          id: "t5",
          status: "TODO",
          dueDate: daysAhead(15),
          updatedAt: daysAgo(1),
          assigneeId: "u2",
          assignee: { id: "u2", name: "Bob" },
        },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.score).toBeGreaterThanOrEqual(80);
    expect(health.status).toBe("ON_TRACK");
    expect(health.label).toBe("On Track");
    expect(health.isAtRisk).toBe(false);
    expect(health.breakdown.overdueCount).toBe(0);
    expect(health.reasons.some((r) => r.includes("within schedule"))).toBe(true);
  });

  it("2. Project with high overdue ratio flags AT_RISK with explicit overdue reasoning", () => {
    const project: HealthInputProject = {
      id: "prj_overdue",
      name: "Delayed Platform",
      status: "ACTIVE",
      createdAt: daysAgo(40),
      updatedAt: daysAgo(2),
      targetEndDate: daysAhead(10),
      tasks: [
        {
          id: "t1",
          status: "IN_PROGRESS",
          dueDate: daysAgo(10),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alice" },
        },
        {
          id: "t2",
          status: "TODO",
          dueDate: daysAgo(5),
          assigneeId: "u2",
          assignee: { id: "u2", name: "Bob" },
        },
        {
          id: "t3",
          status: "IN_REVIEW",
          dueDate: daysAgo(2),
          assigneeId: "u3",
          assignee: { id: "u3", name: "Charlie" },
        },
        {
          id: "t4",
          status: "TODO",
          dueDate: daysAhead(10),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alice" },
        },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.score).toBeLessThan(60);
    expect(health.isAtRisk).toBe(true);
    expect(health.breakdown.overdueCount).toBe(3);
    expect(health.breakdown.overduePercent).toBe(75);
    expect(health.reasons.some((r) => r.includes("overdue"))).toBe(true);
  });

  it("3. Workload bottleneck is detected when single assignee holds > 65% of active tasks", () => {
    const project: HealthInputProject = {
      id: "prj_bottleneck",
      name: "Bottleneck Project",
      status: "ACTIVE",
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(20),
      tasks: [
        {
          id: "t1",
          status: "IN_PROGRESS",
          dueDate: daysAhead(5),
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t2",
          status: "TODO",
          dueDate: daysAhead(6),
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t3",
          status: "IN_REVIEW",
          dueDate: daysAhead(7),
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t4",
          status: "TODO",
          dueDate: daysAhead(8),
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t5",
          status: "TODO",
          dueDate: daysAhead(9),
          assigneeId: "u_sarah",
          assignee: { id: "u_sarah", name: "Sarah Jenkins" },
        },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.breakdown.topAssigneeName).toBe("Marcus Vance");
    expect(health.breakdown.topAssigneeShare).toBe(0.8);
    expect(health.reasons.some((r) => r.includes("Marcus Vance") && r.includes("bottleneck"))).toBe(
      true
    );
  });

  it("4. ON_HOLD project receives explicit penalty and driver explanation (like Billing V2)", () => {
    const project: HealthInputProject = {
      id: "prj_billing_v2",
      name: "Billing & Invoicing V2",
      status: "ON_HOLD",
      createdAt: daysAgo(40),
      updatedAt: daysAgo(3),
      targetEndDate: daysAhead(20),
      tasks: [
        {
          id: "t1",
          status: "TODO",
          dueDate: daysAgo(5), // overdue
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t2",
          status: "IN_PROGRESS",
          dueDate: daysAgo(2), // overdue
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
        {
          id: "t3",
          status: "TODO",
          dueDate: daysAhead(5),
          assigneeId: "u_marcus",
          assignee: { id: "u_marcus", name: "Marcus Vance" },
        },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.status).toBe("AT_RISK");
    expect(health.label).toBe("At Risk");
    expect(health.isAtRisk).toBe(true);
    expect(health.reasons).toContain("Project status is explicitly On Hold");
  });

  it("5. Completed project returns score 100 and ON_TRACK", () => {
    const project: HealthInputProject = {
      id: "prj_completed",
      name: "Legacy Migration",
      status: "COMPLETED",
      createdAt: daysAgo(90),
      updatedAt: daysAgo(10),
      targetEndDate: daysAgo(10),
      tasks: [
        { id: "t1", status: "DONE", dueDate: daysAgo(15) },
        { id: "t2", status: "DONE", dueDate: daysAgo(12) },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.score).toBe(100);
    expect(health.status).toBe("ON_TRACK");
    expect(health.isAtRisk).toBe(false);
  });

  it("6. Edge Case: Project with 0 tasks computes sensible defaults without division by zero", () => {
    const project: HealthInputProject = {
      id: "prj_zero_tasks",
      name: "Empty Green Field Project",
      status: "ACTIVE",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(45),
      tasks: [],
    };

    const health = computeProjectHealth(project);
    expect(health.score).toBeGreaterThanOrEqual(70);
    expect(health.status).not.toBe("AT_RISK");
    expect(health.isAtRisk).toBe(false);
    expect(health.breakdown.totalTasks).toBe(0);
    expect(health.breakdown.activeTasks).toBe(0);
    expect(health.breakdown.overdueCount).toBe(0);
    expect(health.breakdown.overduePercent).toBe(0);
    expect(health.reasons.some((r) => r.includes("within schedule"))).toBe(true);
  });

  it("7. Edge Case: Project with all tasks overdue (100% overdue boundary) receives maximum penalty", () => {
    const project: HealthInputProject = {
      id: "prj_all_overdue",
      name: "Completely Slipped Project",
      status: "ACTIVE",
      createdAt: daysAgo(30),
      updatedAt: daysAgo(1),
      targetEndDate: daysAgo(5),
      tasks: [
        {
          id: "t1",
          status: "TODO",
          dueDate: daysAgo(10),
          assigneeId: "u1",
          assignee: { id: "u1", name: "Alice" },
        },
        {
          id: "t2",
          status: "IN_PROGRESS",
          dueDate: daysAgo(8),
          assigneeId: "u2",
          assignee: { id: "u2", name: "Bob" },
        },
        {
          id: "t3",
          status: "IN_REVIEW",
          dueDate: daysAgo(3),
          assigneeId: "u3",
          assignee: { id: "u3", name: "Charlie" },
        },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.breakdown.overdueCount).toBe(3);
    expect(health.breakdown.activeTasks).toBe(3);
    expect(health.breakdown.overduePercent).toBe(100);
    expect(health.breakdown.overdueScore).toBe(0);
    expect(health.status).toBe("AT_RISK");
    expect(health.isAtRisk).toBe(true);
    expect(health.score).toBeLessThanOrEqual(40);
    expect(health.reasons.some((r) => r.includes("Critical overdue volume") && r.includes("100%"))).toBe(true);
  });

  it("8. Edge Case: Perfectly even workload distribution across multiple assignees", () => {
    const project: HealthInputProject = {
      id: "prj_even_workload",
      name: "Balanced Sprint Initiative",
      status: "ACTIVE",
      createdAt: daysAgo(10),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(20),
      tasks: [
        { id: "t1", status: "TODO", dueDate: daysAhead(5), assigneeId: "u1", assignee: { id: "u1", name: "Alice" } },
        { id: "t2", status: "IN_PROGRESS", dueDate: daysAhead(6), assigneeId: "u1", assignee: { id: "u1", name: "Alice" } },
        { id: "t3", status: "TODO", dueDate: daysAhead(5), assigneeId: "u2", assignee: { id: "u2", name: "Bob" } },
        { id: "t4", status: "IN_PROGRESS", dueDate: daysAhead(6), assigneeId: "u2", assignee: { id: "u2", name: "Bob" } },
        { id: "t5", status: "TODO", dueDate: daysAhead(7), assigneeId: "u3", assignee: { id: "u3", name: "Charlie" } },
        { id: "t6", status: "IN_PROGRESS", dueDate: daysAhead(8), assigneeId: "u3", assignee: { id: "u3", name: "Charlie" } },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.breakdown.workloadScore).toBe(95);
    expect(health.breakdown.topAssigneeShare).toBeCloseTo(0.333, 2);
    expect(health.reasons).toContain("Workload evenly distributed across 3 assignees");
  });

  it("9. Edge Case: High unassigned workload (> 45% lacking assignees) triggers workload warning", () => {
    const project: HealthInputProject = {
      id: "prj_unassigned",
      name: "Unassigned Triage Backlog",
      status: "ACTIVE",
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(30),
      tasks: [
        { id: "t1", status: "TODO", dueDate: daysAhead(10), assigneeId: null },
        { id: "t2", status: "TODO", dueDate: daysAhead(12), assigneeId: null },
        { id: "t3", status: "TODO", dueDate: daysAhead(15), assigneeId: null },
        { id: "t4", status: "IN_PROGRESS", dueDate: daysAhead(10), assigneeId: "u1", assignee: { id: "u1", name: "Alice" } },
      ],
    };

    const health = computeProjectHealth(project);
    // 3 out of 4 (75%) are unassigned
    expect(health.breakdown.workloadScore).toBeLessThanOrEqual(75);
    expect(health.reasons.some((r) => r.includes("High unassigned workload") && r.includes("75%"))).toBe(true);
  });

  it("10. Edge Case: Active project with 100% of tasks finished (all DONE)", () => {
    const project: HealthInputProject = {
      id: "prj_all_done",
      name: "Nearly Wrapped Feature",
      status: "ACTIVE",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(1),
      targetEndDate: daysAhead(10),
      tasks: [
        { id: "t1", status: "DONE", dueDate: daysAgo(2), updatedAt: daysAgo(1) },
        { id: "t2", status: "DONE", dueDate: daysAgo(1), updatedAt: daysAgo(1) },
        { id: "t3", status: "DONE", dueDate: daysAhead(2), updatedAt: daysAgo(1) },
      ],
    };

    const health = computeProjectHealth(project);
    expect(health.score).toBeGreaterThanOrEqual(90);
    expect(health.status).toBe("ON_TRACK");
    expect(health.isAtRisk).toBe(false);
    expect(health.breakdown.activeTasks).toBe(0);
    expect(health.reasons).toContain("All project tasks are finished or resolved");
  });
});
