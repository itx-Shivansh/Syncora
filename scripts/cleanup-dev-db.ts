import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient({
    datasources: {
      db: { url: "postgresql://postgres:postgres@127.0.0.1:5432/syncora?schema=public" },
    },
  });

  try {
    const testUsers = await p.user.findMany({
      where: {
        OR: [
          { email: { startsWith: "e2e." } },
          { email: { contains: "e2e" } },
        ],
      },
      select: { id: true, email: true },
    });

    for (const u of testUsers) {
      // Find workspaces where user is owner
      const ownedMemberships = await p.workspaceMember.findMany({
        where: { userId: u.id, role: "OWNER" },
        select: { workspaceId: true },
      });
      const wsIds = ownedMemberships.map((m) => m.workspaceId);

      if (wsIds.length > 0) {
        // Delete tasks, labels, projects, and workspaces
        await p.task.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await p.project.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await p.label.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await p.workspaceMember.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await p.workspace.deleteMany({ where: { id: { in: wsIds } } });
      }

      // Delete any remaining projects owned by user
      await p.task.deleteMany({ where: { creatorId: u.id } });
      await p.project.deleteMany({ where: { ownerId: u.id } });
      await p.workspaceMember.deleteMany({ where: { userId: u.id } });
      await p.user.delete({ where: { id: u.id } });
      console.log(`Cleaned up test user: ${u.email}`);
    }

    const users = await p.user.findMany({ select: { email: true, name: true } });
    console.log("Remaining clean users in dev database (syncora):", users);
  } finally {
    await p.$disconnect();
  }
}

main().catch(console.error);
