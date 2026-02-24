import { Router } from 'express';
import { NotificationService } from '../services/notification.service';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/v1/notifications
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const notifications = await NotificationService.getNotifications(
      req.userId,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(notifications);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/notifications/unread
router.get('/unread', requireAuth, async (req: any, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.userId,
        readAt: null
      }
    });
    res.json({ unreadCount: count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: any, res) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const updated = await NotificationService.markAsRead(req.params.id);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', requireAuth, async (req: any, res) => {
  try {
    await NotificationService.markAllAsRead(req.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/notifications/preferences
router.get('/preferences', requireAuth, async (req: any, res) => {
  try {
    const preferences = await NotificationService.getPreferences(req.userId);
    res.json(preferences);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/notifications/preferences
router.post('/preferences', requireAuth, async (req: any, res) => {
  try {
    const { emailOnAssignment, emailOnMention, emailOnComment, emailOnUpdate } = req.body;
    const preferences = await NotificationService.createOrUpdatePreferences(
      req.userId,
      {
        emailOnAssignment,
        emailOnMention,
        emailOnComment,
        emailOnUpdate
      }
    );
    res.json(preferences);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
