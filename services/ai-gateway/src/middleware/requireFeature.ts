import type { NextFunction, Request, Response } from 'express';
import { isFeatureEnabledForRequest } from '../services/featureFlags.js';
import { getTenantAiSettings } from '../services/tenantAiSettings.js';

export const requireFeature = (
  feature: 'task_creation' | 'semantic_search' | 'task_summary' | 'weekly_digest' | 'workflow_suggest',
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ error: 'Missing tenant context' });
      return;
    }

    const tenantSettings = await getTenantAiSettings(tenantId);
    const enabled = tenantSettings.enabled && isFeatureEnabledForRequest(feature, req);

    if (!enabled) {
      res.status(403).json({
        error: 'feature_not_available',
        message: 'This AI feature is not available for your current plan or is temporarily disabled.',
      });
      return;
    }

    next();
  };
};
