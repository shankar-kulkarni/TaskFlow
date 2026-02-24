import { Router } from 'express';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { calendarSchemas } from '../validation/schemas';
import { strictCalendarSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/calendar - Tasks by month/day
router.get(
  '/',
  validateByMode({ query: calendarSchemas.query }, { query: strictCalendarSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, year, month, project_id, assigned_to_user } = req.query;

    if (!workspace_id || !year || !month) {
      return res.status(400).json({ error: 'workspace_id, year, month required' });
    }

    const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);

    const where: any = {
      tenantId,
      dueDate: { gte: startDate, lte: endDate }
    };

    if (project_id) where.projectId = project_id;

    if (assigned_to_user) {
      where.OR = [
        { userAssignments: { some: { userId: assigned_to_user } } },
        { groupAssignments: { some: { group: { members: { some: { userId: assigned_to_user } } } } } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: true
      }
    });

    const days: { [key: string]: any[] } = {};
    tasks.forEach(task => {
      const dateKey = task.dueDate!.toISOString().split('T')[0];
      if (!days[dateKey]) days[dateKey] = [];
      days[dateKey].push({
        task_id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        project_color: task.project?.color || '#4f8eff',
        project_name: task.project?.name || 'No Project'
      });
    });

    res.json({
      month: `${year}-${month}`,
      days
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
  },
);

export default router;