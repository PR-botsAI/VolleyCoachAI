import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "../shared/src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://volleycoach:volleycoach_dev@localhost:5432/volleycoach",
  },
  verbose: true,
  strict: true,
});
