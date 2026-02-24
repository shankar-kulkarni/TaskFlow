import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import taskRoutes from '../src/routes/tasks';
import { prisma } from '../src/prisma';
import { AuthService } from '../src/services/auth.service';

const app = express();
const tenantId = 'tenant-uuid-tasks';
const userId = 'user-uuid-tasks';
const userEmail = 'test@example.com';
app.use(express.json());

// Mock tenant middleware
app.use((req: any, res, next) => {
  req.headers['x-tenant-id'] = tenantId;
  next();
});

app.use('/api/v1/tasks', taskRoutes);

const getAuthHeader = () => {
  const token = AuthService.generateAccessToken(userId, tenantId, userEmail);
  return `Bearer ${token}`;
};

describe('Task Routes', () => {
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

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        tenantId,
        email: userEmail,
        displayName: 'Test User',
        role: 'ADMIN'
      },
      create: {
        id: userId,
        tenantId,
        email: userEmail,
        displayName: 'Test User',
        role: 'ADMIN'
      }
    });
  });

  afterAll(async () => {
    // Clean up
    const tenantTaskIds = (
      await prisma.task.findMany({ where: { tenantId }, select: { id: true } })
    ).map((task) => task.id);

    if (tenantTaskIds.length > 0) {
      await prisma.taskUserAssignment.deleteMany({ where: { taskId: { in: tenantTaskIds } } });
      await prisma.taskGroupAssignment.deleteMany({ where: { taskId: { in: tenantTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: tenantTaskIds } } });
    }

    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('should create a task', async () => {
    const response = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', getAuthHeader())
      .send({
        title: 'Test Task',
        description: 'A test task',
        status: 'TODO',
        priority: 'HIGH'
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Test Task');
    expect(response.body.status).toBe('TODO');
  });

  it('should auto-assign creator when no assignees are provided', async () => {
    const response = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', getAuthHeader())
      .send({
        title: 'Auto Assignment Task',
        status: 'TODO',
        priority: 'MEDIUM'
      });

    expect(response.status).toBe(201);
    expect(Array.isArray(response.body.userAssignments)).toBe(true);
    expect(response.body.userAssignments.length).toBe(1);
    expect(response.body.userAssignments[0].userId).toBe(userId);
  });

  it('should list tasks', async () => {
    const response = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', getAuthHeader());

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should get task by id', async () => {
    // First create a task
    const createResponse = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', getAuthHeader())
      .send({
        title: 'Get Task Test',
        description: 'Test getting task by id'
      });

    const taskId = createResponse.body.id;

    const response = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', getAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(taskId);
    expect(response.body.title).toBe('Get Task Test');
  });

  it('should update a task', async () => {
    // Create a task
    const createResponse = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', getAuthHeader())
      .send({
        title: 'Update Task Test',
        status: 'TODO'
      });

    const taskId = createResponse.body.id;

    const response = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', getAuthHeader())
      .send({
        status: 'IN_PROGRESS'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('IN_PROGRESS');
  });

  it('should archive a task', async () => {
    // Create a task
    const createResponse = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', getAuthHeader())
      .send({
        title: 'Archive Task Test'
      });

    const taskId = createResponse.body.id;

    const response = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Authorization', getAuthHeader());

    expect(response.status).toBe(204);

    // Verify archived
    const getResponse = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', getAuthHeader());

    expect(getResponse.status).toBe(404);
  });
});