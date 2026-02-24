import { Router } from 'express';
import { prisma } from '../prisma';
import { optionalAuth } from '../middleware/auth';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { userSchemas } from '../validation/schemas';
import { strictUserSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req, 'tenant-default') as string;

// GET /api/v1/users - List users for tenant
router.get(
  '/',
  optionalAuth,
  validateByMode({ query: userSchemas.query }, { query: strictUserSchemas.query }),
  async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, displayName: true, email: true, role: true }
    });

    res.json(users);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

export default router;
