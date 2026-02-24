import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { prisma } from '../prisma';

export interface AuthRequest extends Request {
  userId?: string;
  tenantId?: string;
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const decoded = AuthService.verifyAccessToken(token);

    // If token carries a session id, enforce active session existence.
    // This allows admin-triggered revoke-sessions to invalidate active access immediately.
    if (decoded?.sessionId) {
      const session = await prisma.authSession.findUnique({
        where: { id: String(decoded.sessionId) },
        select: { id: true, userId: true, expiresAt: true },
      });
      if (!session || session.userId !== decoded.userId || session.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Session expired' });
      }
    }

    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = AuthService.verifyAccessToken(token);
      req.userId = decoded.userId;
      req.tenantId = decoded.tenantId;
    }
    next();
  } catch (error) {
    next();
  }
};
