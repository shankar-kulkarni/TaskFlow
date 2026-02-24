import { Router } from 'express';
import { AuditService } from '../services/audit.service';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/v1/audit-logs - Get audit logs for tenant
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const { entityType, entityId, limit = 50, offset = 0, dateFrom, dateTo } = req.query;
    const tenantId = req.tenantId || 'tenant-default';

    // Check if user has permission to view audit logs (admin/owner)
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to view audit logs' });
    }

    const where: any = { tenantId };

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit), 200),
      skip: parseInt(offset)
    });

    const count = await prisma.auditLog.count({ where });

    res.json({
      logs,
      count,
      limit: Math.min(parseInt(limit), 200),
      offset: parseInt(offset)
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/audit-logs/:entityType/:entityId - Get audit trail for specific entity
router.get('/:entityType/:entityId', requireAuth, async (req: any, res) => {
  try {
    const { entityType, entityId } = req.params;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Missing tenant context' });
    }

    // Check if user has permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to view audit logs' });
    }

    const activity = await AuditService.getEntityActivity(tenantId, entityType, entityId);

    res.json({
      entityType,
      entityId,
      activity,
      count: activity.length
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/audit-logs/stats/summary - Get audit log summary statistics
router.get('/stats/summary', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.tenantId || 'tenant-default';

    // Check if user has permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to view audit logs' });
    }

    // Get logs from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // Calculate statistics
    const stats = {
      totalEvents: logs.length,
      byAction: {} as any,
      byEntity: {} as any,
      byActor: {} as any,
      topActors: [] as any[],
      topEntities: [] as any[]
    };

    // Count by action
    logs.forEach((log: any) => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byEntity[log.entityType] = (stats.byEntity[log.entityType] || 0) + 1;
      stats.byActor[log.actorId] = (stats.byActor[log.actorId] || 0) + 1;
    });

    // Get top actors
    const topActors = Object.entries(stats.byActor)
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    for (const actor of topActors) {
      const user = await prisma.user.findUnique({
        where: { id: actor.actorId },
        select: { id: true, displayName: true, email: true }
      });
      if (user) {
        stats.topActors.push({ ...user, count: actor.count });
      }
    }

    // Get top modified entities
    const topEntities = Object.entries(stats.byEntity)
      .map(([entityType, count]) => ({ entityType, count }))
      .sort((a: any, b: any) => b.count - a.count);

    stats.topEntities = topEntities;

    res.json(stats);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
