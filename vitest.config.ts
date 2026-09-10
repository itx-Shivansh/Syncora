import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/syncora_test?schema=public",
      DIRECT_URL: "postgresql://postgres:postgres@127.0.0.1:5432/syncora_test?schema=public",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
