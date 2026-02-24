import { Router } from 'express';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { assignmentSchemas, assigneeSchemas } from '../validation/schemas';
import { strictAssignmentSchemas, strictAssigneeSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req) as string;

// PUT /api/v1/tasks/:taskId/assignments - Replace all assignments
router.put(
  '/:taskId/assignments',
  requireAuth,
  validateByMode(
    { params: assignmentSchemas.params.taskId, body: assignmentSchemas.body },
    { params: strictAssignmentSchemas.params.taskId, body: strictAssignmentSchemas.body },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { user_ids = [], group_ids = [] } = req.body;
    const taskId = String(req.params.taskId);
    const assignedBy = (req as any).userId;

    // Verify task exists and belongs to tenant
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Delete existing assignments
    await prisma.taskUserAssignment.deleteMany({ where: { taskId } });
    await prisma.taskGroupAssignment.deleteMany({ where: { taskId } });

    // Create new assignments
    const userAssignments = user_ids.map((userId: string) => ({
      taskId,
      userId,
      assignedBy
    }));

    const groupAssignments = group_ids.map((groupId: string) => ({
      taskId,
      groupId,
      assignedBy
    }));

    await prisma.taskUserAssignment.createMany({ data: userAssignments });
    await prisma.taskGroupAssignment.createMany({ data: groupAssignments });

    // Fetch updated assignments
    const updatedUserAssignments = await prisma.taskUserAssignment.findMany({
      where: { taskId },
      include: { user: true }
    });

    const updatedGroupAssignments = await prisma.taskGroupAssignment.findMany({
      where: { taskId },
      include: { 
        group: {
          include: { members: true }
        }
      }
    });

    res.json({
      task_id: taskId,
      user_assignments: updatedUserAssignments.map(ua => ({
        user_id: ua.userId,
        display_name: ua.user.displayName,
        assigned_at: ua.assignedAt
      })),
      group_assignments: updatedGroupAssignments.map(ga => ({
        group_id: ga.groupId,
        name: ga.group.name,
        member_count: ga.group.members.length,
        assigned_at: ga.assignedAt
      })),
      effective_assignee_count: new Set([
        ...updatedUserAssignments.map(ua => ua.userId),
        ...updatedGroupAssignments.flatMap(ga => ga.group.members.map(member => member.userId))
      ]).size
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignments' });
  }
  },
);

// POST /api/v1/tasks/:taskId/assignments - Add assignments
router.post(
  '/:taskId/assignments',
  requireAuth,
  validateByMode(
    { params: assignmentSchemas.params.taskId, body: assignmentSchemas.body },
    { params: strictAssignmentSchemas.params.taskId, body: strictAssignmentSchemas.body },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { user_ids = [], group_ids = [] } = req.body;
    const taskId = String(req.params.taskId);
    const assignedBy = (req as any).userId;

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Add new assignments, ignore duplicates
    if (user_ids.length > 0) {
      await prisma.taskUserAssignment.createMany({
        data: user_ids.map((userId: string) => ({ taskId, userId, assignedBy })),
        skipDuplicates: true
      });
    }

    if (group_ids.length > 0) {
      await prisma.taskGroupAssignment.createMany({
        data: group_ids.map((groupId: string) => ({ taskId, groupId, assignedBy })),
        skipDuplicates: true
      });
    }

    // Return current assignments
    const userAssignments = await prisma.taskUserAssignment.findMany({
      where: { taskId },
      include: { user: true }
    });

    const groupAssignments = await prisma.taskGroupAssignment.findMany({
      where: { taskId },
      include: { 
        group: {
          include: { members: true }
        }
      }
    });

    res.json({
      task_id: taskId,
      user_assignments: userAssignments.map(ua => ({
        user_id: ua.userId,
        display_name: ua.user.displayName,
        assigned_at: ua.assignedAt
      })),
      group_assignments: groupAssignments.map(ga => ({
        group_id: ga.groupId,
        name: ga.group.name,
        member_count: ga.group.members.length,
        assigned_at: ga.assignedAt
      })),
      effective_assignee_count: new Set([
        ...userAssignments.map(ua => ua.userId),
        ...groupAssignments.flatMap(ga => ga.group.members.map(member => member.userId))
      ]).size
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add assignments' });
  }
  },
);

// DELETE /api/v1/tasks/:taskId/assignments - Remove assignments
router.delete(
  '/:taskId/assignments',
  requireAuth,
  validateByMode(
    { params: assignmentSchemas.params.taskId, body: assignmentSchemas.body },
    { params: strictAssignmentSchemas.params.taskId, body: strictAssignmentSchemas.body },
  ),
  async (req, res) => {
  try {
    const { user_ids = [], group_ids = [] } = req.body;
    const taskId = String(req.params.taskId);

    if (user_ids.length > 0) {
      await prisma.taskUserAssignment.deleteMany({
        where: {
          taskId,
          userId: { in: user_ids }
        }
      });
    }

    if (group_ids.length > 0) {
      await prisma.taskGroupAssignment.deleteMany({
        where: {
          taskId,
          groupId: { in: group_ids }
        }
      });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove assignments' });
  }
  },
);

// GET /api/v1/tasks/:taskId/assignees - Get effective assignees
router.get(
  '/:taskId/assignees',
  requireAuth,
  validateByMode(
    { params: assigneeSchemas.params.taskId },
    { params: strictAssigneeSchemas.params.taskId },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = String(req.params.taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Get direct user assignments
    const userAssignments = await prisma.taskUserAssignment.findMany({
      where: { taskId },
      include: { user: true }
    });

    // Get group assignments and their members
    const groupAssignments = await prisma.taskGroupAssignment.findMany({
      where: { taskId },
      include: {
        group: {
          include: { members: { include: { user: true } } }
        }
      }
    });

    const assignees: any[] = [];

    // Add direct users
    userAssignments.forEach(ua => {
      assignees.push({
        user_id: ua.userId,
        display_name: ua.user.displayName,
        avatar_url: ua.user.avatarUrl,
        assignment_type: 'direct',
        via_groups: []
      });
    });

    // Add group members
    groupAssignments.forEach(ga => {
      ga.group.members.forEach(member => {
        const existing = assignees.find(a => a.user_id === member.userId);
        if (existing) {
          existing.via_groups.push({
            group_id: ga.groupId,
            name: ga.group.name
          });
        } else {
          assignees.push({
            user_id: member.userId,
            display_name: member.user.displayName,
            avatar_url: member.user.avatarUrl,
            assignment_type: 'group',
            via_groups: [{ group_id: ga.groupId, name: ga.group.name }]
          });
        }
      });
    });

    res.json({
      task_id: taskId,
      assignees
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignees' });
  }
  },
);

export default router;