import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * Integration tests: real HTTP against a running app (`pnpm dev`) plus the real database,
 * storage and seeded users. They create rows with unique markers and clean up after themselves.
 *   pnpm test:integration          (TEST_BASE_URL defaults to http://localhost:3000)
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
