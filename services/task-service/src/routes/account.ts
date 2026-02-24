import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { AuthService } from '../services/auth.service';

const router = Router();

// GET /api/v1/account/me
router.get('/me', requireAuth, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/v1/account/me
router.patch('/me', requireAuth, async (req: any, res) => {
  try {
    const { displayName, email, avatarUrl } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        displayName: displayName || undefined,
        email: email || undefined,
        avatarUrl: avatarUrl || undefined
      },
      select: { id: true, email: true, displayName: true, avatarUrl: true, role: true }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/account/password
router.post('/password', requireAuth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing password fields' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await AuthService.verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const passwordHash = await AuthService.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash, passwordResetRequired: false }
    });

    res.json({ message: 'Password updated' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/account/sessions
router.get('/sessions', requireAuth, async (req: any, res) => {
  try {
    const sessions = await prisma.authSession.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(sessions);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/account/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req: any, res) => {
  try {
    const deleted = await prisma.authSession.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/v1/account/sessions/revoke-all
router.post('/sessions/revoke-all', requireAuth, async (req: any, res) => {
  try {
    await prisma.authSession.deleteMany({
      where: { userId: req.userId }
    });

    res.json({ message: 'All sessions revoked' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
