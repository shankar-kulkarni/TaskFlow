import { prisma } from '../prisma';
const ALLOWED_LOCALES = ['en', 'hi', 'zh', 'es'] as const;
export type TenantLocale = typeof ALLOWED_LOCALES[number];

const normalizeLocale = (locale?: string): TenantLocale => {
  if (!locale) return 'en';
  const normalized = locale.toLowerCase();
  if (ALLOWED_LOCALES.includes(normalized as TenantLocale)) {
    return normalized as TenantLocale;
  }
  return 'en';
};

export class TenantPreferencesService {
  static async getPreferences(tenantId: string) {
    let prefs = await prisma.tenantPreferences.findUnique({
      where: { tenantId }
    });

    if (!prefs) {
      prefs = await prisma.tenantPreferences.create({
        data: { tenantId }
      });
    }

    const tenantRows = await prisma.$queryRawUnsafe<Array<{ timezone: string | null }>>(
      `SELECT COALESCE("timezone", 'UTC') AS "timezone" FROM "tenants" WHERE "id" = $1 LIMIT 1`,
      tenantId,
    );

    return {
      ...prefs,
      timezone: tenantRows[0]?.timezone || 'UTC',
    };
  }

  static async updatePreferences(tenantId: string, updates: { locale?: string }) {
    const locale = normalizeLocale(updates.locale);
    return prisma.tenantPreferences.upsert({
      where: { tenantId },
      update: { locale },
      create: { tenantId, locale }
    });
  }
}

export const tenantLocale = {
  allowed: ALLOWED_LOCALES,
  normalize: normalizeLocale
};
