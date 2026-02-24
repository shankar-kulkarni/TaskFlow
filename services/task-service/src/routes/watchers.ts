import { Router } from 'express';
import { AuditService } from '../services/audit.service';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { watcherSchemas } from '../validation/schemas';
import { strictWatcherSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req, 'tenant-default') as string;

// GET /api/v1/tasks/:taskId/watchers - Get all watchers for a task
router.get(
  '/:taskId/watchers',
  requireAuth,
  validateByMode(
    { params: watcherSchemas.params.taskId, query: watcherSchemas.query },
    { params: strictWatcherSchemas.params.taskId, query: strictWatcherSchemas.query },
  ),
  async (req: any, res) => {
  try {
    const { taskId } = req.params;
    const tenantId = getTenantId(req);

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const watchers = await prisma.taskWatcher.findMany({
      where: {
        taskId,
        unsubscribedAt: null
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true, role: true }
        }
      },
      orderBy: { addedAt: 'desc' }
    });

    res.json({
      taskId,
      watchers: watchers.map(w => ({
        user: w.user,
        addedAt: w.addedAt,
        notificationType: w.notificationType
      })),
      count: watchers.length
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// POST /api/v1/tasks/:taskId/watchers - Add watcher to task
router.post(
  '/:taskId/watchers',
  requireAuth,
  validateByMode(
    { params: watcherSchemas.params.taskId, body: watcherSchemas.body },
    { params: strictWatcherSchemas.params.taskId, body: strictWatcherSchemas.body },
  ),
  async (req: any, res) => {
  try {
    const { taskId } = req.params;
    const { userId, notificationType = 'all' } = req.body;
    const tenantId = getTenantId(req);

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const watcherUserId = userId || req.userId;

    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { id: watcherUserId }
    });

    const existing = await prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId: watcherUserId } }
    });

    if (existing && !existing.unsubscribedAt) {
      return res.status(400).json({ error: 'User is already watching this task' });
    }

    const watcher = existing
      ? await prisma.taskWatcher.update({
          where: { taskId_userId: { taskId, userId: watcherUserId } },
          data: { unsubscribedAt: null, notificationType }
        })
      : await prisma.taskWatcher.create({
          data: { taskId, userId: watcherUserId, notificationType }
        });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_watcher',
      taskId,
      'add',
      null,
      { userId: watcherUserId, displayName: targetUser.displayName, notificationType },
      req.ip
    );

    res.json({
      user: { id: watcherUserId, displayName: targetUser.displayName, email: targetUser.email },
      notificationType: watcher.notificationType
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// DELETE /api/v1/tasks/:taskId/watchers/:userId - Remove watcher from task
router.delete(
  '/:taskId/watchers/:userId',
  requireAuth,
  validateByMode(
    { params: watcherSchemas.params.watcher },
    { params: strictWatcherSchemas.params.watcher },
  ),
  async (req: any, res) => {
  try {
    const { taskId, userId } = req.params;
    const tenantId = getTenantId(req);

    await prisma.taskWatcher.update({
      where: { taskId_userId: { taskId, userId } },
      data: { unsubscribedAt: new Date() }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true }
    });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_watcher',
      taskId,
      'remove',
      { userId, displayName: user?.displayName },
      null,
      req.ip
    );

    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// PATCH /api/v1/tasks/:taskId/watchers/:userId - Update watcher notification type
router.patch(
  '/:taskId/watchers/:userId',
  requireAuth,
  validateByMode(
    { params: watcherSchemas.params.watcher, body: watcherSchemas.body },
    { params: strictWatcherSchemas.params.watcher, body: strictWatcherSchemas.body },
  ),
  async (req: any, res) => {
  try {
    const { taskId, userId } = req.params;
    const { notificationType } = req.body;
    const tenantId = getTenantId(req);

    if (!['all', 'updates_only', 'mentions_only'].includes(notificationType)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const updated = await prisma.taskWatcher.update({
      where: { taskId_userId: { taskId, userId } },
      data: { notificationType }
    });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_watcher',
      taskId,
      'update',
      null,
      { notificationType },
      req.ip
    );

    res.json({
      userId,
      notificationType: updated.notificationType
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

export default router;
