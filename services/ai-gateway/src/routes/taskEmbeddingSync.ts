import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/db.js';
import { createEmbedding, toPgVector } from '../services/embeddings.js';

const syncSchema = z.object({
  taskId: z.string().min(1),
});

export const taskEmbeddingSyncHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', details: parsed.error.flatten() });
    return;
  }

  const headerTenantIdRaw = req.header('X-Tenant-ID');
  const headerTenantId = typeof headerTenantIdRaw === 'string' ? headerTenantIdRaw.trim() : '';
  const tenantId = req.tenantId ?? (headerTenantId || undefined);
  if (!tenantId) {
    res.status(401).json({ error: 'missing_tenant_context' });
    return;
  }

  const { taskId } = parsed.data;

  try {
    const taskResult = await db.query<{
      id: string;
      tenant_id: string;
      title: string | null;
      description: string | null;
      is_archived: boolean;
    }>(
      `
      SELECT id, tenant_id, title, description, is_archived
      FROM tasks
      WHERE id = $1 AND tenant_id::text = $2::text
      LIMIT 1
      `,
      [taskId, tenantId],
    );

    if (taskResult.rows.length === 0) {
      res.status(404).json({ error: 'task_not_found' });
      return;
    }

    const task = taskResult.rows[0];
    if (task.is_archived) {
      await db.query(
        `DELETE FROM task_embeddings WHERE task_id = $1 AND tenant_id::text = $2::text`,
        [task.id, tenantId],
      );
      res.status(200).json({ ok: true, action: 'deleted_archived' });
      return;
    }

    const source = [task.title ?? '', task.description ?? ''].join(' ').trim();
    if (!source) {
      await db.query(
        `DELETE FROM task_embeddings WHERE task_id = $1 AND tenant_id::text = $2::text`,
        [task.id, tenantId],
      );
      res.status(200).json({ ok: true, action: 'deleted_empty' });
      return;
    }

    const embedding = await createEmbedding(source);
    await db.query(
      `
      INSERT INTO task_embeddings (task_id, tenant_id, embedding, updated_at)
      VALUES ($1, $2, $3::vector, NOW())
      ON CONFLICT (task_id)
      DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
      `,
      [task.id, tenantId, toPgVector(embedding)],
    );

    res.status(200).json({ ok: true, action: 'upserted', taskId: task.id });
  } catch (error) {
    console.error('[taskEmbeddingSync] Failed to sync embedding:', error);
    res.status(503).json({ error: 'embedding_sync_failed' });
  }
};
