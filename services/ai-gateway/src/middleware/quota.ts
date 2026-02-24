import type { NextFunction, Request, Response } from 'express';
import { incrementDailyCounter, incrementMonthlyCounter } from '../services/quotaStore.js';
import { db } from '../services/db.js';
import { getTenantAiSettings } from '../services/tenantAiSettings.js';

const toQuota = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const AI_QUOTAS: Record<string, { requestsPerDay: number }> = {
  free: { requestsPerDay: toQuota(process.env.AI_QUOTA_FREE, 500) }, // default now 500
  starter: { requestsPerDay: toQuota(process.env.AI_QUOTA_STARTER, 1000) },
  business: { requestsPerDay: toQuota(process.env.AI_QUOTA_BUSINESS, 5000) },
  enterprise: { requestsPerDay: toQuota(process.env.AI_QUOTA_ENTERPRISE, -1) },
};

const getToday = (): string => new Date().toISOString().slice(0, 10);
const getMonthKey = (): string => new Date().toISOString().slice(0, 7); // YYYY-MM

const estimateTokenUsage = (req: Request): number => {
  const bodyText = req.body ? JSON.stringify(req.body) : '';
  const bodyTokens = Math.ceil(bodyText.length / 4);

  if (req.path.includes('/digest/weekly')) return Math.max(300, bodyTokens);
  if (req.path.includes('/search')) return Math.max(120, bodyTokens);
  if (req.path.includes('/summarise')) return Math.max(200, bodyTokens);

  return Math.max(80, bodyTokens);
};

export const enforceAIQuota = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const plan = (req.plan ?? 'free').toLowerCase();
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(401).json({ error: 'Missing tenant context' });
    return;
  }

  // Try to fetch per-tenant quota from DB
  let requestsPerDay: number | null = null;
  try {
    const result = await db.query('SELECT "ai_quota_per_day" FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length && result.rows[0].ai_quota_per_day != null) {
      requestsPerDay = Number(result.rows[0].ai_quota_per_day);
    }
  } catch (err) {
    // fallback to plan/default if DB fails
    requestsPerDay = null;
  }

  // Fallback to plan or default quota if not set
  if (requestsPerDay == null) {
    requestsPerDay = (AI_QUOTAS[plan] ?? AI_QUOTAS.free).requestsPerDay;
  }

  if (requestsPerDay === -1) {
    requestsPerDay = null;
  }

  if (requestsPerDay != null) {
    const key = `ai:quota:${tenantId}:${getToday()}`;
    const usage = await incrementDailyCounter(key);

    if (usage > requestsPerDay) {
      res.status(429).json({
        error: 'ai_quota_exceeded',
        message: `Your plan allows ${requestsPerDay} AI requests per day.`,
        upgradeUrl: '/settings/billing',
      });
      return;
    }

    req.quotaKey = key;
  }

  const tenantSettings = await getTenantAiSettings(tenantId);
  const tokenUsage = estimateTokenUsage(req);
  const monthKey = `ai:token_quota:${tenantId}:${getMonthKey()}`;
  const monthTotal = await incrementMonthlyCounter(monthKey, tokenUsage);

  if (monthTotal > tenantSettings.tokensPerMonth) {
    res.status(403).json({
      error: 'ai_token_quota_exceeded',
      message: `Monthly AI token quota exceeded (${tenantSettings.tokensPerMonth}).`,
      upgradeUrl: '/settings/billing',
    });
    return;
  }

  next();
};
