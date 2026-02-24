type TenantRequestLike = {
  tenantId?: unknown;
  user?: { tenantId?: unknown };
  headers?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string' && first.trim().length > 0) {
      return first;
    }
  }

  return undefined;
};

export const getTenantId = (req: TenantRequestLike | undefined, fallback?: string): string | undefined => {
  if (!req) return fallback;

  return (
    asString(req.tenantId) ||
    asString(req.user?.tenantId) ||
    asString(req.headers?.['x-tenant-id']) ||
    asString(req.headers?.['X-Tenant-Id']) ||
    asString(req.params?.tenantId) ||
    asString(req.query?.tenantId) ||
    asString(req.body?.tenantId) ||
    fallback
  );
};
