import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

type JwtPayload = {
  tenant_id?: string;
  tenantId?: string;
  sub?: string;
  userId?: string;
  role?: string;
  plan?: string;
};

export const authenticateTenantJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  const secret =
    process.env.PRODUCT_JWT_SECRET ??
    process.env.JWT_SECRET ??
    'dev-secret-key-change-me-32-characters-min';
  if (!secret) {
    res.status(500).json({ error: 'PRODUCT_JWT_SECRET not configured' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    const tenantId = payload.tenant_id ?? payload.tenantId;
    const userId = payload.sub ?? payload.userId;

    if (!tenantId || !userId) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    req.tenantId = tenantId;
    req.userId = userId;
    req.userRole = payload.role ?? 'MEMBER';
    req.plan = (payload.plan ?? 'free').toLowerCase();
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
