import { db } from "./server/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log("🚀 Running performance optimization migration...");

  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, "migrations/0001_performance_indexes.sql"),
      "utf-8"
    );

    // Split by statement breakpoint and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => s && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await db.execute(sql.raw(statement));
      }
    }

    console.log("✅ Migration completed successfully!");
    console.log(`📊 Created ${statements.length} indexes for performance optimization`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
