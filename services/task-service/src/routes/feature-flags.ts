import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getFeatureFlags } from '../services/feature-flags';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  res.status(400).json({ error: 'tenant_id_required' });
});

router.get('/:tenantId', requireAuth, async (req: AuthRequest, res) => {
  const rawTenantId = req.params.tenantId;
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'missing_tenant_id' });
  }
  if (req.tenantId && req.tenantId !== tenantId) {
    return res.status(403).json({ error: 'tenant_mismatch' });
  }
  try {
    res.json({ tenantId, items: getFeatureFlags(tenantId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
