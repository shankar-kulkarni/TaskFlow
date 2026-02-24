import { Router } from 'express';
import { prisma } from '../prisma';
import { TaskStatus } from '@prisma/client';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { myTaskSchemas } from '../validation/schemas';
import { strictMyTaskSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/my-tasks - Current user's tasks
router.get(
  '/',
  requireAuth,
  requirePermission('tasks:read:own'),
  validateByMode({ query: myTaskSchemas.query }, { query: strictMyTaskSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).userId as string | undefined;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { status, sort = 'due_date:asc', group_by = 'project', page = '1', page_size = '50' } = req.query;

    const statusFilter: TaskStatus[] = status ? (status as string).split(',').map(s => s.trim() as TaskStatus) : ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];

    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        isArchived: false,
        status: { in: statusFilter },
        OR: [
          { createdBy: userId },
          { userAssignments: { some: { userId } } },
          { groupAssignments: { some: { group: { members: { some: { userId } } } } } }
        ]
      },
      include: {
        project: true,
        creator: true,
        userAssignments: { where: { userId }, select: { userId: true } },
        groupAssignments: { include: { group: true } }
      },
      orderBy: sort === 'due_date:asc' ? { dueDate: 'asc' } : { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(page_size as string),
      take: parseInt(page_size as string)
    });

    const groups: { [key: string]: any } = {};
    tasks.forEach(task => {
      const groupKey = group_by === 'project' ? (task.projectId || 'No Project') : task.status;
      const color = task.project?.color || '#4f8eff';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          color,
          tasks: []
        };
      }

      groups[groupKey].tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.dueDate,
        project_name: task.project?.name || null,
        project_color: color
      });
    });

    const overdueCount = tasks.filter(t => t.dueDate && t.dueDate < new Date()).length;

    res.json({
      tasks,
      groups: Object.values(groups),
      total: tasks.length,
      overdue_count: overdueCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch my tasks' });
  }
  },
);

export default router;