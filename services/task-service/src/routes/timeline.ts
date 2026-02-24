import { Router } from 'express';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { dependencySchemas, timelineSchemas } from '../validation/schemas';
import { strictDependencySchemas, strictTimelineSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/timeline - Gantt data
router.get(
  '/',
  validateByMode({ query: timelineSchemas.query }, { query: strictTimelineSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, start, end, group_by = 'project', project_id } = req.query;

    if (!workspace_id || !start || !end) {
      return res.status(400).json({ error: 'workspace_id, start, end required' });
    }

    const where: any = {
      tenantId,
      OR: [
        { startDate: { gte: new Date(start as string), lte: new Date(end as string) } },
        { dueDate: { gte: new Date(start as string), lte: new Date(end as string) } }
      ]
    };

    if (project_id) where.projectId = project_id;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: true,
        dependencies: { include: { dependsOn: true } }
      }
    });

    const groups: { [key: string]: any } = {};
    tasks.forEach(task => {
      const groupKey = task.project?.name || 'No Project';
      const groupId = task.project?.id || 'no-project';

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupId,
          name: groupKey,
          color: task.project?.color || '#4f8eff',
          tasks: []
        };
      }

      groups[groupKey].tasks.push({
        id: task.id,
        title: task.title,
        start_date: task.startDate?.toISOString().split('T')[0],
        due_date: task.dueDate?.toISOString().split('T')[0],
        status: task.status,
        priority: task.priority,
        dependencies: task.dependencies.map(d => d.dependsOn.id)
      });
    });

    res.json({
      range: { start, end },
      groups: Object.values(groups)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
  },
);

// POST /api/v1/task-dependencies - Add dependency
router.post(
  '/task-dependencies',
  validateByMode({ body: dependencySchemas.body }, { body: strictDependencySchemas.body }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { task_id, depends_on_id, dependency_type, lag_days } = req.body;
    const createdBy = 'user-uuid'; // TODO: from auth

    // Verify tasks exist and belong to tenant
    const task = await prisma.task.findFirst({ where: { id: task_id, tenantId } });
    const dependsOn = await prisma.task.findFirst({ where: { id: depends_on_id, tenantId } });
    if (!task || !dependsOn) return res.status(404).json({ error: 'Task not found' });

    const dependency = await prisma.taskDependency.create({
      data: {
        taskId: task_id,
        dependsOnId: depends_on_id,
        dependencyType: dependency_type,
        lagDays: lag_days || 0,
        createdBy
      }
    });

    res.status(201).json(dependency);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create dependency' });
  }
  },
);

// DELETE /api/v1/task-dependencies/:id - Remove dependency
router.delete(
  '/task-dependencies/:id',
  validateByMode({ params: dependencySchemas.params.id }, { params: strictDependencySchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // Verify dependency exists via task
    const dependency = await prisma.taskDependency.findFirst({
      where: { id: req.params.id, task: { tenantId } }
    });
    if (!dependency) return res.status(404).json({ error: 'Dependency not found' });

    await prisma.taskDependency.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete dependency' });
  }
  },
);

export default router;