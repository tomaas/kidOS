import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local SQLite file. Load whichever env file is present — including
// .env.production, so drizzle-kit on the deploy machine targets the real db
// instead of silently creating a fresh file in the checkout.
config({ path: ".env.local" });
config({ path: ".env" });
config({ path: ".env.production" });

export default defineConfig({
  dbCredentials: {
    // Same default derivation as src/env.ts — keep the two in sync.
    url:
      process.env.DATABASE_URL ??
      `file:${process.env.DATA_DIR ?? "./data"}/app.db`,
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
});
