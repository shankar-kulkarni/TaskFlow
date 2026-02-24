import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcryptjs from 'bcryptjs';
import authRoutes from '../src/routes/auth';
import adminRoutes from '../src/routes/admin';
import accountRoutes from '../src/routes/account';
import { prisma } from '../src/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/admin/v1', adminRoutes);

describe('Session revoke enforcement', () => {
  const suffix = `${Date.now()}`;
  const tenantId = `tenant-session-revoke-${suffix}`;
  const ownerId = `owner-session-revoke-${suffix}`;
  const memberId = `member-session-revoke-${suffix}`;
  const ownerEmail = `owner-session-revoke-${suffix}@example.com`;
  const memberEmail = `member-session-revoke-${suffix}@example.com`;
  const password = 'Password123!';

  beforeAll(async () => {
    const passwordHash = await bcryptjs.hash(password, 12);
    await prisma.tenant.create({
      data: { id: tenantId, name: 'Session Revoke Tenant' },
    });
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          tenantId,
          email: ownerEmail,
          displayName: 'Owner',
          role: 'OWNER',
          passwordHash,
          emailVerified: true,
        },
        {
          id: memberId,
          tenantId,
          email: memberEmail,
          displayName: 'Member',
          role: 'MEMBER',
          passwordHash,
          emailVerified: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.authSession.deleteMany({ where: { userId: { in: [ownerId, memberId] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [ownerId, memberId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('invalidates active access token after admin revoke sessions', async () => {
    const memberLogin = await request(app).post('/api/v1/auth/login').send({
      email: memberEmail,
      password,
      tenant_id: tenantId,
    });
    expect(memberLogin.status).toBe(200);
    const memberAccessToken = memberLogin.body.accessToken as string;

    const meBefore = await request(app)
      .get('/api/v1/account/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(meBefore.status).toBe(200);

    const ownerLogin = await request(app).post('/api/v1/auth/login').send({
      email: ownerEmail,
      password,
      tenant_id: tenantId,
    });
    expect(ownerLogin.status).toBe(200);
    const ownerAccessToken = ownerLogin.body.accessToken as string;

    const revoke = await request(app)
      .post(`/admin/v1/users/${memberId}/revoke-sessions`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(revoke.status).toBe(200);
    expect(revoke.body.revoked).toBeGreaterThan(0);

    const meAfter = await request(app)
      .get('/api/v1/account/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(meAfter.status).toBe(401);
  });
});
