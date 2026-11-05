import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations use the direct (non-pooled) connection; the app uses the pooler.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  strict: true,
});
