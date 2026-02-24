import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import bcryptjs from 'bcryptjs';
import { isSuperAdminEmail } from '../security/superadmin';
import { getFeatureFlagByKey, getFeatureFlags, hasFeatureFlag, setFeatureFlag } from '../services/feature-flags';
import { AuthService } from '../services/auth.service';

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = { ...user, isSuperAdmin: isSuperAdminEmail(user.email) };
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Unauthorized' });
  }
};

const writeAuditLog = async (
  actorId: string,
  tenantId: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown,
) => {
  await prisma.auditLog.create({
    data: {
      actorId,
      tenantId,
      entityType,
      entityId,
      action,
      oldValue: oldValue as any,
      newValue: newValue as any,
    },
  });
};

const canAccessTenant = (req: any, tenantId: string): boolean => {
  if (req.adminUser?.isSuperAdmin) return true;
  return req.adminUser?.tenantId === tenantId;
};

const enforceTenantAccess = (req: any, res: any, tenantId: string): boolean => {
  if (canAccessTenant(req, tenantId)) return true;
  res.status(403).json({ error: 'Forbidden for tenant scope' });
  return false;
};

const isOwnerOrSuperAdmin = (req: any): boolean => {
  return Boolean(req.adminUser?.isSuperAdmin || req.adminUser?.role === 'OWNER');
};

const normalizeTenantTimezone = (value: unknown): string => {
  const raw = String(value || 'UTC').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw }).format(new Date());
    return raw;
  } catch {
    return 'UTC';
  }
};

const getRequestedTenantId = (req: any): string => {
  const fromQuery = String(req.query?.tenantId || '').trim();
  if (fromQuery) return fromQuery;
  const fromHeader = String(req.headers?.['x-tenant-id'] || '').trim();
  if (fromHeader) return fromHeader;
  return '';
};

let aiSettingsTableReady = false;

const ensureTenantAiSettingsTable = async () => {
  if (aiSettingsTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tenant_ai_settings" (
      "tenant_id" TEXT PRIMARY KEY,
      "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
      "tokens_per_month" INTEGER NOT NULL DEFAULT 100000,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "tenant_ai_settings_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE CASCADE
    )
  `);

  aiSettingsTableReady = true;
};

router.use(requireAuth);
router.use(requireAdmin);
router.use((req: any, res, next) => {
  const tenantId = getRequestedTenantId(req);
  const isTenantListRequest = req.method === 'GET' && req.path === '/tenants';
  if (!tenantId && req.adminUser?.isSuperAdmin && isTenantListRequest) {
    req.scopeTenantId = '';
    return next();
  }
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }
  if (!req.adminUser?.isSuperAdmin && tenantId !== req.adminUser.tenantId) {
    return res.status(403).json({ error: 'Forbidden for tenant scope' });
  }
  req.scopeTenantId = tenantId;
  next();
});

router.get('/dashboard', async (req: any, res) => {
  try {
    const tenantId = String(req.scopeTenantId || '');
    const tenantScope = { tenantId };
    const [tenants, activeUsers, suspendedUsers, projects, tasks, recentTenants] = await Promise.all([
      Promise.resolve(1),
      prisma.user.count({ where: { status: 'ACTIVE', ...tenantScope } }),
      prisma.user.count({ where: { status: 'SUSPENDED', ...tenantScope } }),
      prisma.project.count({
        where: { workspace: { tenantId } },
      }),
      prisma.task.count({ where: tenantScope }),
      prisma.tenant.findMany({
        where: { deletedAt: null, id: tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          plan: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      totals: {
        tenants,
        activeUsers,
        suspendedUsers,
        projects,
        tasks,
      },
      recentTenants,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const scopeTenantId = String((req as any).scopeTenantId || '').trim();
    const clauses: string[] = ['"deleted_at" IS NULL'];
    const params: any[] = [];

    if (scopeTenantId) {
      params.push(scopeTenantId);
      clauses.push(`"id" = $${params.length}`);
    } else if (!(req as any).adminUser?.isSuperAdmin) {
      params.push((req as any).adminUser?.tenantId);
      clauses.push(`"id" = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const qIndex = params.length;
      clauses.push(`("name" ILIKE $${qIndex} OR "contact_email" ILIKE $${qIndex})`);
    }

    const sqlWithPortal = `
      SELECT
        "id",
        "name",
        "plan",
        COALESCE("timezone", 'UTC') AS "timezone",
        COALESCE("web_portal_url", 'http://localhost:5175') AS "web_portal_url",
        "contact_email",
        "status",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt",
        "deleted_at" AS "deletedAt"
      FROM "tenants"
      WHERE ${clauses.join(' AND ')}
      ORDER BY "created_at" DESC
      LIMIT 200
    `;
    const sqlWithoutPortal = `
      SELECT
        "id",
        "name",
        "plan",
        'UTC' AS "timezone",
        "contact_email",
        "status",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt",
        "deleted_at" AS "deletedAt"
      FROM "tenants"
      WHERE ${clauses.join(' AND ')}
      ORDER BY "created_at" DESC
      LIMIT 200
    `;
    let items: Array<any> = [];
    try {
      items = await prisma.$queryRawUnsafe<Array<any>>(sqlWithPortal, ...params);
    } catch {
      const fallback = await prisma.$queryRawUnsafe<Array<any>>(sqlWithoutPortal, ...params);
      items = fallback.map((row) => ({ ...row, web_portal_url: 'http://localhost:5175' }));
    }

    res.json({ items, total: items.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/tenants/:id/ai-settings', async (req, res) => {
  try {
    const tenantId = String(req.params.id || '').trim();
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant id is required' });
    }

    await ensureTenantAiSettingsTable();

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!enforceTenantAccess(req, res, tenantId)) return;

    const rows = await prisma.$queryRawUnsafe<Array<{ enabled: boolean; tokens_per_month: number }>>(
      'SELECT "enabled", "tokens_per_month" FROM "tenant_ai_settings" WHERE "tenant_id" = $1',
      tenantId,
    );

    if (rows.length === 0) {
      return res.json({ tenantId, enabled: false, tokensPerMonth: 100000 });
    }

    return res.json({
      tenantId,
      enabled: Boolean(rows[0].enabled),
      tokensPerMonth: Number(rows[0].tokens_per_month),
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.put('/tenants/:id/ai-settings', async (req: any, res) => {
  try {
    const tenantId = String(req.params.id || '').trim();
    const enabled = Boolean(req.body?.enabled);
    const tokensPerMonth = Number(req.body?.tokensPerMonth);

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant id is required' });
    }
    if (!Number.isFinite(tokensPerMonth) || tokensPerMonth < 1 || tokensPerMonth > 1000000000) {
      return res.status(400).json({ error: 'tokensPerMonth must be between 1 and 1000000000' });
    }

    await ensureTenantAiSettingsTable();

    const beforeRows = await prisma.$queryRawUnsafe<Array<{ enabled: boolean; tokens_per_month: number }>>(
      'SELECT "enabled", "tokens_per_month" FROM "tenant_ai_settings" WHERE "tenant_id" = $1',
      tenantId,
    );

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!enforceTenantAccess(req, res, tenantId)) return;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "tenant_ai_settings" ("tenant_id", "enabled", "tokens_per_month")
       VALUES ($1, $2, $3)
       ON CONFLICT ("tenant_id")
       DO UPDATE SET
         "enabled" = EXCLUDED."enabled",
         "tokens_per_month" = EXCLUDED."tokens_per_month",
         "updated_at" = NOW()`,
      tenantId,
      enabled,
      Math.round(tokensPerMonth),
    );

    const nextValue = { tenantId, enabled, tokensPerMonth: Math.round(tokensPerMonth) };
    const oldValue =
      beforeRows.length === 0
        ? { tenantId, enabled: false, tokensPerMonth: 100000 }
        : {
            tenantId,
            enabled: Boolean(beforeRows[0].enabled),
            tokensPerMonth: Number(beforeRows[0].tokens_per_month),
          };

    await writeAuditLog(
      req.adminUser.id,
      tenantId,
      'tenant-ai-settings',
      tenantId,
      'admin.tenant.ai-settings.update',
      oldValue,
      nextValue,
    );

    return res.json(nextValue);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.post('/tenants', async (req: any, res) => {
  try {
    if (!req.adminUser?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only SuperAdmin can create tenants' });
    }
    const name = String(req.body?.name || '').trim();
    const plan = String(req.body?.plan || 'Business').trim();
    const timezone = normalizeTenantTimezone(req.body?.timezone);
    const webPortalUrl = String(req.body?.web_portal_url || 'http://localhost:5175').trim() || 'http://localhost:5175';
    const contactEmail = req.body?.contact_email ? String(req.body.contact_email).trim() : null;

    if (!name) {
      return res.status(400).json({ error: 'Tenant name is required' });
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        plan,
        contact_email: contactEmail,
        status: 'active',
      },
    });
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "tenants" SET "timezone" = $1 WHERE "id" = $2`,
        timezone,
        tenant.id,
      );
    } catch {
      // Backward-compatible when migration has not been applied yet.
    }
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "tenants" SET "web_portal_url" = $1 WHERE "id" = $2`,
        webPortalUrl,
        tenant.id,
      );
    } catch {
      // Backward-compatible when migration has not been applied yet.
    }
    const tenantWithUrl = { ...tenant, web_portal_url: webPortalUrl, timezone };

    await writeAuditLog(req.adminUser.id, tenant.id, 'tenant', tenant.id, 'admin.tenant.create', undefined, tenantWithUrl);

    res.status(201).json(tenantWithUrl);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/tenants/:id', async (req: any, res) => {
  try {
    if (!isOwnerOrSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only Owner or SuperAdmin can update tenant settings' });
    }
    const id = String(req.params.id);
    if (!enforceTenantAccess(req, res, id)) return;
    const before = await prisma.tenant.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: req.body?.name,
        plan: req.body?.plan,
        contact_email: req.body?.contact_email,
        status: req.body?.status,
      },
    });
    if (req.body?.timezone !== undefined) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "tenants" SET "timezone" = $1 WHERE "id" = $2`,
          normalizeTenantTimezone(req.body?.timezone),
          id,
        );
      } catch {
        // Backward-compatible when migration has not been applied yet.
      }
    }
    const nextWebPortalUrl = String(req.body?.web_portal_url || '').trim();
    if (nextWebPortalUrl) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "tenants" SET "web_portal_url" = $1 WHERE "id" = $2`,
          nextWebPortalUrl,
          id,
        );
      } catch {
        // Backward-compatible when migration has not been applied yet.
      }
    }
    let savedWebPortalUrl = nextWebPortalUrl || 'http://localhost:5175';
    let savedTimezone = req.body?.timezone === undefined ? ((before as any).timezone || 'UTC') : normalizeTenantTimezone(req.body?.timezone);
    try {
      const afterRows = await prisma.$queryRawUnsafe<Array<{ web_portal_url: string | null; timezone: string | null }>>(
        `SELECT "web_portal_url", COALESCE("timezone", 'UTC') AS "timezone" FROM "tenants" WHERE "id" = $1`,
        id,
      );
      savedWebPortalUrl = afterRows[0]?.web_portal_url || savedWebPortalUrl;
      savedTimezone = afterRows[0]?.timezone || savedTimezone;
    } catch {
      // Backward-compatible when migration has not been applied yet.
    }
    const tenantWithUrl = {
      ...tenant,
      web_portal_url: savedWebPortalUrl,
      timezone: savedTimezone,
    };

    await writeAuditLog(req.adminUser.id, tenant.id, 'tenant', tenant.id, 'admin.tenant.update', before, tenantWithUrl);
    res.json(tenantWithUrl);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/tenants/:id/suspend', async (req: any, res) => {
  try {
    if (!isOwnerOrSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only Owner or SuperAdmin can suspend tenants' });
    }
    const id = String(req.params.id);
    if (!enforceTenantAccess(req, res, id)) return;
    const before = await prisma.tenant.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status: 'suspended' },
    });

    await writeAuditLog(req.adminUser.id, tenant.id, 'tenant', tenant.id, 'admin.tenant.suspend', before, tenant);
    res.json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/tenants/:id/reinstate', async (req: any, res) => {
  try {
    if (!isOwnerOrSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only Owner or SuperAdmin can reinstate tenants' });
    }
    const id = String(req.params.id);
    if (!enforceTenantAccess(req, res, id)) return;
    const before = await prisma.tenant.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { status: 'active' },
    });

    await writeAuditLog(req.adminUser.id, tenant.id, 'tenant', tenant.id, 'admin.tenant.reinstate', before, tenant);
    res.json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/tenants/:id', async (req: any, res) => {
  try {
    if (!req.adminUser?.isSuperAdmin) {
      return res.status(403).json({ error: 'Only SuperAdmin can delete tenants' });
    }
    const id = String(req.params.id);
    const before = await prisma.tenant.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'deleted' },
    });

    await writeAuditLog(req.adminUser.id, tenant.id, 'tenant', tenant.id, 'admin.tenant.delete', before, tenant);
    res.json(tenant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where: any = { tenantId: (req as any).scopeTenantId };

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        tenantId: true,
        passwordResetRequired: true,
        lastLoginAt: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        tenantId: user.tenantId,
        tenantName: user.tenant.name,
        passwordResetRequired: user.passwordResetRequired,
        lastLoginAt: user.lastLoginAt,
      })),
      total: items.length,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users', async (req: any, res) => {
  try {
    let tenantId = String(req.body?.tenantId || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const displayName = String(req.body?.displayName || '').trim();
    const role = String(req.body?.role || 'MEMBER').trim();
    const password = String(req.body?.password || '').trim();

    const allowedRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'];
    if (!req.adminUser?.isSuperAdmin) {
      tenantId = req.adminUser.tenantId;
    }

    if (!tenantId || !email || !displayName || !password || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'tenantId, email, displayName, role and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcryptjs.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        displayName,
        role: role as any,
        status: 'ACTIVE',
        passwordHash,
        emailVerified: true,
      },
    });

    await writeAuditLog(req.adminUser.id, tenantId, 'user', user.id, 'admin.user.create', undefined, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/bulk/suspend', async (req: any, res) => {
  try {
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
    if (userIds.length === 0) {
      return res.status(400).json({ error: 'userIds is required' });
    }

    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, tenantId: true } });
    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    if (!req.adminUser?.isSuperAdmin && users.some((user) => user.tenantId !== req.adminUser.tenantId)) {
      return res.status(403).json({ error: 'Forbidden for tenant scope' });
    }
    if (req.adminUser?.role === 'ADMIN') {
      const protectedUsers = await prisma.user.findMany({
        where: { id: { in: users.map((user) => user.id) }, role: { in: ['OWNER', 'ADMIN'] as any } },
        select: { id: true },
      });
      if (protectedUsers.length > 0) {
        return res.status(403).json({ error: 'Admin cannot suspend Owner/Admin accounts' });
      }
    }

    const scopedUserIds =
      req.adminUser?.isSuperAdmin
        ? userIds
        : users.filter((user) => user.tenantId === req.adminUser.tenantId).map((user) => user.id);
    const result = await prisma.user.updateMany({ where: { id: { in: scopedUserIds } }, data: { status: 'SUSPENDED' } });
    const tenantId = req.adminUser?.isSuperAdmin ? users[0].tenantId : req.adminUser.tenantId;

    await writeAuditLog(req.adminUser.id, tenantId, 'user', 'bulk', 'admin.user.bulk.suspend', undefined, {
      userIds,
      updated: result.count,
    });

    res.json({ updated: result.count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/bulk/role', async (req: any, res) => {
  try {
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
    const role = String(req.body?.role || '').trim();
    const allowedRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'];

    if (userIds.length === 0 || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'userIds and valid role are required' });
    }

    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, tenantId: true } });
    if (users.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    if (!req.adminUser?.isSuperAdmin && users.some((user) => user.tenantId !== req.adminUser.tenantId)) {
      return res.status(403).json({ error: 'Forbidden for tenant scope' });
    }
    if (req.adminUser?.role === 'ADMIN' && (role === 'OWNER' || role === 'ADMIN')) {
      return res.status(403).json({ error: 'Admin cannot assign OWNER or ADMIN role' });
    }

    const scopedUserIds =
      req.adminUser?.isSuperAdmin
        ? userIds
        : users.filter((user) => user.tenantId === req.adminUser.tenantId).map((user) => user.id);
    const result = await prisma.user.updateMany({ where: { id: { in: scopedUserIds } }, data: { role: role as any } });
    const tenantId = req.adminUser?.isSuperAdmin ? users[0].tenantId : req.adminUser.tenantId;

    await writeAuditLog(req.adminUser.id, tenantId, 'user', 'bulk', 'admin.user.bulk.role', undefined, {
      userIds,
      role,
      updated: result.count,
    });

    res.json({ updated: result.count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        tenantId: true,
        passwordResetRequired: true,
        lastLoginAt: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, user.tenantId)) return;

    res.json({
      ...user,
      tenantName: user.tenant.name,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/users/:id', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, before.tenantId)) return;
    if (req.adminUser?.role === 'ADMIN' && (before.role === 'OWNER' || before.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Admin cannot modify Owner/Admin accounts' });
    }

    const updates: any = {};
    if (req.body?.displayName !== undefined) {
      updates.displayName = String(req.body.displayName || '').trim();
    }
    if (req.body?.email !== undefined) {
      updates.email = String(req.body.email || '').trim().toLowerCase();
    }
    if (req.body?.role !== undefined) {
      const role = String(req.body.role || '').trim();
      const allowedRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (req.adminUser?.role === 'ADMIN' && (role === 'OWNER' || role === 'ADMIN')) {
        return res.status(403).json({ error: 'Admin cannot assign OWNER or ADMIN role' });
      }
      updates.role = role;
    }
    if (req.body?.status !== undefined) {
      const status = String(req.body.status || '').trim();
      const allowedStatus = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const user = await prisma.user.update({ where: { id }, data: updates });
    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.update', before, user);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    if (id === req.adminUser.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, before.tenantId)) return;
    if (req.adminUser?.role === 'ADMIN' && (before.role === 'OWNER' || before.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Admin cannot delete Owner/Admin accounts' });
    }

    const tombstoneEmail = `${before.email}.deleted.${Date.now()}`;
    const user = await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        passwordResetRequired: true,
        email: tombstoneEmail,
      },
    });

    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.delete', before, user);
    res.json({ deleted: true, id: user.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/suspend', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, before.tenantId)) return;
    if (req.adminUser?.role === 'ADMIN' && (before.role === 'OWNER' || before.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Admin cannot suspend Owner/Admin accounts' });
    }

    const user = await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.suspend', before, user);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/unsuspend', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, before.tenantId)) return;

    const user = await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.unsuspend', before, user);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/force-reset', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, before.tenantId)) return;

    const user = await prisma.user.update({
      where: { id },
      data: { passwordResetRequired: true },
    });

    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.force-reset', before, user);
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/revoke-sessions', async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, user.tenantId)) return;

    const result = await prisma.authSession.deleteMany({ where: { userId: id } });
    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.revoke-sessions', undefined, {
      revoked: result.count,
    });

    res.json({ revoked: result.count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/impersonate', async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: 'User id is required' });
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!enforceTenantAccess(req, res, user.tenantId)) return;
    if (req.adminUser?.role === 'ADMIN' && (user.role === 'OWNER' || user.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Admin cannot impersonate Owner/Admin accounts' });
    }
    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return res.status(400).json({ error: 'Cannot impersonate inactive user' });
    }

    const refreshToken = AuthService.generateRefreshToken(user.id);
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'admin-impersonation'),
      },
    });
    const accessToken = AuthService.generateAccessToken(user.id, user.tenantId, user.email, session.id);

    await writeAuditLog(req.adminUser.id, user.tenantId, 'user', user.id, 'admin.user.impersonate', undefined, {
      impersonatedUserId: user.id,
      impersonatedUserEmail: user.email,
      impersonatedUserRole: user.role,
    });

    return res.json({
      tenantId: user.tenantId,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
    const action = String(req.query.action || '').trim();
    const entityType = String(req.query.entityType || '').trim();
    const actorEmail = String(req.query.actorEmail || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const where: any = { tenantId: (req as any).scopeTenantId };
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = { contains: entityType, mode: 'insensitive' };
    if (actorEmail) {
      where.actor = {
        is: {
          email: { contains: actorEmail, mode: 'insensitive' },
        },
      };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const items = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { email: true },
        },
      },
    });

    res.json({
      items: items.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
        actorEmail: log.actor?.email || null,
      })),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/billing/overview', async (req: any, res) => {
  try {
    if (!isOwnerOrSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only Owner or SuperAdmin can access billing' });
    }
    const tenantId = String(req.scopeTenantId || '');
    const activeTenants = await prisma.tenant.count({ where: { deletedAt: null, status: 'active', id: tenantId } });
    const byPlan = await prisma.tenant.groupBy({
      by: ['plan'],
      where: { deletedAt: null, id: tenantId },
      _count: { _all: true },
    });

    res.json({
      activeTenants,
      plans: byPlan.map((row) => ({ plan: row.plan, count: row._count._all })),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/billing/invoices', async (req: any, res) => {
  try {
    if (!isOwnerOrSuperAdmin(req)) {
      return res.status(403).json({ error: 'Only Owner or SuperAdmin can access billing' });
    }
    const tenantId = String(req.scopeTenantId || '');
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null, id: tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, plan: true, status: true, createdAt: true },
    });

    const invoices = tenants.map((tenant, index) => ({
      id: `inv-${tenant.id.slice(0, 8)}-${index + 1}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      amount: tenant.plan === 'Enterprise' ? 999 : tenant.plan === 'Business' ? 299 : 99,
      currency: 'USD',
      status: tenant.status === 'suspended' ? 'overdue' : 'paid',
      issuedAt: tenant.createdAt,
    }));

    res.json({ items: invoices, total: invoices.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where: any = { tenantId: (req as any).scopeTenantId };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.group.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        members: true,
        tenant: { select: { name: true } },
      },
    });

    res.json({
      items: items.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
        tenantId: group.tenantId,
        tenantName: group.tenant.name,
        membersCount: group.members.length,
        createdAt: group.createdAt,
      })),
      total: items.length,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/groups', async (req: any, res) => {
  try {
    let tenantId = String(req.body?.tenantId || '').trim();
    const name = String(req.body?.name || '').trim();
    const description = req.body?.description ? String(req.body.description) : null;
    const color = req.body?.color ? String(req.body.color) : null;

    if (!req.adminUser?.isSuperAdmin) {
      tenantId = req.adminUser.tenantId;
    }
    if (!tenantId || !name) {
      return res.status(400).json({ error: 'tenantId and name are required' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const workspace = await prisma.workspace.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    if (!workspace) {
      return res.status(400).json({ error: 'No workspace found for tenant' });
    }

    const group = await prisma.group.create({
      data: {
        tenantId,
        workspaceId: workspace.id,
        name,
        description,
        color,
        createdBy: req.adminUser.id,
      },
    });

    await writeAuditLog(req.adminUser.id, tenantId, 'group', group.id, 'admin.group.create', undefined, group);
    res.status(201).json(group);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/analytics/platform', async (req: any, res) => {
  try {
    const tenantId = String(req.scopeTenantId || '');
    const tenantScope = { tenantId };
    const [tenants, activeUsers, projects, tasks, doneTasks] = await Promise.all([
      Promise.resolve(1),
      prisma.user.count({ where: { status: 'ACTIVE', ...tenantScope } }),
      prisma.project.count({
        where: { workspace: { tenantId } },
      }),
      prisma.task.count({ where: tenantScope }),
      prisma.task.count({ where: { status: 'DONE', ...tenantScope } }),
    ]);

    const completionRate = tasks === 0 ? 0 : Number(((doneTasks / tasks) * 100).toFixed(2));

    res.json({
      tenants,
      activeUsers,
      projects,
      tasks,
      doneTasks,
      completionRate,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/security/threats', async (req: any, res) => {
  try {
    const tenantId = String(req.scopeTenantId || '');
    const suspendedUsers = await prisma.user.count({
      where: { status: 'SUSPENDED', tenantId },
    });
    const recentAudit = await prisma.auditLog.count({
      where: { tenantId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    res.json({
      suspendedUsers,
      suspiciousEvents24h: recentAudit,
      ipBlocks: 0,
      riskLevel: suspendedUsers > 10 ? 'high' : suspendedUsers > 3 ? 'medium' : 'low',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/feature-flags', async (_req, res) => {
  try {
    res.json({
      items: getFeatureFlags(),
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/feature-flags/:key/toggle', async (req: any, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const enabled = Boolean(req.body?.enabled);

    if (!hasFeatureFlag(key)) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const previous = getFeatureFlagByKey(key)!;
    const nextValue = { ...previous, enabled };
    setFeatureFlag(key, nextValue);

    await writeAuditLog(req.adminUser.id, req.adminUser.tenantId, 'feature-flag', key, 'admin.feature-flag.toggle', previous, nextValue);
    res.json({ key, ...nextValue });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/notifications/announce', async (req: any, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    await writeAuditLog(
      req.adminUser.id,
      req.adminUser.tenantId,
      'notification',
      `announcement-${Date.now()}`,
      'admin.notification.announce',
      undefined,
      { message },
    );

    res.status(201).json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/infrastructure/services', async (req: any, res) => {
  try {
    const tenantId = String(req.scopeTenantId || '');
    const [projects, tasks, activeUsers] = await Promise.all([
      prisma.project.count({
        where: { workspace: { tenantId } },
      }),
      prisma.task.count({ where: { tenantId } }),
      prisma.user.count({ where: { status: 'ACTIVE', tenantId } }),
    ]);
    res.json({
      services: [
        { name: 'task-service', status: 'healthy' },
        { name: 'database', status: 'healthy' },
      ],
      stats: {
        activeUsers,
        projects,
        tasks,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
