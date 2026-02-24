import { Router } from 'express';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { analyticsSchemas } from '../validation/schemas';
import { strictAnalyticsSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/analytics/overview - Workspace metrics
router.get(
  '/overview',
  validateByMode({ query: analyticsSchemas.query }, { query: strictAnalyticsSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, period = 'last_30_days', project_id } = req.query;

    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    const endDate = new Date();
    const startDate = new Date();
    if (period === 'last_30_days') startDate.setDate(endDate.getDate() - 30);

    const where: any = {
      tenantId,
      createdAt: { gte: startDate, lte: endDate }
    };
    if (project_id) where.projectId = project_id;

    const tasks = await prisma.task.findMany({ where });

    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const completionRate = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'DONE').length;

    const velocity = completed / 4; // simplified weekly average

    const avgCycleTime = tasks
      .filter(t => t.completedAt && t.createdAt)
      .reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()), 0) / Math.max(completed, 1) / (1000 * 60 * 60); // hours

    const statusCounts = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as any);

    const priorityCounts = tasks.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {} as any);

    res.json({
      period: { start: startDate.toISOString(), end: endDate.toISOString() },
      summary: {
        total_tasks: totalTasks,
        completed,
        completion_rate: Math.round(completionRate * 100) / 100,
        velocity_per_week: Math.round(velocity * 100) / 100,
        avg_cycle_time_hrs: Math.round(avgCycleTime * 100) / 100,
        overdue_count: overdue
      },
      by_status: statusCounts,
      by_priority: priorityCounts,
      velocity_chart: [] // TODO: implement
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
  },
);

// GET /api/v1/analytics/projects - Per-project health
router.get(
  '/projects',
  validateByMode({ query: analyticsSchemas.query }, { query: strictAnalyticsSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id } = req.query;

    const projects = await prisma.project.findMany({
      where: { workspace: { tenantId } },
      include: { tasks: true }
    });

    const healthScores = await Promise.all(projects.map(async p => {
      const tasks = p.tasks;
      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'DONE').length;
      const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'DONE').length;
      const blocked = tasks.filter(t => t.status === 'BLOCKED').length;

      const overdueRatio = overdue / Math.max(total, 1);
      const blockedRatio = blocked / Math.max(total, 1);
      const progress = done / Math.max(total, 1);

      const score = Math.round((1 - overdueRatio) * 40 + (1 - blockedRatio) * 20 + progress * 40);
      const status = score >= 75 ? 'on_track' : score >= 45 ? 'at_risk' : 'off_track';

      return {
        project_id: p.id,
        name: p.name,
        health_score: score,
        status
      };
    }));

    res.json(healthScores);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project health' });
  }
  },
);

export default router;