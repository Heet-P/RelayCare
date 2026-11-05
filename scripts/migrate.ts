// Apply drizzle/ migrations using the direct (non-pooled) connection.
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env.local");

const sql = postgres(url, { max: 1 });
migrate(drizzle(sql), { migrationsFolder: "drizzle" })
  .then(() => console.log("migrations applied"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
