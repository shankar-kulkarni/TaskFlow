import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import tenantRoutes from '../src/routes/tenants';
import { prisma } from '../src/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/tenants', tenantRoutes);

describe('Tenant Preferences Routes', () => {
  const tenantId = 'tenant-uuid';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "tenant_preferences" (
        "tenant_id" TEXT PRIMARY KEY,
        "locale" TEXT NOT NULL DEFAULT 'en',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: 'Test Tenant' },
      create: {
        id: tenantId,
        name: 'Test Tenant'
      }
    });
  });

  afterAll(async () => {
    await prisma.tenantPreferences.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  });

  it('should create default preferences on get', async () => {
    const response = await request(app)
      .get('/api/v1/tenants/preferences')
      .set('X-Tenant-ID', tenantId);

    expect(response.status).toBe(200);
    expect(response.body.tenantId).toBe(tenantId);
    expect(response.body.locale).toBe('en');
  });

  it('should update tenant locale preference', async () => {
    const updateResponse = await request(app)
      .put('/api/v1/tenants/preferences')
      .set('X-Tenant-ID', tenantId)
      .send({ locale: 'es' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.locale).toBe('es');

    const getResponse = await request(app)
      .get('/api/v1/tenants/preferences')
      .set('X-Tenant-ID', tenantId);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.locale).toBe('es');
  });
});
