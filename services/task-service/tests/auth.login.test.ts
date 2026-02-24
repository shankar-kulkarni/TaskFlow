import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcryptjs from 'bcryptjs';
import authRoutes from '../src/routes/auth';
import { prisma } from '../src/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('Auth login', () => {
  const tenantId = 'tenant-auth-superadmin';
  const otherTenantId = 'tenant-auth-other';
  const userId = 'user-auth-superadmin';
  const email = 'superadmin@taskflow.local';
  const password = 'Password123!';

  beforeAll(async () => {
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: 'Auth Superadmin Tenant' },
      create: {
        id: tenantId,
        name: 'Auth Superadmin Tenant',
      },
    });
    await prisma.tenant.upsert({
      where: { id: otherTenantId },
      update: { name: 'Auth Other Tenant' },
      create: {
        id: otherTenantId,
        name: 'Auth Other Tenant',
      },
    });

    const passwordHash = await bcryptjs.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: {
        tenantId,
        displayName: 'Platform SuperAdmin',
        role: 'OWNER',
        passwordHash,
        emailVerified: true,
      },
      create: {
        id: userId,
        tenantId,
        email,
        displayName: 'Platform SuperAdmin',
        role: 'OWNER',
        passwordHash,
        emailVerified: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.authSession.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
  });

  it('allows superadmin login even when request tenant differs and returns actual tenant', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
        tenant_id: otherTenantId,
      });

    expect(response.status).toBe(200);
    expect(response.body.user?.isSuperAdmin).toBe(true);
    expect(typeof response.body.user?.passwordResetRequired).toBe('boolean');
    expect(response.body.tenantId).toBe(tenantId);
    expect(typeof response.body.accessToken).toBe('string');
  });
});
