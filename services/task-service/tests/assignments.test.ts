import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import assignmentRoutes from '../src/routes/assignments';
import { prisma } from '../src/prisma';
import { AuthService } from '../src/services/auth.service';

const app = express();
const tenantId = 'tenant-uuid-assignments';
const baseUserId = 'user-uuid-assignments';
const userEmail = 'test-assignments@example.com';
app.use(express.json());

// Mock tenant middleware
app.use((req: any, res, next) => {
  req.headers['x-tenant-id'] = tenantId;
  next();
});

app.use('/api/v1/tasks', assignmentRoutes);

const getAuthHeader = (userId: string) => {
  const token = AuthService.generateAccessToken(userId, tenantId, userEmail);
  return `Bearer ${token}`;
};

describe('Assignment Routes', () => {
  let taskId: string;
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    // Create test data
    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: 'Test Tenant' },
      create: {
        id: tenantId,
        name: 'Test Tenant'
      }
    });

    const user = await prisma.user.upsert({
      where: { id: baseUserId },
      update: {
        tenantId,
        email: userEmail,
        displayName: 'Test User'
      },
      create: {
        id: baseUserId,
        tenantId,
        email: userEmail,
        displayName: 'Test User'
      }
    });
    userId = user.id;

    const group = await prisma.group.upsert({
      where: { id: 'group-uuid' },
      update: {
        tenantId,
        name: 'Test Group',
        createdBy: userId
      },
      create: {
        id: 'group-uuid',
        tenantId,
        name: 'Test Group',
        createdBy: userId
      }
    });
    groupId = group.id;

    // Add user to group
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: { addedBy: userId },
      create: {
        groupId,
        userId,
        addedBy: userId
      }
    });

    const task = await prisma.task.upsert({
      where: { id: 'task-uuid' },
      update: {
        tenantId,
        title: 'Test Task',
        createdBy: userId
      },
      create: {
        id: 'task-uuid',
        tenantId,
        title: 'Test Task',
        createdBy: userId
      }
    });
    taskId = task.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.taskUserAssignment.deleteMany({ where: { taskId } });
    await prisma.taskGroupAssignment.deleteMany({ where: { taskId } });
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
    await prisma.user.deleteMany({ where: { id: baseUserId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('should assign users and groups to a task', async () => {
    const response = await request(app)
      .put(`/api/v1/tasks/${taskId}/assignments`)
      .set('Authorization', getAuthHeader(userId))
      .send({
        user_ids: [userId],
        group_ids: [groupId]
      });

    expect(response.status).toBe(200);
    expect(response.body.task_id).toBe(taskId);
    expect(response.body.user_assignments).toHaveLength(1);
    expect(response.body.group_assignments).toHaveLength(1);
    expect(response.body.effective_assignee_count).toBe(1); // User is in group, but counted once
  });

  it('should get effective assignees', async () => {
    const response = await request(app)
      .get(`/api/v1/tasks/${taskId}/assignees`)
      .set('Authorization', getAuthHeader(userId));

    expect(response.status).toBe(200);
    expect(response.body.task_id).toBe(taskId);
    expect(response.body.assignees).toHaveLength(1);
    expect(response.body.assignees[0].user_id).toBe(userId);
    expect(response.body.assignees[0].assignment_type).toBe('direct');
  });

  it('should remove assignments', async () => {
    const response = await request(app)
      .delete(`/api/v1/tasks/${taskId}/assignments`)
      .set('Authorization', getAuthHeader(userId))
      .send({
        user_ids: [userId]
      });

    expect(response.status).toBe(204);

    // Verify removed
    const getResponse = await request(app)
      .get(`/api/v1/tasks/${taskId}/assignees`)
      .set('Authorization', getAuthHeader(userId));

    expect(getResponse.body.assignees).toHaveLength(1); // Still assigned via group
    expect(getResponse.body.assignees[0].assignment_type).toBe('group');
  });
});