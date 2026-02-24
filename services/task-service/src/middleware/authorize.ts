import { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../prisma';
import { hasPermission, Permission } from '../security/permissions';

type AuthzRequest = Request & {
  userId?: string;
  user?: { id?: string; role?: string; tenantId?: string };
};

const getUserId = (req: AuthzRequest): string | undefined => {
  return req.user?.id || req.userId;
};

export const requirePermission = (permission: Permission): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthzRequest;
      const userId = getUserId(authReq);
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, tenantId: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!hasPermission(user.role, permission)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      authReq.user = {
        ...(authReq.user || {}),
        id: user.id,
        role: user.role,
        tenantId: user.tenantId,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
