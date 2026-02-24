import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { TenantPreferencesService, tenantLocale } from '../services/tenant-preferences.service';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { tenantSchemas } from '../validation/schemas';
import { strictTenantSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string | undefined;

// GET /api/v1/tenants/preferences
router.get('/preferences', optionalAuth, async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant id' });
    }

    const preferences = await TenantPreferencesService.getPreferences(tenantId);
    res.json(preferences);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/v1/tenants/preferences
router.put(
  '/preferences',
  optionalAuth,
  validateByMode({ body: tenantSchemas.body }, { body: strictTenantSchemas.body }),
  async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing tenant id' });
    }

    const locale = tenantLocale.normalize(req.body?.locale);
    const preferences = await TenantPreferencesService.updatePreferences(tenantId, { locale });
    res.json(preferences);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

export default router;
