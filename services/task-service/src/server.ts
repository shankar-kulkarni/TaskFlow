import express from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { prisma } from './prisma';
import taskRoutes from './routes/tasks';
import assignmentRoutes from './routes/assignments';
import commentRoutes from './routes/comments';
import projectRoutes from './routes/projects';
import calendarRoutes from './routes/calendar';
import timelineRoutes from './routes/timeline';
import myTasksRoutes from './routes/my-tasks';
import analyticsRoutes from './routes/analytics';
import workflowRoutes from './routes/workflows';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notifications';
import searchRoutes from './routes/search';
import auditRoutes from './routes/audit';
import groupRoutes from './routes/groups';
import watcherRoutes from './routes/watchers';
import accountRoutes from './routes/account';
import userRoutes from './routes/users';
import tenantRoutes from './routes/tenants';
import adminRoutes from './routes/admin';
import featureFlagsRoutes from './routes/feature-flags';

const app = express();
const PORT = process.env.PORT || 3000;
const BUILD_MARKER = 'redoc-route-enabled-2026-02-15';

// Middleware
app.use(express.json());

// Static docs
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// OpenAPI spec
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const openApiRaw = fs.readFileSync(openApiPath, 'utf8');
const openApiDocument = yaml.parse(openApiRaw);

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin as string);
  res.header('Vary', 'Origin');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, X-Tenant-ID, Authorization, X-MFA-Token'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/tasks', assignmentRoutes); // assignments under tasks
app.use('/api/v1/tasks', commentRoutes);
app.use('/api/v1/tasks', watcherRoutes); // watchers under tasks
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/timeline', timelineRoutes);
app.use('/api/v1/my-tasks', myTasksRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/feature-flags', featureFlagsRoutes);
app.use('/admin/v1', adminRoutes);

// ReDoc
app.get('/redoc', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'redoc.html'));
});
app.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(openApiRaw);
});

// Diagnostics
app.get('/_diag/version', (_req, res) => {
  res.json({ marker: BUILD_MARKER });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Task Service API', version: 'v1', health: '/health', docs: '/api/v1/tasks' });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ test: 'ok', timestamp: new Date().toISOString() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Extended health check with route availability
app.get('/health/routes', (req, res) => {
  res.json({
    status: 'ok',
    routes: {
      auth: '/api/v1/auth',
      account: '/api/v1/account',
      tasks: '/api/v1/tasks',
      projects: '/api/v1/projects',
      notifications: '/api/v1/notifications',
      search: '/api/v1/search',
      audit: '/api/v1/audit-logs'
    }
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Task Service listening on port ${PORT}`);
});

export { prisma };