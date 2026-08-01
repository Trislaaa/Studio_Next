// Prisma configuration for Supabase
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first, then fall back to .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Use direct connection for migrations (avoids PgBouncer prepared statement issues)
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
