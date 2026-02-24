import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/db.js';
import { getTenantTimezone, isDateOverdueInTimeZone } from '../services/tenantTimezone.js';

const schema = z.object({
  taskId: z.string().uuid(),
});

const summarizeText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
};

export const taskSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(401).json({ error: 'Missing tenant context' });
    return;
  }

  const { taskId } = parsed.data;

  try {
    const tenantTimezone = await getTenantTimezone(tenantId);
    const taskResult = await db.query<{
      id: string;
      title: string;
      status: string;
      priority: string;
      description: string | null;
      created_at: string;
      due_date: string | null;
    }>(
      `
      SELECT id, title, status::text, priority::text, description, created_at, due_date
      FROM tasks
      WHERE id::text = $1::text AND tenant_id::text = $2::text
      LIMIT 1
      `,
      [taskId, tenantId],
    );

    if (taskResult.rowCount === 0) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const task = taskResult.rows[0];

    const commentsResult = await db.query<{
      body: string;
      created_at: string;
      display_name: string | null;
      email: string | null;
    }>(
      `
      SELECT tc.body, tc.created_at, u.display_name, u.email
      FROM task_comments tc
      JOIN users u ON u.id = tc.author_id
      JOIN tasks t ON t.id = tc.task_id
      WHERE tc.task_id::text = $1::text AND t.tenant_id::text = $2::text AND tc.deleted_at IS NULL
      ORDER BY tc.created_at DESC
      LIMIT 25
      `,
      [taskId, tenantId],
    );

    const totalComments = commentsResult.rowCount ?? 0;
    const recentComments = commentsResult.rows.slice(0, 5);

    const keyDecisions = recentComments.length
      ? recentComments.map((comment) => summarizeText(comment.body.replace(/\s+/g, ' ').trim(), 90))
      : ['No recent comments with explicit decisions.'];

    const blockers = [
      ...(task.status === 'BLOCKED' ? ['Task status is BLOCKED and needs unblock owner/action.'] : []),
      ...recentComments
        .map((comment) => comment.body)
        .filter((body) => /blocked|waiting|dependency|stuck/i.test(body))
        .slice(0, 3)
        .map((body) => summarizeText(body.replace(/\s+/g, ' ').trim(), 90)),
    ];

    const isOverdue = Boolean(isDateOverdueInTimeZone(task.due_date, tenantTimezone) && task.status !== 'DONE');

    const nextAction = isOverdue
      ? 'Prioritize this task today and confirm owner availability due to overdue status.'
      : task.status === 'BLOCKED'
      ? 'Identify and resolve the blocker owner in the next standup.'
      : 'Confirm progress update and next checkpoint with assignees.';

    const currentStatus = `Task is ${task.status.replace(/_/g, ' ').toLowerCase()} with ${task.priority.toLowerCase()} priority.`;

    res.status(200).json({
      data: {
        taskId: task.id,
        currentStatus,
        keyDecisions,
        blockers: blockers.length > 0 ? blockers : ['None'],
        suggestedNextAction: nextAction,
        meta: {
          totalComments,
          generatedAt: new Date().toISOString(),
          timezone: tenantTimezone,
        },
      },
      mode: 'lite-summary',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Task summary failed';
    res.status(500).json({ error: 'task_summary_failed', message });
  }
};
