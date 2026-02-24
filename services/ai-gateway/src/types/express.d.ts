import 'express';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      userRole?: string;
      plan?: string;
      quotaKey?: string;
    }
  }
}

export {};
