// scripts/cleanup-orphaned-embeddings.ts
// Removes orphaned rows from task_embeddings where the task no longer exists
import "dotenv/config";
import { db } from "../src/lib/db.js";

async function main() {
  const result = await db.query(`
    DELETE FROM task_embeddings te
    WHERE NOT EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = te.task_id
    )
    RETURNING task_id;
  `);
  console.log(`Deleted ${result.rowCount} orphaned embeddings.`);
  await db.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
