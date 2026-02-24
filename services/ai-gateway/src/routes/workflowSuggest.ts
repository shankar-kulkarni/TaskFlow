import type { Request, Response } from 'express';
import { db } from '../services/db.js';
import { getTenantTimezone } from '../services/tenantTimezone.js';

export const workflowSuggestionHandler = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(401).json({ error: 'Missing tenant context' });
    return;
  }

  try {
    const tenantTimezone = await getTenantTimezone(tenantId);
    const metrics = await db.query<{
      high_without_due: string;
      blocked_count: string;
      in_review_count: string;
    }>(
      `
      SELECT
        COUNT(*) FILTER (WHERE priority::text IN ('HIGH', 'CRITICAL') AND due_date IS NULL)::text AS high_without_due,
        COUNT(*) FILTER (WHERE status::text = 'BLOCKED')::text AS blocked_count,
        COUNT(*) FILTER (WHERE status::text = 'IN_REVIEW')::text AS in_review_count
      FROM tasks
      WHERE tenant_id::text = $1::text
        AND is_archived = false
        AND created_at >= NOW() - INTERVAL '30 days'
      `,
      [tenantId],
    );

    const row = metrics.rows[0] ?? { high_without_due: '0', blocked_count: '0', in_review_count: '0' };

    const suggestions = [
      {
        id: 'wf-high-priority-due-date',
        title: 'Auto-set due date on high priority tasks',
        description: `${row.high_without_due} high/critical task(s) created without due dates in the last 30 days.`,
        trigger: { event: 'task.created', condition: 'priority in [HIGH, CRITICAL] and due_date is null' },
        action: { type: 'set_due_date', value: 'now + 3d' },
      },
      {
        id: 'wf-blocked-alert',
        title: 'Notify lead when task becomes blocked',
        description: `${row.blocked_count} blocked task(s) observed recently.`,
        trigger: { event: 'task.updated', condition: 'status changed to BLOCKED' },
        action: { type: 'notify_role', value: 'PROJECT_LEAD' },
      },
      {
        id: 'wf-review-reminder',
        title: 'Reminder for prolonged review status',
        description: `${row.in_review_count} task(s) currently or recently in review.`,
        trigger: { event: 'task.updated', condition: 'status is IN_REVIEW for > 48h' },
        action: { type: 'post_comment', value: 'Reminder: review pending for over 48 hours' },
      },
    ];

    res.status(200).json({ data: { suggestions, timezone: tenantTimezone }, mode: 'lite-suggestions' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Workflow suggestion failed';
    res.status(500).json({ error: 'workflow_suggestion_failed', message });
  }
};
