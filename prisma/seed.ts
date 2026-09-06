import {
  PrismaClient,
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

const prisma = new PrismaClient();

// Deterministic mock password hash (representing "password123")
const DEMO_PASSWORD_HASH = "$2a$10$wT/X8jN51w3m1p3n4t2vcuV8r9Z8K4B.z/n3eK3vj7hB0Q8.Wp0mK";

async function main() {
  console.log("🌱 Starting Syncora database seed...");

  // Clean existing records in reverse dependency order
  await prisma.notification.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.taskLabel.deleteMany();
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Cleaned existing tables.");

  // 1. Create Demo Users (6 users)
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: "usr_alex_chen",
        email: "alex.chen@acme.dev",
        name: "Alex Chen",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_sarah_jenkins",
        email: "sarah.jenkins@acme.dev",
        name: "Sarah Jenkins",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_marcus_vance",
        email: "marcus.vance@acme.dev",
        name: "Marcus Vance",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_elena_rostova",
        email: "elena.rostova@novalabs.io",
        name: "Elena Rostova",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_liam_torres",
        email: "liam.torres@novalabs.io",
        name: "Liam Torres",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128&h=128&fit=crop",
      },
    }),
    prisma.user.create({
      data: {
        id: "usr_priya_patel",
        email: "priya.patel@syncora.demo",
        name: "Priya Patel",
        passwordHash: DEMO_PASSWORD_HASH,
        avatarUrl:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=128&h=128&fit=crop",
      },
    }),
  ]);

  const [alex, sarah, marcus, elena, liam, priya] = users;
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
    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: alex.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: sarah.id, role: ProjectRole.MEMBER },
        { projectId: project.id, userId: marcus.id, role: ProjectRole.MEMBER },
      ],
    });
  }

  for (const project of novaProjects) {
    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: sarah.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: elena.id, role: ProjectRole.LEAD },
        { projectId: project.id, userId: liam.id, role: ProjectRole.MEMBER },
      ],
    });
  }

  // 7. Seed Tasks: 15 to 22 tasks per project (Total ~125 realistic tasks)
  const taskTemplates = [
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
  const createdTasks: { id: string; workspaceId: string; projectId: string; title: string }[] = [];

  for (const project of allProjects) {
    const isAcme = project.workspaceId === acmeWs.id;
    const projectUsers = isAcme ? [alex, sarah, marcus, elena] : [sarah, elena, liam, alex];
    const projectLabels = isAcme ? acmeLabels : novaLabels;

    // Pick 15 to 18 task templates per project
    const count = 15 + Math.floor(Math.random() * 4);

    for (let i = 1; i <= count; i++) {
      const template = taskTemplates[(i + project.name.length) % taskTemplates.length];
      const assignee = i % 5 === 0 ? null : projectUsers[i % projectUsers.length];
      const creator = projectUsers[(i + 1) % projectUsers.length];
      const dueDate = template.daysOffset !== null ? daysAhead(template.daysOffset) : null;

      const task = await prisma.task.create({
        data: {
          workspaceId: project.workspaceId,
          projectId: project.id,
          creatorId: creator.id,
          assigneeId: assignee ? assignee.id : null,
          taskNumber: i,
          taskKey: `${project.key}-${i}`,
          title: `${template.title} [${project.key}]`,
          description: `${template.desc}\n\n*Created during sprint planning for ${project.name}.*`,
          status: template.status,
          priority: template.priority,
          orderIndex: i * 1000,
          startDate: daysAgo(10),
          dueDate: dueDate,
          estimatedHours: template.est,
          actualHours: template.status === TaskStatus.DONE ? template.est * 0.9 : null,
        },
      });

      createdTasks.push(task);
      totalTasksCreated++;

      // Attach 1-2 random labels
      const label1 = projectLabels[i % projectLabels.length];
      await prisma.taskLabel.create({
        data: {
          taskId: task.id,
          labelId: label1.id,
        },
      });

      if (i % 2 === 0) {
        const label2 = projectLabels[(i + 2) % projectLabels.length];
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

  // 8. Create Comments & Threaded Discussions on select tasks
  const sampleTasks = createdTasks.slice(0, 8);
  for (const t of sampleTasks) {
    const rootComment = await prisma.comment.create({
      data: {
        workspaceId: t.workspaceId,
        taskId: t.id,
        authorId: alex.id,
        content: `I've replicated this behavior on the staging environment. Let's make sure we test backwards compatibility before merging.`,
      },
    });

    await prisma.comment.create({
      data: {
        workspaceId: t.workspaceId,
        taskId: t.id,
        authorId: sarah.id,
        parentId: rootComment.id,
        content: `Agreed @Alex Chen. I will review the migration scripts and ensure our rollback runbook is updated.`,
      },
    });
  }

  console.log("💬 Seeded threaded task comments.");

  // 9. Create Activity Events (Audit Ledger)
  for (const t of sampleTasks) {
    await prisma.activityEvent.createMany({
      data: [
        {
          workspaceId: t.workspaceId,
          projectId: t.projectId,
          taskId: t.id,
          actorId: alex.id,
          action: ActivityAction.TASK_CREATED,
          metadata: { title: t.title },
          createdAt: daysAgo(5),
        },
        {
          workspaceId: t.workspaceId,
          projectId: t.projectId,
          taskId: t.id,
          actorId: sarah.id,
          action: ActivityAction.STATUS_CHANGED,
          metadata: { from: TaskStatus.TODO, to: TaskStatus.IN_PROGRESS },
          createdAt: daysAgo(2),
        },
      ],
    });
  }

  console.log("📜 Seeded audit log activity events.");

  // 10. Create Notifications
  await prisma.notification.createMany({
    data: [
      {
        workspaceId: acmeWs.id,
        recipientId: alex.id,
        actorId: sarah.id,
        type: NotificationType.COMMENT_REPLY,
        resourceType: "TASK",
        resourceId: sampleTasks[0]?.id ?? "task_1",
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
        resourceId: sampleTasks[1]?.id ?? "task_2",
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
        resourceId: sampleTasks[4]?.id ?? "task_5",
        title: "Task status moved to In Review",
        message: "Neural Search Engine vector indexing completed initial run.",
        isRead: false,
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
