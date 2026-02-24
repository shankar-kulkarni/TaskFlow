import type { Request, Response } from 'express';
import { db } from '../services/db.js';
import { getTenantTimezone, isDateOverdueInTimeZone } from '../services/tenantTimezone.js';

export const weeklyDigestHandler = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const userId = req.userId;
  const userRole = req.userRole;
  const projectIdRaw = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : '';
  const projectId = projectIdRaw.length > 0 ? projectIdRaw : null;

  if (!tenantId || !userId) {
    res.status(401).json({ error: 'Missing request context' });
    return;
  }

  try {
    const tenantTimezone = await getTenantTimezone(tenantId);
    const roleResult = await db.query<{ role: string }>(
      `
      SELECT role::text AS role
      FROM users
      WHERE id::text = $1::text
        AND tenant_id::text = $2::text
      LIMIT 1
      `,
      [userId, tenantId],
    );
    const effectiveRole = roleResult.rows[0]?.role ?? userRole ?? 'MEMBER';
    const effectiveHasAnyScope = effectiveRole === 'ADMIN' || effectiveRole === 'OWNER';
    const rows = await db.query<{
      status: string;
      due_date: string | null;
      title: string;
    }>(
      `
      SELECT status::text, due_date, title
      FROM tasks
      WHERE tenant_id::text = $1::text
        AND is_archived = false
        AND ($2::text IS NULL OR project_id::text = $2::text)
        AND (
          $3::boolean = true
          OR EXISTS (
            SELECT 1
            FROM task_user_assignments tua
            WHERE tua.task_id = tasks.id
              AND tua.user_id::text = $4::text
          )
          OR EXISTS (
            SELECT 1
            FROM task_group_assignments tga
            JOIN group_members gm ON gm.group_id = tga.group_id
            WHERE tga.task_id = tasks.id
              AND gm.user_id::text = $4::text
          )
        )
      ORDER BY updated_at DESC
      LIMIT 1000
      `,
      [tenantId, projectId, effectiveHasAnyScope, userId],
    );

    const tasks = rows.rows;
    const total = tasks.length;
    const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((task) => task.status === 'DONE').length;
    const blocked = tasks.filter((task) => task.status === 'BLOCKED').length;
    const overdue = tasks.filter((task) => isDateOverdueInTimeZone(task.due_date, tenantTimezone) && task.status !== 'DONE').length;

    const wins = tasks
      .filter((task) => task.status === 'DONE')
      .slice(0, 3)
      .map((task) => task.title);

    const watchList = tasks
      .filter((task) => task.status === 'BLOCKED' || isDateOverdueInTimeZone(task.due_date, tenantTimezone))
      .slice(0, 3)
      .map((task) => task.title);

    const focus = tasks
      .filter((task) => task.status !== 'DONE')
      .slice(0, 3)
      .map((task) => task.title);

    const summary = `Current scope: ${total} total task(s), ${inProgress} in progress, ${blocked} blocked, and ${overdue} overdue.`;

    res.status(200).json({
      data: {
        summary,
        wins,
        watchList,
        focus,
        totals: {
          total,
          inProgress,
          blocked,
          overdue,
          completed,
        },
        generatedAt: new Date().toISOString(),
        timezone: tenantTimezone,
      },
      mode: 'lite-digest',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Weekly digest failed';
    res.status(500).json({ error: 'weekly_digest_failed', message });
  }
};
