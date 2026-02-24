import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcryptjs from 'bcryptjs';
import authRoutes from '../src/routes/auth';
import adminRoutes from '../src/routes/admin';
import taskRoutes from '../src/routes/tasks';
import { prisma } from '../src/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/admin/v1', adminRoutes);
app.use('/api/v1/tasks', taskRoutes);

const suffix = `${Date.now()}`;
const tenantId = `tenant-impersonation-${suffix}`;
const workspaceId = `workspace-impersonation-${suffix}`;
const projectId = `project-impersonation-${suffix}`;
const superAdminId = `user-superadmin-${suffix}`;
const memberId = `user-member-${suffix}`;
const superAdminEmail = `superadmin-impersonation-${suffix}@example.com`;
const memberEmail = `member-impersonation-${suffix}@example.com`;
const password = 'Password123!';

describe('Impersonation workflow', () => {
  beforeAll(async () => {
    const passwordHash = await bcryptjs.hash(password, 12);

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Impersonation Tenant',
      },
    });

    await prisma.user.createMany({
      data: [
        {
          id: superAdminId,
          tenantId,
          email: superAdminEmail,
          displayName: 'Impersonation SuperAdmin',
          role: 'OWNER',
          passwordHash,
          emailVerified: true,
        },
        {
          id: memberId,
          tenantId,
          email: memberEmail,
          displayName: 'Impersonation Member',
          role: 'MEMBER',
          passwordHash,
          emailVerified: true,
        },
      ],
    });

    await prisma.workspace.create({
      data: {
        id: workspaceId,
        tenantId,
        name: 'Impersonation Workspace',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        workspaceId,
        name: 'Impersonation Project',
        ownerId: superAdminId,
      },
    });

    const task = await prisma.task.create({
      data: {
        tenantId,
        projectId,
        createdBy: superAdminId,
        title: 'Impersonation Task',
        status: 'TODO',
      },
    });

    await prisma.taskUserAssignment.create({
      data: {
        taskId: task.id,
        userId: memberId,
        assignedBy: superAdminId,
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('allows superadmin to impersonate a member and use task APIs, then logout', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: superAdminEmail,
        password,
        tenant_id: tenantId,
      });

    expect(loginResponse.status).toBe(200);
    expect(typeof loginResponse.body.accessToken).toBe('string');

    const impersonateResponse = await request(app)
      .post(`/admin/v1/users/${memberId}/impersonate`)
      .set({
        Authorization: `Bearer ${loginResponse.body.accessToken}`,
        'X-Tenant-ID': tenantId,
      });

    expect(impersonateResponse.status).toBe(200);
    expect(impersonateResponse.body.user.email).toBe(memberEmail);
    expect(impersonateResponse.body.tenantId).toBe(tenantId);
    expect(typeof impersonateResponse.body.accessToken).toBe('string');
    expect(typeof impersonateResponse.body.refreshToken).toBe('string');

    const tasksResponse = await request(app)
      .get('/api/v1/tasks')
      .set({
        Authorization: `Bearer ${impersonateResponse.body.accessToken}`,
        'X-Tenant-ID': tenantId,
      });

    expect(tasksResponse.status).toBe(200);
    expect(Array.isArray(tasksResponse.body)).toBe(true);
    expect(tasksResponse.body.some((task: any) => task.title === 'Impersonation Task')).toBe(true);

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set({ 'X-Tenant-ID': tenantId })
      .send({ refreshToken: impersonateResponse.body.refreshToken });

    expect(logoutResponse.status).toBe(200);
  });
});
