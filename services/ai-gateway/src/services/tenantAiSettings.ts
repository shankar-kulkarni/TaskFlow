import { db } from './db.js';

export type TenantAiSettings = {
  enabled: boolean;
  tokensPerMonth: number;
};

const DEFAULT_TENANT_AI_SETTINGS: TenantAiSettings = {
  enabled: false,
  tokensPerMonth: 100000,
};

let tableReady = false;

const ensureTable = async (): Promise<void> => {
  if (tableReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS "tenant_ai_settings" (
      "tenant_id" TEXT PRIMARY KEY,
      "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
      "tokens_per_month" INTEGER NOT NULL DEFAULT 100000,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  tableReady = true;
};

export const getTenantAiSettings = async (tenantId: string): Promise<TenantAiSettings> => {
  try {
    await ensureTable();
    const result = await db.query(
      'SELECT "enabled", "tokens_per_month" FROM "tenant_ai_settings" WHERE "tenant_id" = $1',
      [tenantId],
    );

    if (!result.rows.length) return DEFAULT_TENANT_AI_SETTINGS;

    return {
      enabled: Boolean(result.rows[0].enabled),
      tokensPerMonth: Number(result.rows[0].tokens_per_month) || DEFAULT_TENANT_AI_SETTINGS.tokensPerMonth,
    };
  } catch {
    return DEFAULT_TENANT_AI_SETTINGS;
  }
};
