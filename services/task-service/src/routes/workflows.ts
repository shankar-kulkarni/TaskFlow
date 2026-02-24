import { Router } from 'express';
import { prisma } from '../prisma';
import { TriggerType, ActionType } from '@prisma/client';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { workflowSchemas } from '../validation/schemas';
import { strictWorkflowSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/workflows - List workflows
router.get(
  '/',
  requireAuth,
  validateByMode({ query: workflowSchemas.query }, { query: strictWorkflowSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, project_id } = req.query;

    const where: any = { workspace: { tenantId } };
    if (project_id) where.projectId = project_id;

    const workflows = await prisma.workflow.findMany({
      where,
      include: { actions: true, runs: { take: 5, orderBy: { startedAt: 'desc' } } }
    });

    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
  },
);

// POST /api/v1/workflows - Create workflow
router.post(
  '/',
  requireAuth,
  validateByMode({ body: workflowSchemas.body }, { body: strictWorkflowSchemas.body }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { workspace_id, project_id, name, description, trigger_type, trigger_config, actions = [] } = req.body;
    const createdBy = (req as any).userId;

    let workspaceId = workspace_id as string | undefined;
    if (!workspaceId && project_id) {
      const project = await prisma.project.findFirst({
        where: {
          id: project_id,
          workspace: { tenantId },
        },
        select: { workspaceId: true },
      });
      workspaceId = project?.workspaceId;
    }
    if (!workspaceId) {
      const workspace = await prisma.workspace.findFirst({
        where: { tenantId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      workspaceId = workspace?.id;
    }
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace is required to create workflow' });
    }

    const workflow = await prisma.workflow.create({
      data: {
        workspaceId,
        projectId: project_id,
        name,
        description,
        triggerType: trigger_type,
        triggerConfig: trigger_config,
        createdBy,
        actions: { create: actions.map((a: any) => ({
          actionOrder: a.action_order,
          actionType: a.action_type,
          actionConfig: a.action_config
        })) }
      },
      include: { actions: true }
    });

    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create workflow' });
  }
  },
);

// PATCH /api/v1/workflows/:id - Update workflow
router.patch(
  '/:id',
  requireAuth,
  validateByMode(
    { params: workflowSchemas.params.id, body: workflowSchemas.body },
    { params: strictWorkflowSchemas.params.id, body: strictWorkflowSchemas.body },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = String(req.params.id);
    const updates = req.body as any;
    const existing = await prisma.workflow.findFirst({
      where: { id: workflowId, workspace: { tenantId } },
    });
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });

    const { actions, ...rest } = updates;
    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: rest,
      include: { actions: true }
    });

    if (Array.isArray(actions)) {
      await prisma.workflowAction.deleteMany({ where: { workflowId } });
      if (actions.length > 0) {
        await prisma.workflowAction.createMany({
          data: actions.map((a: any) => ({
            workflowId,
            actionOrder: a.actionOrder ?? a.action_order ?? 1,
            actionType: a.actionType ?? a.action_type,
            actionConfig: a.actionConfig ?? a.action_config ?? {},
          })),
        });
      }
    }

    const refreshed = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      include: { actions: true }
    });
    res.json(refreshed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update workflow' });
  }
  },
);

// DELETE /api/v1/workflows/:id - Delete workflow
router.delete(
  '/:id',
  requireAuth,
  validateByMode({ params: workflowSchemas.params.id }, { params: strictWorkflowSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = String(req.params.id);
    const existing = await prisma.workflow.findFirst({
      where: { id: workflowId, workspace: { tenantId } }
    });
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });

    await prisma.workflow.delete({ where: { id: workflowId } });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
  },
);

// POST /api/v1/workflows/:id/toggle - Enable/disable
router.post(
  '/:id/toggle',
  requireAuth,
  validateByMode({ params: workflowSchemas.params.id }, { params: strictWorkflowSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = String(req.params.id);
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, workspace: { tenantId } }
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: { isActive: !workflow.isActive }
    });

    res.json({ is_active: updated.isActive });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle workflow' });
  }
  },
);

// GET /api/v1/workflows/:id/runs - Run history
router.get(
  '/:id/runs',
  requireAuth,
  validateByMode({ params: workflowSchemas.params.id }, { params: strictWorkflowSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const workflowId = String(req.params.id);
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, workspace: { tenantId } }
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    const runs = await prisma.workflowRun.findMany({
      where: { workflowId },
      include: { task: true, triggerUser: true },
      orderBy: { startedAt: 'desc' }
    });

    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflow runs' });
  }
  },
);

export default router;
