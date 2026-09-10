import {
  PrismaClient,
  Prisma,
  WorkspaceRole,
  WorkspaceInvitationStatus,
  ProjectStatus,
  ProjectRole,
  ProjectVisibility,
  TaskStatus,
  TaskPriority,
  ActivityAction,
  NotificationType,
} from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();
const DEMO_EMAIL = "demo@syncora.app";
const DEMO_PASSWORD = "SyncoraDemo!2026";

type SeedTaskTemplate = {
  title: string;
  desc: string;
  priority: TaskPriority;
  status: TaskStatus;
  daysOffset: number | null;
  est: number;
};

async function resetDatabase() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.activityEvent.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.taskLabel.deleteMany(),
    prisma.task.deleteMany(),
    prisma.label.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.workspaceMember.deleteMany(),
    prisma.workspace.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  console.log("🌱 Starting Syncora database seed...");

  await resetDatabase();
  console.log("🧹 Reset demo database to a clean, idempotent state.");

  // 1. Create demo users and seeded operators
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: "usr_alex_chen",
        email: "alex.chen@acme.dev",
        name: "Alex Chen",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_sarah_jenkins",
        email: "sarah.jenkins@acme.dev",
        name: "Sarah Jenkins",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_marcus_vance",
        email: "marcus.vance@acme.dev",
        name: "Marcus Vance",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_elena_rostova",
        email: "elena.rostova@novalabs.io",
        name: "Elena Rostova",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_liam_torres",
        email: "liam.torres@novalabs.io",
        name: "Liam Torres",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_priya_patel",
        email: "priya.patel@syncora.demo",
        name: "Priya Patel",
        passwordHash: await hashPassword("password123"),
        avatarUrl:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_demo_syncora",
        email: DEMO_EMAIL,
        name: "Demo User",
        passwordHash: await hashPassword(DEMO_PASSWORD),
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&h=128&fit=crop",
      },
    }),
  ]);

  const [alex, sarah, marcus, elena, liam, priya, demoUser] = users;
  console.log(`👤 Created ${users.length} demo users.`);

  // 2. Create 2 Workspaces
  const acmeWs = await prisma.workspace.create({
    data: {
      id: "ws_acme_corp",
      name: "Acme Corporation",
      slug: "acme-corp",
      plan: "ENTERPRISE",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop",
    },
  });

  const novaWs = await prisma.workspace.create({
    data: {
      id: "ws_nova_labs",
      name: "Nova Labs",
      slug: "nova-labs",
      plan: "PRO",
      logoUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=128&h=128&fit=crop",
    },
  });

  // 3. Workspace Memberships
  // Acme memberships
  await prisma.workspaceMember.createMany({
    data: [
      {
        workspaceId: acmeWs.id,
        userId: alex.id,
        role: WorkspaceRole.OWNER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: acmeWs.id,
        userId: sarah.id,
        role: WorkspaceRole.ADMIN,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: acmeWs.id,
        userId: marcus.id,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: acmeWs.id,
        userId: elena.id,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: acmeWs.id,
        userId: priya.id,
        role: WorkspaceRole.VIEWER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: acmeWs.id,
        userId: demoUser.id,
        role: WorkspaceRole.OWNER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
    ],
  });

  // Nova memberships
  await prisma.workspaceMember.createMany({
    data: [
      {
        workspaceId: novaWs.id,
        userId: sarah.id,
        role: WorkspaceRole.OWNER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: novaWs.id,
        userId: elena.id,
        role: WorkspaceRole.ADMIN,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: novaWs.id,
        userId: liam.id,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: novaWs.id,
        userId: alex.id,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
      {
        workspaceId: novaWs.id,
        userId: priya.id,
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.ACTIVE,
      },
    ],
  });

  console.log("🏢 Created 2 workspaces with multi-tenant memberships.");

  // 4. Create Workspace Labels
  const acmeLabels = await Promise.all([
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Bug", color: "#EF4444" } }),
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Feature", color: "#3B82F6" } }),
    prisma.label.create({
      data: { workspaceId: acmeWs.id, name: "Performance", color: "#F59E0B" },
    }),
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Frontend", color: "#8B5CF6" } }),
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Backend", color: "#10B981" } }),
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Design", color: "#EC4899" } }),
    prisma.label.create({ data: { workspaceId: acmeWs.id, name: "Security", color: "#DC2626" } }),
  ]);

  const novaLabels = await Promise.all([
    prisma.label.create({ data: { workspaceId: novaWs.id, name: "AI/ML", color: "#8B5CF6" } }),
    prisma.label.create({ data: { workspaceId: novaWs.id, name: "Infra", color: "#10B981" } }),
    prisma.label.create({ data: { workspaceId: novaWs.id, name: "Urgent Fix", color: "#EF4444" } }),
    prisma.label.create({ data: { workspaceId: novaWs.id, name: "API", color: "#3B82F6" } }),
    prisma.label.create({ data: { workspaceId: novaWs.id, name: "Refactor", color: "#F59E0B" } }),
  ]);

  // 5. Create Projects (4 for Acme, 3 for Nova)
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  const acmeProjects = [
    await prisma.project.create({
      data: {
        id: "prj_core_platform",
        workspaceId: acmeWs.id,
        ownerId: alex.id,
        name: "Core Platform 2.0",
        key: "CORE",
        description:
          "Re-architecting monolithic backend into high-throughput microservices and edge cache.",
        status: ProjectStatus.ACTIVE,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#3B82F6",
        targetStartDate: daysAgo(30),
        targetEndDate: daysAhead(45),
      },
    }),
    await prisma.project.create({
      data: {
        id: "prj_mobile_app",
        workspaceId: acmeWs.id,
        ownerId: sarah.id,
        name: "Mobile App Redesign",
        key: "MOB",
        description: "Next-gen iOS & Android apps with offline-first local synchronization.",
        status: ProjectStatus.ACTIVE,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#8B5CF6",
        targetStartDate: daysAgo(15),
        targetEndDate: daysAhead(60),
      },
    }),
    await prisma.project.create({
      data: {
        id: "prj_billing_v2",
        workspaceId: acmeWs.id,
        ownerId: marcus.id,
        name: "Billing & Invoicing V2",
        key: "BILL",
        description:
          "Usage-based tier pricing, Stripe integration, and automatic dunning management.",
        status: ProjectStatus.ON_HOLD,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#F59E0B",
        targetStartDate: daysAgo(40),
        targetEndDate: daysAhead(20),
      },
    }),
    await prisma.project.create({
      data: {
        id: "prj_legacy_migration",
        workspaceId: acmeWs.id,
        ownerId: alex.id,
        name: "Legacy Data Migration",
        key: "MIG",
        description: "Archival of Postgres 11 historical tables into cold storage parquet lake.",
        status: ProjectStatus.COMPLETED,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#10B981",
        targetStartDate: daysAgo(90),
        targetEndDate: daysAgo(10),
      },
    }),
  ];

  const demoRecoveryProject = await prisma.project.create({
    data: {
      id: "prj_launch_recovery",
      workspaceId: acmeWs.id,
      ownerId: demoUser.id,
      name: "Launch Recovery Sprint",
      key: "LRS",
      description:
        "Stabilize the customer launch by resolving overdue release-blocking incidents, workflow bottlenecks, and stale migration tasks.",
      status: ProjectStatus.ACTIVE,
      visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
      color: "#F97316",
      targetStartDate: daysAgo(21),
      targetEndDate: daysAgo(3),
    },
  });

  acmeProjects.push(demoRecoveryProject);

  const novaProjects = [
    await prisma.project.create({
      data: {
        id: "prj_neural_search",
        workspaceId: novaWs.id,
        ownerId: sarah.id,
        name: "Neural Search Engine",
        key: "SRCH",
        description: "Vector embedding search pipeline with hybrid reciprocal rank fusion.",
        status: ProjectStatus.ACTIVE,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#EC4899",
        targetStartDate: daysAgo(20),
        targetEndDate: daysAhead(30),
      },
    }),
    await prisma.project.create({
      data: {
        id: "prj_workflow_auto",
        workspaceId: novaWs.id,
        ownerId: elena.id,
        name: "Autonomous Workflow Engine",
        key: "AUTO",
        description: "DAG-based trigger orchestration engine for enterprise webhook automation.",
        status: ProjectStatus.PLANNING,
        visibility: ProjectVisibility.PUBLIC_TO_WORKSPACE,
        color: "#6366F1",
        targetStartDate: daysAhead(5),
        targetEndDate: daysAhead(90),
      },
    }),
    await prisma.project.create({
      data: {
        id: "prj_soc2_audit",
        workspaceId: novaWs.id,
        ownerId: elena.id,
        name: "SOC2 Compliance Audit",
        key: "SEC",
        description: "Type II compliance readiness review, pen testing, and vendor risk matrix.",
        status: ProjectStatus.ARCHIVED,
        visibility: ProjectVisibility.PRIVATE,
        color: "#6B7280",
        targetStartDate: daysAgo(120),
        targetEndDate: daysAgo(40),
      },
    }),
  ];

  console.log("📁 Created 7 projects across both workspaces.");

  // 6. Project Members
  for (const project of acmeProjects) {
    if (project.id === demoRecoveryProject.id) continue;

    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: alex.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: sarah.id, role: ProjectRole.MEMBER },
        { projectId: project.id, userId: marcus.id, role: ProjectRole.MEMBER },
      ],
    });
  }

  await prisma.projectMember.createMany({
    data: [
      { projectId: demoRecoveryProject.id, userId: demoUser.id, role: ProjectRole.LEAD },
      { projectId: demoRecoveryProject.id, userId: alex.id, role: ProjectRole.MEMBER },
      { projectId: demoRecoveryProject.id, userId: sarah.id, role: ProjectRole.MEMBER },
    ],
  });

  // Nova project members:
  // Public projects (SRCH, AUTO) — Liam is a MEMBER, giving him access.
  const novaPublicProjects = [novaProjects[0], novaProjects[1]];
  for (const project of novaPublicProjects) {
    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: sarah.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: elena.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: liam.id, role: ProjectRole.MEMBER },
      ],
    });
  }

  // PRIVATE project (prj_soc2_audit, index 2) — Liam is intentionally NOT a member.
  // Only elena (owner/lead) and sarah have access. This enforces the security
  // boundary tested in search.test.ts and verified by the Bug 2 repro scenario.
  const novaPrivateProject = novaProjects[2];
  await prisma.projectMember.createMany({
    data: [
      { projectId: novaPrivateProject.id, userId: sarah.id, role: ProjectRole.LEAD },
      { projectId: novaPrivateProject.id, userId: elena.id, role: ProjectRole.LEAD },
      // Liam Torres is deliberately EXCLUDED — he is a workspace MEMBER but not
      // a member of this PRIVATE project. Any search by Liam must return zero
      // results from prj_soc2_audit.
    ],
  });


  // 7. Seed Tasks: 15 to 22 tasks per project (Total ~125 realistic tasks)
  const taskTemplates: SeedTaskTemplate[] = [
    {
      title: "Fix memory leak in websocket multiplexer",
      desc: "Heap snapshot shows connection map retaining disconnect references.",
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      daysOffset: -2,
      est: 6,
    },
    {
      title: "Stripe webhook retry queue failing with 504 gateway timeout",
      desc: "Endpoint took >30s on heavy subscription batch renewals.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      daysOffset: -5,
      est: 4,
    },
    {
      title: "Design high-density data grid with virtualized rows",
      desc: "Support 10k rows with sub-16ms scrolling performance.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      daysOffset: 3,
      est: 12,
    },
    {
      title: "Migrate auth session validation from middleware to server action cache",
      desc: "Reduce cold-start roundtrips by leveraging edge JWT verification.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.DONE,
      daysOffset: -12,
      est: 8,
    },
    {
      title: "Optimize Postgres connection pool for bursty serverless invocations",
      desc: "Introduce PgBouncer pooled connection strings in Prisma client config.",
      priority: TaskPriority.URGENT,
      status: TaskStatus.DONE,
      daysOffset: -8,
      est: 5,
    },
    {
      title: "Audit GDPR telemetry retention periods",
      desc: "Automate purge job for activity logs older than 90 days.",
      priority: TaskPriority.LOW,
      status: TaskStatus.BACKLOG,
      daysOffset: null,
      est: 16,
    },
    {
      title: "Implement optimistic task status toggle on Kanban drag",
      desc: "Eliminate UI lag before server action response resolves.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      daysOffset: 2,
      est: 6,
    },
    {
      title: "Investigate flaky Cypress tests on Safari WebKit runner",
      desc: "Date parsing in safari returns NaN for non-standard ISO formats.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.TODO,
      daysOffset: 1,
      est: 3,
    },
    {
      title: "Add Prometheus metrics export endpoint for task queue",
      desc: "Track queue depth, worker latency, and error rates.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.BACKLOG,
      daysOffset: null,
      est: 7,
    },
    {
      title: "Draft PRD for multi-tenant SAML SSO integration",
      desc: "Cover Okta, Azure AD, and Google Workspace identity providers.",
      priority: TaskPriority.HIGH,
      status: TaskStatus.DONE,
      daysOffset: -20,
      est: 10,
    },
    {
      title: "Update ESLint rule to disallow explicit any in route handlers",
      desc: "Enforce strict Zod parser inference on request payloads.",
      priority: TaskPriority.LOW,
      status: TaskStatus.DONE,
      daysOffset: -15,
      est: 2,
    },
    {
      title: "Implement bulk task deletion with confirmation modal",
      desc: "Ensure cascade constraints properly remove comments and audit events.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      daysOffset: 4,
      est: 5,
    },
    {
      title: "Fix avatar image rendering fallback on 404 image load",
      desc: "Display user initials inside deterministic colored avatar circle.",
      priority: TaskPriority.LOW,
      status: TaskStatus.TODO,
      daysOffset: 6,
      est: 2,
    },
    {
      title: "Index workspaceId foreign keys across all child tables",
      desc: "Benchmark EXPLAIN ANALYZE on multi-tenant query filters.",
      priority: TaskPriority.URGENT,
      status: TaskStatus.DONE,
      daysOffset: -30,
      est: 4,
    },
    {
      title: "Rate limit public invitation accept endpoint",
      desc: "Prevent brute-force token enumeration attacks (10 req/min/IP). priority: TaskPriority.HIGH",
      priority: TaskPriority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      daysOffset: -1,
      est: 4,
    },
    {
      title: "Add keyboard shortcut (Cmd+K) command palette trigger",
      desc: "Global search modal with quick navigation between projects and tasks.",
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.BACKLOG,
      daysOffset: null,
      est: 9,
    },
    {
      title: "Refactor task state machine transitions",
      desc: "Disallow moving directly from BACKLOG to DONE without passing review.",
      priority: TaskPriority.LOW,
      status: TaskStatus.CANCELLED,
      daysOffset: -4,
      est: 3,
    },
    {
      title: "Implement project health score calculation engine",
      desc: "Calculate weighted index based on overdue tasks and velocity momentum.",
      priority: TaskPriority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      daysOffset: 5,
      est: 14,
    },
  ];

  const allProjects = [...acmeProjects, ...novaProjects];
  let totalTasksCreated = 0;
  const createdTasks: {
    id: string;
    workspaceId: string;
    projectId: string;
    taskKey: string;
    title: string;
    status: TaskStatus;
    creatorId: string;
    assigneeId: string | null;
  }[] = [];

  for (const project of allProjects) {
    const isAcme = project.workspaceId === acmeWs.id;
    const projectUsers = isAcme ? [alex, sarah, marcus, elena] : [sarah, elena, liam, alex];
    const projectLabels = isAcme ? acmeLabels : novaLabels;
    const isDemoRecoveryProject = project.id === demoRecoveryProject.id;

    const count = isDemoRecoveryProject ? 8 : 15 + Math.floor(Math.random() * 4);

    for (let i = 1; i <= count; i++) {
      let template = taskTemplates[(i + project.name.length) % taskTemplates.length];
      let assignee = i % 5 === 0 ? null : projectUsers[i % projectUsers.length];
      let creator = projectUsers[(i + 1) % projectUsers.length];
      let dueDate = template.daysOffset !== null ? daysAhead(template.daysOffset) : null;
      let status = template.status;
      let priority = template.priority;
      let title = `${template.title} [${project.key}]`;
      let description = `${template.desc}\n\n*Created during sprint planning for ${project.name}.*`;

      if (isDemoRecoveryProject) {
        const demoTemplates: SeedTaskTemplate[] = [
          {
            title: "Patch auth replay regression in sign-in gateway",
            desc: "Customers are seeing duplicate session invalidations during refresh storms.",
            priority: TaskPriority.URGENT,
            status: TaskStatus.IN_PROGRESS,
            daysOffset: 2,
            est: 8,
          },
          {
            title: "Stabilize queue draining for invoice batch jobs",
            desc: "Delayed settlement jobs are backing up and leaving partial payment state behind.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.IN_PROGRESS,
            daysOffset: 4,
            est: 7,
          },
          {
            title: "Rebuild release health check before go-live",
            desc: "The smoke suite is missing the launch readiness gate for region failover checks.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.TODO,
            daysOffset: 6,
            est: 5,
          },
          {
            title: "Unblock analytics ingestion lag in campaign tracking",
            desc: "New campaign events are failing to hydrate because of stale cache invalidations.",
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.TODO,
            daysOffset: 3,
            est: 6,
          },
          {
            title: "Review vendor SSO token expiry boundary",
            desc: "Add guard rails to detect expired refresh tokens before account lockouts occur.",
            priority: TaskPriority.HIGH,
            status: TaskStatus.IN_REVIEW,
            daysOffset: 7,
            est: 4,
          },
          {
            title: "Sweep stale migration tasks from launch backlog",
            desc: "Archive orphaned proof scripts that no longer match the newly deployed release path.",
            priority: TaskPriority.LOW,
            status: TaskStatus.BACKLOG,
            daysOffset: null,
            est: 3,
          },
          {
            title: "Verify storefront fallback for degraded CDN",
            desc: "Confirm cached shell and API fallbacks remain healthy during edge outages.",
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.BACKLOG,
            daysOffset: null,
            est: 5,
          },
          {
            title: "Confirm launch communication timeline for support ops",
            desc: "Prepare a support and escalation checklist for customer-facing incidents.",
            priority: TaskPriority.LOW,
            status: TaskStatus.DONE,
            daysOffset: 12,
            est: 2,
          },
        ];

        template = demoTemplates[i - 1];
        assignee = i <= 5 ? demoUser : i % 2 === 0 ? sarah : marcus;
        creator = sarah;
        dueDate = template.daysOffset !== null ? daysAgo(template.daysOffset) : null;
        status = template.status;
        priority = template.priority;
        title = `${template.title}`;
        description = `${template.desc}\n\n*Critical launch recovery work led by ${demoUser.name}.*`;
      }

      const task = await prisma.task.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          creatorId: creator.id,
          assigneeId: assignee ? assignee.id : null,
          taskNumber: i,
          taskKey: `${project.key}-${i}`,
          title,
          description,
          status,
          priority,
          orderIndex: i * 1000,
          startDate: daysAgo(10),
          dueDate,
          estimatedHours: template.est,
          actualHours: status === TaskStatus.DONE ? template.est * 0.9 : null,
        },
      });

      createdTasks.push({
        id: task.id,
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskKey: task.taskKey,
        title: task.title,
        status: task.status,
        creatorId: task.creatorId,
        assigneeId: task.assigneeId,
      });
      totalTasksCreated++;

      const labelChoices = isDemoRecoveryProject
        ? [acmeLabels[0], acmeLabels[2], acmeLabels[6], acmeLabels[4]]
        : projectLabels;
      const label1 = labelChoices[(i - 1) % labelChoices.length];
      await prisma.taskLabel.create({
        data: {
          taskId: task.id,
          labelId: label1.id,
        },
      });

      if (i % 2 === 0) {
        const label2 = labelChoices[(i + 2) % labelChoices.length];
        if (label2.id !== label1.id) {
          await prisma.taskLabel.create({
            data: {
              taskId: task.id,
              labelId: label2.id,
            },
          });
        }
      }
    }
  }

  console.log(`📋 Created ${totalTasksCreated} realistic tasks with labels and varied due dates.`);

  // 8. Create Comments & Threaded Discussions on select tasks across all projects
  for (const project of allProjects) {
    const projectTasks = createdTasks.filter((t) => t.projectId === project.id);
    const commentCandidates = projectTasks.slice(0, 3);
    for (const t of commentCandidates) {
      const rootComment = await prisma.comment.create({
        data: {
          workspaceId: t.workspaceId,
          taskId: t.id,
          authorId: alex.id,
          content: `Initial review completed for ${project.name}. Validated implementation against staging environment.`,
        },
      });

      await prisma.comment.create({
        data: {
          workspaceId: t.workspaceId,
          taskId: t.id,
          authorId: sarah.id,
          parentId: rootComment.id,
          content: `Agreed @Alex Chen. Verified parity checks and test runbook is up to date.`,
        },
      });
    }
  }

  const launchRecoveryTasks = createdTasks.filter((t) => t.projectId === demoRecoveryProject.id).slice(0, 3);
  for (const task of launchRecoveryTasks) {
    const rootComment = await prisma.comment.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        authorId: demoUser.id,
        content: `I’ve narrowed the launch issue to a stale JWT refresh handoff and a queue drain backlog. Need sign-off from support before 4pm.`,
      },
    });

    await prisma.comment.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        authorId: sarah.id,
        parentId: rootComment.id,
        content: `Looks good — I’ve aligned the fallback runbook and updated the launch checklist. We’re on track to ship the hotfix by 5pm.`,
      },
    });
  }

  console.log("💬 Seeded threaded task comments across all projects.");

  // 9. Create Activity Events (Audit Ledger) across all projects
  for (const project of allProjects) {
    const projectTasks = createdTasks.filter((t) => t.projectId === project.id);

    // Project creation event
    await prisma.activityEvent.create({
      data: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        actorId: alex.id,
        action: ActivityAction.PROJECT_CREATED,
        metadata: { name: project.name, key: project.key },
        createdAt: daysAgo(12),
      },
    });

    for (let idx = 0; idx < projectTasks.length; idx++) {
      const t = projectTasks[idx];
      const events: Prisma.ActivityEventCreateManyInput[] = [
        {
          workspaceId: t.workspaceId,
          projectId: t.projectId,
          taskId: t.id,
          actorId: t.creatorId,
          action: ActivityAction.TASK_CREATED,
          metadata: { title: t.title, taskKey: t.taskKey },
          createdAt: daysAgo(6 + (idx % 4)),
        },
      ];

      if (t.status !== TaskStatus.TODO && t.status !== TaskStatus.BACKLOG) {
        events.push({
          workspaceId: t.workspaceId,
          projectId: t.projectId,
          taskId: t.id,
          actorId: t.assigneeId || sarah.id,
          action: ActivityAction.STATUS_CHANGED,
          metadata: {
            previousStatus: TaskStatus.TODO,
            newStatus: t.status,
            from: TaskStatus.TODO,
            to: t.status,
            taskKey: t.taskKey,
          },
          createdAt: daysAgo(1 + (idx % 3)),
        });
      }

      await prisma.activityEvent.createMany({
        data: events,
      });
    }
  }

  console.log("📜 Seeded audit log activity events across all projects.");

  // 10. Create Notifications
  const demoLaunchTasks = createdTasks.filter((t) => t.projectId === demoRecoveryProject.id);

  await prisma.notification.createMany({
    data: [
      {
        workspaceId: acmeWs.id,
        recipientId: alex.id,
        actorId: sarah.id,
        type: NotificationType.COMMENT_REPLY,
        resourceType: "TASK",
        resourceId: createdTasks[0]?.id ?? "task_1",
        title: "Sarah replied to your comment",
        message: "I will review the migration scripts and ensure our rollback runbook is updated.",
        isRead: false,
      },
      {
        workspaceId: acmeWs.id,
        recipientId: marcus.id,
        actorId: alex.id,
        type: NotificationType.TASK_ASSIGNED,
        resourceType: "TASK",
        resourceId: createdTasks[1]?.id ?? "task_2",
        title: "You were assigned a task",
        message: "Stripe webhook retry queue failing with 504 gateway timeout",
        isRead: true,
        readAt: daysAgo(1),
      },
      {
        workspaceId: novaWs.id,
        recipientId: elena.id,
        actorId: sarah.id,
        type: NotificationType.TASK_STATUS_CHANGED,
        resourceType: "TASK",
        resourceId: createdTasks[4]?.id ?? "task_5",
        title: "Task status moved to In Review",
        message: "Neural Search Engine vector indexing completed initial run.",
        isRead: false,
      },
      {
        workspaceId: acmeWs.id,
        recipientId: demoUser.id,
        actorId: sarah.id,
        type: NotificationType.SYSTEM,
        resourceType: "PROJECT",
        resourceId: demoRecoveryProject.id,
        title: "Launch Recovery Sprint is at risk",
        message: "Four launch-critical tasks are overdue and the workload is concentrated on one owner.",
        isRead: false,
      },
      {
        workspaceId: acmeWs.id,
        recipientId: demoUser.id,
        actorId: demoUser.id,
        type: NotificationType.TASK_ASSIGNED,
        resourceType: "TASK",
        resourceId: demoLaunchTasks[0]?.id ?? "demo_task_1",
        title: "You were assigned a launch recovery task",
        message: "Patch auth replay regression in sign-in gateway",
        isRead: false,
      },
      {
        workspaceId: acmeWs.id,
        recipientId: demoUser.id,
        actorId: alex.id,
        type: NotificationType.COMMENT_REPLY,
        resourceType: "TASK",
        resourceId: demoLaunchTasks[1]?.id ?? "demo_task_2",
        title: "Alex left feedback on the launch plan",
        message: "The support checklist needs a customer-impact update before sign-off.",
        isRead: true,
        readAt: daysAgo(1),
      },
    ],
  });

  console.log("🔔 Seeded notifications.");
  console.log("✅ Syncora database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
