import "dotenv/config";
import { db } from "../src/lib/db.js";
import { embed } from "../src/lib/ollama.js";
import { toPgVector } from "../src/services/embeddings.js";

async function main() {
  // Fetch all tasks with their tenant_id and title/description
  const tasks = await db.query(`
    SELECT t.id, t.tenant_id, t.title, t.description
    FROM tasks t
    WHERE t.title IS NOT NULL AND t.tenant_id IS NOT NULL
  `);

  if (!tasks.rows.length) {
    console.log("No tasks found to embed.");
    return;
  }

  let embedded = 0;
  for (const task of tasks.rows) {
    const text = [task.title, task.description].filter(Boolean).join(" ");
    if (!text.trim()) {
      console.log(`[SKIP] Task ${task.id} (tenant: ${task.tenant_id}) has no text.`);
      continue;
    }
    try {
      const vector = await embed(text);
      if (!Array.isArray(vector) || vector.length !== 768) {
        console.error(`[FAIL] Embedding for task ${task.id} returned invalid vector.`);
        continue;
      }
      await db.query(
        `INSERT INTO task_embeddings (task_id, tenant_id, embedding, updated_at)
         VALUES ($1, $2, $3::vector, NOW())
         ON CONFLICT (task_id) DO UPDATE
           SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
        [task.id, task.tenant_id, toPgVector(vector)]
      );
      console.log(`[OK] Embedded task ${task.id} (tenant: ${task.tenant_id})`);
      embedded++;
    } catch (err) {
      console.error(`[ERROR] Task ${task.id} (tenant: ${task.tenant_id}):`, err);
    }
  }
  console.log(`Embedded ${embedded} task(s).`);
  await db.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
