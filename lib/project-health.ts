/**
 * lib/project-health.ts
 *
 * Syncora Project Health & Operational Risk Scoring Engine (Chunk 15)
 *
 * Evaluates real workspace operational graph data across 4 core vectors:
 *   1. Overdue Task Burden (35% weight): Ratio of overdue active tasks to total active tasks.
 *   2. Workload Distribution & Bottlenecks (25% weight): Concentration of active tasks on a single assignee.
 *   3. Velocity & Milestone Momentum (20% weight): Tasks completed in past 14 days vs target completion date proximity.
 *   4. Activity Recency (20% weight): Elapsed time since last recorded project or task modification.
 *
 * Additional modifiers:
 *   - Status Penalties: ON_HOLD (-20 penalty).
 *   - Completed: Score fixed at 100 (On Track).
 *
 * Produces:
 *   - Composite score: 0 to 100
 *   - Status tier: ON_TRACK (75-100), NEEDS_ATTENTION (50-74), AT_RISK (0-49)
 *   - Human-readable driver explanations ("why")
 */

export interface HealthInputTask {
  id: string;
  status: string;
  dueDate: Date | string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string } | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface HealthInputProject {
  id: string;
  name?: string;
  status: string; // 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
  targetStartDate?: Date | string | null;
  targetEndDate?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
  lastActivityAt?: Date | string | null;
  tasks: HealthInputTask[];
}

export type ProjectHealthStatus = "ON_TRACK" | "NEEDS_ATTENTION" | "AT_RISK";

export interface HealthBreakdown {
  overdueScore: number;
  workloadScore: number;
  velocityScore: number;
  activityScore: number;
  overdueCount: number;
  totalTasks: number;
  activeTasks: number;
  overduePercent: number;
  topAssigneeName: string | null;
  topAssigneeShare: number; // 0.0 to 1.0
  recentCompletedCount: number;
  daysSinceLastActivity: number;
  statusPenalty: number;
}

export interface ProjectHealthResult {
  score: number; // 0 - 100
  status: ProjectHealthStatus;
  label: "On Track" | "Needs Attention" | "At Risk";
  color: string;
  badgeVariant: "status-done" | "status-todo" | "status-backlog";
  reasons: string[];
  breakdown: HealthBreakdown;
  isAtRisk: boolean; // Backwards-compatible boolean flag for existing Chunk 9 consumers
}

export function computeProjectHealth(project: HealthInputProject): ProjectHealthResult {
  const now = new Date();
  const tasks = project.tasks || [];
  const totalTasks = tasks.length;

  // Fully completed project handling
  if (project.status === "COMPLETED") {
    return {
      score: 100,
      status: "ON_TRACK",
      label: "On Track",
      color: "#10B981",
      badgeVariant: "status-done",
      reasons: ["Project is officially completed"],
      breakdown: {
        overdueScore: 100,
        workloadScore: 100,
        velocityScore: 100,
        activityScore: 100,
        overdueCount: 0,
        totalTasks,
        activeTasks: 0,
        overduePercent: 0,
        topAssigneeName: null,
        topAssigneeShare: 0,
        recentCompletedCount: tasks.filter((t) => t.status === "DONE").length,
        daysSinceLastActivity: 0,
        statusPenalty: 0,
      },
      isAtRisk: false,
    };
  }

  // Active tasks = everything not DONE and not CANCELLED
  const activeTasks = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  const activeCount = activeTasks.length;

  // 1. OVERDUE TASK FACTOR (Weight: 35%)
  const overdueTasks = activeTasks.filter(
    (t) => t.dueDate !== null && new Date(t.dueDate) < now
  );
  const overdueCount = overdueTasks.length;
  const overdueRatio = activeCount > 0 ? overdueCount / activeCount : 0;
  const overduePercent = Math.round(overdueRatio * 100);

  let overdueScore = 100;
  const reasons: string[] = [];

  if (activeCount === 0 && totalTasks > 0) {
    overdueScore = 100;
    reasons.push("All project tasks are finished or resolved");
  } else if (overdueCount === 0) {
    overdueScore = 100;
    reasons.push("All active tasks are currently within schedule");
  } else if (overdueRatio <= 0.15) {
    overdueScore = 80;
    reasons.push(
      `${overdueCount} overdue task${overdueCount > 1 ? "s" : ""} (${overduePercent}% of active work)`
    );
  } else if (overdueRatio <= 0.3) {
    overdueScore = 45;
    reasons.push(
      `${overdueCount} overdue tasks (${overduePercent}% of active work past due date)`
    );
  } else {
    overdueScore = Math.max(0, Math.round(100 - overdueRatio * 130));
    reasons.push(
      `Critical overdue volume: ${overdueCount} of ${activeCount} active tasks (${overduePercent}%) are overdue`
    );
  }

  // 2. WORKLOAD BALANCE & BOTTLENECK FACTOR (Weight: 25%)
  let workloadScore = 90;
  let topAssigneeName: string | null = null;
  let topAssigneeShare = 0;

  if (activeCount >= 3) {
    const countsByAssignee = new Map<string, { count: number; name: string }>();
    let unassignedCount = 0;

    for (const t of activeTasks) {
      if (!t.assigneeId) {
        unassignedCount++;
      } else {
        const existing = countsByAssignee.get(t.assigneeId);
        const name = t.assignee?.name || "Assignee";
        if (existing) {
          existing.count += 1;
        } else {
          countsByAssignee.set(t.assigneeId, { count: 1, name });
        }
      }
    }

    let topCount = 0;
    countsByAssignee.forEach((item) => {
      if (item.count > topCount) {
        topCount = item.count;
        topAssigneeName = item.name;
      }
    });

    topAssigneeShare = activeCount > 0 ? topCount / activeCount : 0;
    const topSharePercent = Math.round(topAssigneeShare * 100);

    if (topAssigneeShare > 0.65) {
      workloadScore = 30;
      reasons.push(
        `Workload bottleneck: ${topAssigneeName} holds ${topSharePercent}% of active tasks`
      );
    } else if (topAssigneeShare > 0.45) {
      workloadScore = 60;
      reasons.push(
        `Workload concentration: ${topAssigneeName} holds ${topSharePercent}% of active tasks`
      );
    } else {
      workloadScore = 95;
      const distinctMembers = countsByAssignee.size;
      if (distinctMembers > 1) {
        reasons.push(`Workload evenly distributed across ${distinctMembers} assignees`);
      }
    }

    if (unassignedCount / activeCount > 0.45) {
      workloadScore = Math.max(20, workloadScore - 20);
      reasons.push(
        `High unassigned workload: ${Math.round((unassignedCount / activeCount) * 100)}% of tasks lack assignees`
      );
    }
  }

  // 3. VELOCITY & MILESTONE MOMENTUM (Weight: 20%)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const recentCompleted = tasks.filter(
    (t) => t.status === "DONE" && t.updatedAt && new Date(t.updatedAt) >= fourteenDaysAgo
  ).length;

  let velocityScore = 80;
  if (recentCompleted >= 3) {
    velocityScore = 100;
    reasons.push(`High completion momentum (${recentCompleted} tasks finished in past 14 days)`);
  } else if (recentCompleted >= 1) {
    velocityScore = 85;
    reasons.push(`Steady task completion (${recentCompleted} task finished recently)`);
  } else if (activeCount > 4) {
    velocityScore = 35;
    reasons.push("Low completion velocity: 0 tasks completed in the last 14 days");
  } else {
    velocityScore = 65;
  }

  // Target deadline proximity check
  if (project.targetEndDate) {
    const targetDate = new Date(project.targetEndDate);
    const msUntilTarget = targetDate.getTime() - now.getTime();
    const daysUntilTarget = Math.ceil(msUntilTarget / (1000 * 60 * 60 * 24));
    const doneTasks = tasks.filter((t) => t.status === "DONE").length;
    const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    if (daysUntilTarget < 0 && activeCount > 0) {
      velocityScore = Math.max(10, velocityScore - 30);
      reasons.push(
        `Past milestone deadline: Project exceeded target date by ${Math.abs(daysUntilTarget)} days`
      );
    } else if (daysUntilTarget <= 7 && daysUntilTarget >= 0 && progressPercent < 50) {
      velocityScore = Math.max(15, velocityScore - 25);
      reasons.push(
        `Imminent deadline in ${daysUntilTarget} day${daysUntilTarget === 1 ? "" : "s"} with only ${progressPercent}% completed`
      );
    }
  }

  // 4. ACTIVITY RECENCY (Weight: 20%)
  let latestActivity = new Date(project.updatedAt || project.createdAt);
  if (project.lastActivityAt && new Date(project.lastActivityAt) > latestActivity) {
    latestActivity = new Date(project.lastActivityAt);
  }
  for (const t of tasks) {
    if (t.updatedAt && new Date(t.updatedAt) > latestActivity) {
      latestActivity = new Date(t.updatedAt);
    }
  }

  const daysSinceLastActivity = Math.max(
    0,
    Math.floor((now.getTime() - latestActivity.getTime()) / (1000 * 60 * 60 * 24))
  );

  let activityScore = 100;
  if (daysSinceLastActivity <= 2) {
    activityScore = 100;
  } else if (daysSinceLastActivity <= 7) {
    activityScore = 85;
  } else if (daysSinceLastActivity <= 14) {
    activityScore = 60;
    reasons.push(`Moderate inactivity (${daysSinceLastActivity} days since last update)`);
  } else {
    activityScore = 25;
    reasons.push(`Stale progress: No project activity for ${daysSinceLastActivity} days`);
  }

  // 5. STATUS & SEVERE OVERDUE PENALTIES
  let statusPenalty = 0;
  if (project.status === "ON_HOLD") {
    statusPenalty += 25;
    reasons.unshift("Project status is explicitly On Hold");
  }
  if (activeCount >= 2 && overdueRatio >= 0.5) {
    // Escalate penalty when majority of active tasks are overdue
    const overdueCrisisPenalty = Math.round(overdueRatio * 20);
    statusPenalty += overdueCrisisPenalty;
  }

  // COMPOSITE INDEX CALCULATION
  const weighted =
    overdueScore * 0.35 +
    workloadScore * 0.25 +
    velocityScore * 0.2 +
    activityScore * 0.2 -
    statusPenalty;

  const score = Math.max(0, Math.min(100, Math.round(weighted)));

  let status: ProjectHealthStatus = "ON_TRACK";
  let label: "On Track" | "Needs Attention" | "At Risk" = "On Track";
  let color = "#10B981";
  let badgeVariant: "status-done" | "status-todo" | "status-backlog" = "status-done";

  if (score < 50) {
    status = "AT_RISK";
    label = "At Risk";
    color = "#EF4444";
    badgeVariant = "status-backlog";
  } else if (score < 75) {
    status = "NEEDS_ATTENTION";
    label = "Needs Attention";
    color = "#F59E0B";
    badgeVariant = "status-todo";
  } else {
    status = "ON_TRACK";
    label = "On Track";
    color = "#10B981";
    badgeVariant = "status-done";
  }

  // Backward compatible isAtRisk flag:
  // Preserves existing tests (e.g. overdueCount / totalTasks > 0.25 triggers isAtRisk)
  const isAtRisk =
    status === "AT_RISK" ||
    score < 60 ||
    (totalTasks > 0 && overdueCount / totalTasks > 0.25) ||
    project.status === "ON_HOLD";

  return {
    score,
    status,
    label,
    color,
    badgeVariant,
    reasons: reasons.slice(0, 4), // Top 4 clear drivers
    breakdown: {
      overdueScore,
      workloadScore,
      velocityScore,
      activityScore,
      overdueCount,
      totalTasks,
      activeTasks: activeCount,
      overduePercent,
      topAssigneeName,
      topAssigneeShare,
      recentCompletedCount: recentCompleted,
      daysSinceLastActivity,
      statusPenalty,
    },
    isAtRisk,
  };
}
