import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

async function main() {
  const adminDbUrl = process.env.DIRECT_URL || "postgresql://postgres:postgres@127.0.0.1:5432/syncora?schema=public";
  const p = new PrismaClient({
    datasources: { db: { url: adminDbUrl } },
  });

  try {
    const dbs = await p.$queryRawUnsafe<{ datname: string }[]>(
      "SELECT datname FROM pg_database WHERE datname = 'syncora_test';"
    );

    if (dbs.length === 0) {
      console.log("Creating syncora_test database...");
      await p.$executeRawUnsafe("CREATE DATABASE syncora_test;");
      console.log("Database syncora_test created.");
    } else {
      console.log("Database syncora_test already exists.");
    }
  } finally {
    await p.$disconnect();
  }

  const testDbUrl = "postgresql://postgres:postgres@127.0.0.1:5432/syncora_test?schema=public";
  console.log("Deploying migrations to syncora_test...");
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
    },
    stdio: "inherit",
  });

  console.log("Seeding syncora_test...");
  execSync("npx tsx prisma/seed.ts", {
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      DIRECT_URL: testDbUrl,
    },
    stdio: "inherit",
  });

  console.log("✅ Test database syncora_test is ready and seeded!");
}

main().catch((err) => {
  console.error("Failed to setup test database:", err);
  process.exit(1);
});
