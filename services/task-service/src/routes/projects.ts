import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { ProjectStatus } from '@prisma/client';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { projectSchemas } from '../validation/schemas';
import { strictProjectSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/projects - List projects
router.get(
  '/',
  requireAuth,
  validateByMode({ query: projectSchemas.query }, { query: strictProjectSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id } = req.query;

    const where: any = { workspace: { tenantId } };
    if (workspace_id) where.workspaceId = workspace_id;

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: { select: { tasks: true } },
        owner: true
      }
    });

    const projectsWithCounts = projects.map(p => ({
      ...p,
      task_count: p._count.tasks
    }));

    res.json(projectsWithCounts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
  },
);

// POST /api/v1/projects - Create project
router.post(
  '/',
  requireAuth,
  requirePermission('projects:manage'),
  validateByMode({ body: projectSchemas.body }, { body: strictProjectSchemas.body }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, name, description, color, icon, owner_id, start_date, end_date } = req.body;
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace_id,
        name,
        description,
        color,
        icon,
        status: ProjectStatus.ACTIVE,
        ownerId: owner_id,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null
      },
      include: { owner: true }
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' });
  }
  },
);

// GET /api/v1/projects/:id - Get project
router.get(
  '/:id',
  requireAuth,
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspace: { tenantId } },
      include: {
        owner: true,
        _count: { select: { tasks: true } }
      }
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({
      ...project,
      task_count: project._count.tasks
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
  },
);

// PATCH /api/v1/projects/:id - Update project
router.patch(
  '/:id',
  requireAuth,
  requirePermission('projects:manage'),
  validateByMode(
    { params: projectSchemas.params.id, body: projectSchemas.body },
    { params: strictProjectSchemas.params.id, body: strictProjectSchemas.body },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const updates = req.body;

    if (updates.start_date) updates.startDate = new Date(updates.start_date);
    if (updates.end_date) updates.endDate = new Date(updates.end_date);

    const project = await prisma.project.update({
      where: { id: projectId, workspace: { tenantId } },
      data: updates,
      include: { owner: true }
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
  },
);

// DELETE /api/v1/projects/:id - Archive project
router.delete(
  '/:id',
  requireAuth,
  requirePermission('projects:manage'),
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    await prisma.project.update({
      where: { id: projectId, workspace: { tenantId } },
      data: { status: ProjectStatus.ARCHIVED }
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive project' });
  }
  },
);

// GET /api/v1/projects/:id/tasks - Tasks in project
router.get(
  '/:id/tasks',
  requireAuth,
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspace: { tenantId } }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const tasks = await prisma.task.findMany({
      where: { projectId, tenantId },
      include: {
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } }
      }
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project tasks' });
  }
  },
);

// GET /api/v1/projects/:id/members - Project members
router.get(
  '/:id/members',
  requireAuth,
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspace: { tenantId } }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true }
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
  },
);

// POST /api/v1/projects/:id/members - Add member
router.post(
  '/:id/members',
  requireAuth,
  requirePermission('users:manage'),
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const { user_id, role } = req.body;
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspace: { tenantId } }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user_id,
        role
      },
      include: { user: true }
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add project member' });
  }
  },
);

// GET /api/v1/projects/:id/health - Health score
router.get(
  '/:id/health',
  requireAuth,
  validateByMode({ params: projectSchemas.params.id }, { params: strictProjectSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const projectId = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspace: { tenantId } }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Calculate health score (simplified)
    const tasks = await prisma.task.findMany({
      where: { projectId, tenantId }
    });

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date() && t.status !== 'DONE').length;
    const blocked = tasks.filter(t => t.status === 'BLOCKED').length;

    const overdueRatio = overdue / Math.max(total, 1);
    const blockedRatio = blocked / Math.max(total, 1);
    const progress = done / Math.max(total, 1);

    const score = Math.round((1 - overdueRatio) * 40 + (1 - blockedRatio) * 20 + progress * 40);
    const status = score >= 75 ? 'on_track' : score >= 45 ? 'at_risk' : 'off_track';

    res.json({ score, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
  },
);

// Seed default project if none exists
router.post('/seed-default', requireAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });

    // Check if any workspace exists for this tenant, create one if not
    let workspace = await prisma.workspace.findFirst({
      where: { tenantId }
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          tenantId,
          name: 'Default Workspace'
        }
      });
    }

    // Check if any project exists in this workspace
    const existingProject = await prisma.project.findFirst({
      where: { workspaceId: workspace.id }
    });

    if (existingProject) {
      return res.json({ project: existingProject, message: 'Default project already exists' });
    }

    // Create default project
    const defaultProject = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Default Project',
        description: 'Default project for tasks',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      }
    });

    res.status(201).json({ project: defaultProject, message: 'Default project created' });
  } catch (error) {
    console.error('Seed default project error:', error);
    res.status(500).json({ error: 'Failed to seed default project' });
  }
});

export default router;
