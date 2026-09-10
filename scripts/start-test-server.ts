import { spawn } from "child_process";
import fs from "fs";
import path from "path";

// 1. Load .env.test if present
const envTestPath = path.resolve(process.cwd(), ".env.test");
const envVars: Record<string, string> = {};
if (fs.existsSync(envTestPath)) {
  const lines = fs.readFileSync(envTestPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }
  }
}

// 2. Set strict test isolation variables
const testDbUrl =
  envVars["DATABASE_URL"] ||
  "postgresql://postgres:postgres@127.0.0.1:5432/syncora_test?schema=public";

const env = {
  ...process.env,
  ...envVars,
  DATABASE_URL: testDbUrl,
  DIRECT_URL: testDbUrl,
  PORT: "3001",
  NEXT_DIST_DIR: ".next-test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  // Next.js dev mode requires NODE_ENV=development; "test" causes issues
  NODE_ENV: "development",
  // Signal to app code that we're in e2e test mode
  E2E_TEST: "1",
};

console.log("[test-server] Starting isolated Next.js test server on port 3001...");
console.log(`[test-server] Connecting to test database: ${testDbUrl}`);
console.log("[test-server] Using isolated build directory: .next-test");

const isWindows = process.platform === "win32";
const nextCmd = isWindows ? "npx.cmd" : "npx";

const child = spawn(nextCmd, ["next", "dev", "-p", "3001"], {
  env: env as NodeJS.ProcessEnv,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code: number | null) => {
  process.exit(code || 0);
});

// Forward termination signals to child process
process.on("SIGINT", () => {
  child.kill("SIGINT");
});
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});
