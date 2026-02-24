import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRoutes from '../src/routes/admin';
import { prisma } from '../src/prisma';
import { AuthService } from '../src/services/auth.service';

const app = express();
app.use(express.json());
app.use('/admin/v1', adminRoutes);

const suffix = `${Date.now()}`;
const tenantAId = `tenant-admin-scope-a-${suffix}`;
const tenantBId = `tenant-admin-scope-b-${suffix}`;
const workspaceAId = `workspace-admin-scope-a-${suffix}`;
const workspaceBId = `workspace-admin-scope-b-${suffix}`;
const projectAId = `project-admin-scope-a-${suffix}`;
const projectBId = `project-admin-scope-b-${suffix}`;
const groupAId = `group-admin-scope-a-${suffix}`;
const groupBId = `group-admin-scope-b-${suffix}`;
const ownerAId = `user-owner-a-${suffix}`;
const adminAId = `user-admin-a-${suffix}`;
const ownerBId = `user-owner-b-${suffix}`;
const superAdminId = `user-superadmin-${suffix}`;
let superAdminUserId = superAdminId;

const ownerAEmail = `owner-a-${suffix}@example.com`;
const adminAEmail = `admin-a-${suffix}@example.com`;
const ownerBEmail = `owner-b-${suffix}@example.com`;
const superAdminEmail = 'superadmin@taskflow.local';

const authHeader = (userId: string, tenantId: string, email: string) => {
  const token = AuthService.generateAccessToken(userId, tenantId, email);
  return { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId };
};

describe('Admin tenant scope and superadmin visibility', () => {
  beforeAll(async () => {
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Admin Scope Tenant A' },
        { id: tenantBId, name: 'Admin Scope Tenant B' },
      ],
    });

    await prisma.user.createMany({
      data: [
        {
          id: ownerAId,
          tenantId: tenantAId,
          email: ownerAEmail,
          displayName: 'Owner A',
          role: 'OWNER',
          emailVerified: true,
        },
        {
          id: adminAId,
          tenantId: tenantAId,
          email: adminAEmail,
          displayName: 'Admin A',
          role: 'ADMIN',
          emailVerified: true,
        },
        {
          id: ownerBId,
          tenantId: tenantBId,
          email: ownerBEmail,
          displayName: 'Owner B',
          role: 'OWNER',
          emailVerified: true,
        },
      ],
    });
    const superAdminUser = await prisma.user.upsert({
      where: { email: superAdminEmail },
      update: {
        tenantId: tenantAId,
        displayName: 'Super Admin',
        role: 'OWNER',
        emailVerified: true,
      },
      create: {
        id: superAdminId,
        tenantId: tenantAId,
        email: superAdminEmail,
        displayName: 'Super Admin',
        role: 'OWNER',
        emailVerified: true,
      },
    });
    superAdminUserId = superAdminUser.id;

    await prisma.workspace.createMany({
      data: [
        { id: workspaceAId, tenantId: tenantAId, name: 'Workspace A' },
        { id: workspaceBId, tenantId: tenantBId, name: 'Workspace B' },
      ],
    });

    await prisma.project.createMany({
      data: [
        { id: projectAId, workspaceId: workspaceAId, name: 'Project A', ownerId: ownerAId },
        { id: projectBId, workspaceId: workspaceBId, name: 'Project B', ownerId: ownerBId },
      ],
    });

    await prisma.task.createMany({
      data: [
        { tenantId: tenantAId, projectId: projectAId, title: 'Task A1', createdBy: ownerAId, status: 'TODO' },
        { tenantId: tenantAId, projectId: projectAId, title: 'Task A2', createdBy: adminAId, status: 'DONE' },
        { tenantId: tenantBId, projectId: projectBId, title: 'Task B1', createdBy: ownerBId, status: 'IN_PROGRESS' },
      ],
    });

    await prisma.group.createMany({
      data: [
        { id: groupAId, tenantId: tenantAId, workspaceId: workspaceAId, name: 'Group A', createdBy: ownerAId },
        { id: groupBId, tenantId: tenantBId, workspaceId: workspaceBId, name: 'Group B', createdBy: ownerBId },
      ],
    });

    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: tenantAId,
          actorId: ownerAId,
          entityType: 'task',
          entityId: 'task-a',
          action: 'admin.scope.test.a',
        },
        {
          tenantId: tenantBId,
          actorId: ownerBId,
          entityType: 'task',
          entityId: 'task-b',
          action: 'admin.scope.test.b',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  });

  it('superadmin is scoped by tenantId filter when provided', async () => {
    const headers = authHeader(superAdminUserId, tenantAId, superAdminEmail);

    const tenantsRes = await request(app).get(`/admin/v1/tenants?tenantId=${tenantAId}`).set(headers);
    expect(tenantsRes.status).toBe(200);
    const tenantIds = tenantsRes.body.items.map((item: any) => item.id);
    expect(tenantIds).toContain(tenantAId);
    expect(tenantIds).not.toContain(tenantBId);

    const usersRes = await request(app).get(`/admin/v1/users?tenantId=${tenantAId}`).set(headers);
    expect(usersRes.status).toBe(200);
    const userTenantIds = new Set(usersRes.body.items.map((item: any) => item.tenantId));
    expect(userTenantIds.has(tenantAId)).toBe(true);
    expect(userTenantIds.has(tenantBId)).toBe(false);

    const groupsRes = await request(app).get(`/admin/v1/groups?tenantId=${tenantAId}`).set(headers);
    expect(groupsRes.status).toBe(200);
    const groupTenantIds = new Set(groupsRes.body.items.map((item: any) => item.tenantId));
    expect(groupTenantIds.has(tenantAId)).toBe(true);
    expect(groupTenantIds.has(tenantBId)).toBe(false);
  });

  it('owner sees only their tenant users', async () => {
    const headers = authHeader(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get(`/admin/v1/users?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: any) => item.tenantId === tenantAId)).toBe(true);
  });

  it('admin sees only their tenant users', async () => {
    const headers = authHeader(adminAId, tenantAId, adminAEmail);
    const res = await request(app).get(`/admin/v1/users?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: any) => item.tenantId === tenantAId)).toBe(true);
  });

  it('owner dashboard is tenant scoped', async () => {
    const headers = authHeader(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get(`/admin/v1/dashboard?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.totals.tenants).toBe(1);
    expect(res.body.recentTenants.every((item: any) => item.id === tenantAId)).toBe(true);
  });

  it('admin dashboard is tenant scoped', async () => {
    const headers = authHeader(adminAId, tenantAId, adminAEmail);
    const res = await request(app).get(`/admin/v1/dashboard?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.totals.tenants).toBe(1);
    expect(res.body.recentTenants.every((item: any) => item.id === tenantAId)).toBe(true);
  });

  it('owner analytics hides cross-tenant counts at API level', async () => {
    const headers = authHeader(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get(`/admin/v1/analytics/platform?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toBe(1);
    expect(res.body.activeUsers).toBe(3);
    expect(res.body.projects).toBe(1);
    expect(res.body.tasks).toBe(2);
  });

  it('admin analytics is tenant scoped', async () => {
    const headers = authHeader(adminAId, tenantAId, adminAEmail);
    const res = await request(app).get(`/admin/v1/analytics/platform?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.tenants).toBe(1);
    expect(res.body.activeUsers).toBe(3);
    expect(res.body.projects).toBe(1);
    expect(res.body.tasks).toBe(2);
  });

  it('owner infrastructure workload is tenant scoped', async () => {
    const headers = authHeader(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get(`/admin/v1/infrastructure/services?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.stats.projects).toBe(1);
    expect(res.body.stats.tasks).toBe(2);
    expect(res.body.stats.activeUsers).toBe(3);
  });

  it('admin infrastructure workload is tenant scoped', async () => {
    const headers = authHeader(adminAId, tenantAId, adminAEmail);
    const res = await request(app).get(`/admin/v1/infrastructure/services?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.stats.projects).toBe(1);
    expect(res.body.stats.tasks).toBe(2);
    expect(res.body.stats.activeUsers).toBe(3);
  });

  it('owner audit logs are tenant scoped', async () => {
    const headers = authHeader(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get(`/admin/v1/audit?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: any) => item.action !== 'admin.scope.test.b')).toBe(true);
  });

  it('admin audit logs are tenant scoped', async () => {
    const headers = authHeader(adminAId, tenantAId, adminAEmail);
    const res = await request(app).get(`/admin/v1/audit?tenantId=${tenantAId}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: any) => item.action !== 'admin.scope.test.b')).toBe(true);
  });

  it('returns 400 when tenantId filter is missing', async () => {
    const token = AuthService.generateAccessToken(ownerAId, tenantAId, ownerAEmail);
    const res = await request(app).get('/admin/v1/users').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tenantId is required');
  });
});
