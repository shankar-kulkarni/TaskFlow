import { Router } from 'express';
import { prisma } from '../prisma';
import { TaskStatus, Priority, TriggerType } from '@prisma/client';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { taskSchemas } from '../validation/schemas';
import { strictTaskSchemas } from '../validation/schemas.strict';
import { runWorkflowsForTask } from '../services/workflow-engine';
import { syncTaskEmbedding } from '../services/aiGateway';

const router = Router();

// Helper to convert Decimal to number
const serializeTask = (task: any) => {
  if (!task) return task;
  return {
    ...task,
    estimatedHrs: task.estimatedHrs ? parseFloat(task.estimatedHrs) : null,
    actualHrs: task.actualHrs ? parseFloat(task.actualHrs) : null,
  };
};

const getTenantId = (req: any) => resolveTenantId(req) as string;

// GET /api/v1/tasks - List tasks with filters
router.get(
  '/',
  requireAuth,
  requirePermission('tasks:read:own'),
  validateByMode({ query: taskSchemas.query }, { query: strictTaskSchemas.query }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).userId as string | undefined;
    const userRole = (req as any).user?.role as string | undefined;
    const hasAnyScope = userRole === 'ADMIN' || userRole === 'OWNER';
    const {
      project_id,
      assigned_to_user,
      assigned_to_group,
      status,
      priority,
      due_before,
      sort = 'created_at:desc',
      page = '1',
      page_size = '25'
    } = req.query;

    const where: any = { tenantId, isArchived: false };

    if (!hasAnyScope && userId) {
      where.OR = [
        {
          userAssignments: {
            some: { userId }
          }
        },
        {
          groupAssignments: {
            some: { group: { members: { some: { userId } } } }
          }
        }
      ];
    }

    if (project_id) where.projectId = project_id;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (due_before) where.dueDate = { lte: new Date(due_before as string) };

    // Handle assignments
    if (assigned_to_user || assigned_to_group) {
      const assignmentFilters: any[] = [];
      if (assigned_to_user) {
        assignmentFilters.push({
          userAssignments: {
            some: { userId: assigned_to_user }
          }
        });
      }
      if (assigned_to_group) {
        assignmentFilters.push({
          groupAssignments: {
            some: { groupId: assigned_to_group }
          }
        });
      }

      if (assignmentFilters.length > 0) {
        if (Array.isArray(where.OR) && where.OR.length > 0) {
          where.AND = (where.AND || []).concat({ OR: assignmentFilters });
        } else {
          where.OR = assignmentFilters;
        }
      }
    }

    const orderBy: any = {};
    const [sortField, sortOrder] = (sort as string).split(':');
    
    // Map API field names to Prisma field names
    const fieldMapping: { [key: string]: string } = {
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'due_date': 'dueDate',
      'start_date': 'startDate',
      'estimated_hrs': 'estimatedHrs',
      'actual_hrs': 'actualHrs',
      'completed_at': 'completedAt',
      'is_archived': 'isArchived',
      'custom_fields': 'customFields',
      // Add other mappings as needed
    };
    
    const prismaField = fieldMapping[sortField] || sortField;
    orderBy[prismaField] = sortOrder;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: true,
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } },
        creator: true
      },
      orderBy,
      skip: (parseInt(page as string) - 1) * parseInt(page_size as string),
      take: parseInt(page_size as string)
    });

    res.json(tasks.map(serializeTask));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
  },
);

// POST /api/v1/tasks - Create a new task
router.post(
  '/',
  requireAuth,
  requirePermission('tasks:write:own'),
  validateByMode({ body: taskSchemas.body }, { body: strictTaskSchemas.body }),
  async (req, res) => {
  try {
    console.log('📨 Received POST /tasks:', JSON.stringify(req.body, null, 2));
    
    const tenantId = getTenantId(req);
    console.log('👤 Tenant ID:', tenantId);

    const {
      project_id,
      title,
      description,
      status,
      priority,
      start_date,
      due_date,
      estimated_hrs,
      assign_to,
      watcher_ids = []
    } = req.body;

    const assignedUserIds: string[] = Array.isArray(assign_to?.user_ids)
      ? assign_to.user_ids.filter((userId: unknown): userId is string => typeof userId === 'string' && userId.length > 0)
      : [];
    const assignedGroupIds: string[] = Array.isArray(assign_to?.group_ids)
      ? assign_to.group_ids.filter((groupId: unknown): groupId is string => typeof groupId === 'string' && groupId.length > 0)
      : [];

    console.log('📝 Parsed fields:', { project_id, title, status, priority });

    // Validate required fields
    if (!title) {
      console.log('❌ Title is missing');
      return res.status(400).json({ error: 'Title is required' });
    }

    const createdBy = (req as any).userId;
    if (!createdBy) {
      return res.status(400).json({ error: 'Missing task creator' });
    }
    const shouldAutoAssignCreator = assignedUserIds.length === 0 && assignedGroupIds.length === 0;
    const finalAssignedUserIds = shouldAutoAssignCreator ? [createdBy] : assignedUserIds;
    console.log('👨 Created by:', createdBy);

    console.log('🔄 Creating task with data...');
    const task = await prisma.task.create({
      data: {
        tenantId,
        projectId: project_id || null,
        title,
        description: description || null,
        status: status || 'TODO',
        priority: priority || 'NONE',
        startDate: start_date ? new Date(start_date) : null,
        dueDate: due_date ? new Date(due_date) : null,
        estimatedHrs: estimated_hrs ? parseFloat(estimated_hrs) : null,
        createdBy,
        userAssignments: finalAssignedUserIds.length > 0 ? {
          create: finalAssignedUserIds.map((userId: string) => ({
            userId,
            assignedBy: createdBy
          }))
        } : undefined,
        groupAssignments: assignedGroupIds.length > 0 ? {
          create: assignedGroupIds.map((groupId: string) => ({
            groupId,
            assignedBy: createdBy
          }))
        } : undefined,
        watchers: watcher_ids && watcher_ids.length > 0 ? {
          create: watcher_ids.map((userId: string) => ({ userId }))
        } : undefined
      },
      include: {
        project: true,
        creator: true,
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } }
      }
    });

    console.log('✅ Task created successfully:', task.id);
    void syncTaskEmbedding({
      taskId: task.id,
      tenantId,
      authorization: req.header('authorization') ?? undefined,
    });
    await runWorkflowsForTask({
      tenantId,
      taskId: task.id,
      triggerType: TriggerType.TASK_CREATED,
      triggeredBy: createdBy,
    });
    res.status(201).json(serializeTask(task));
  } catch (error: any) {
    console.error('❌ Task creation error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error meta:', error.meta);
    console.error('Full error:', JSON.stringify(error, null, 2));
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create task', 
      details: error.message,
      code: error.code,
      meta: error.meta
    });
  }
  },
);

// GET /api/v1/tasks/:id - Get task detail
router.get(
  '/:id',
  requireAuth,
  requirePermission('tasks:read:own'),
  validateByMode({ params: taskSchemas.params.id }, { params: strictTaskSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).userId as string | undefined;
    const userRole = (req as any).user?.role as string | undefined;
    const hasAnyScope = userRole === 'ADMIN' || userRole === 'OWNER';
    const taskId = String(req.params.id);
    const where: any = { id: taskId, tenantId, isArchived: false };

    if (!hasAnyScope && userId) {
      where.OR = [
        {
          userAssignments: {
            some: { userId }
          }
        },
        {
          groupAssignments: {
            some: { group: { members: { some: { userId } } } }
          }
        }
      ];
    }

    const task = await prisma.task.findFirst({
      where,
      include: {
        project: true,
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } },
        watchers: { include: { user: true } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        creator: true
      }
    });

    if (!task) return res.status(404).json({ error: 'Task not found' });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
  },
);

// PATCH /api/v1/tasks/:id - Update task
router.patch(
  '/:id',
  requireAuth,
  requirePermission('tasks:write:own'),
  validateByMode(
    { params: taskSchemas.params.id, body: taskSchemas.body },
    { params: strictTaskSchemas.params.id, body: strictTaskSchemas.body },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).userId as string | undefined;
    const userRole = (req as any).user?.role as string | undefined;
    const hasAnyScope = userRole === 'ADMIN' || userRole === 'OWNER';
    const taskId = String(req.params.id);
    
    const accessWhere: any = { id: taskId, tenantId };
    if (!hasAnyScope && userId) {
      accessWhere.OR = [
        { createdBy: userId },
        { userAssignments: { some: { userId } } },
        { groupAssignments: { some: { group: { members: { some: { userId } } } } } },
      ];
    }

    const existingTask = await prisma.task.findFirst({ where: accessWhere });
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or forbidden' });
    }

    const updates: any = { ...req.body };

    // Convert date strings to Date objects
    if (updates.start_date) updates.startDate = new Date(updates.start_date);
    if (updates.due_date) updates.dueDate = new Date(updates.due_date);
    if (updates.status === 'DONE') updates.completedAt = new Date();

    // Map snake_case to camelCase
    if (updates.project_id) updates.projectId = updates.project_id;
    if (updates.estimated_hrs !== undefined) updates.estimatedHrs = updates.estimated_hrs;

    // Remove snake_case versions
    delete updates.start_date;
    delete updates.due_date;
    delete updates.project_id;
    delete updates.estimated_hrs;

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updates,
      include: {
        project: true,
        creator: true,
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } }
      }
    });

    if (existingTask.status !== task.status) {
      await runWorkflowsForTask({
        tenantId,
        taskId: task.id,
        triggerType: TriggerType.TASK_STATUS_CHANGED,
        triggeredBy: userId,
        beforeTask: existingTask as any,
      });
    }

    if (existingTask.priority !== task.priority) {
      await runWorkflowsForTask({
        tenantId,
        taskId: task.id,
        triggerType: TriggerType.TASK_PRIORITY_CHANGED,
        triggeredBy: userId,
        beforeTask: existingTask as any,
      });
    }

    if (existingTask.dueDate?.toISOString() !== task.dueDate?.toISOString()) {
      await runWorkflowsForTask({
        tenantId,
        taskId: task.id,
        triggerType: TriggerType.TASK_DUE_DATE_APPROACHING,
        triggeredBy: userId,
        beforeTask: existingTask as any,
      });

      if (task.dueDate && task.dueDate.getTime() < Date.now()) {
        await runWorkflowsForTask({
          tenantId,
          taskId: task.id,
          triggerType: TriggerType.TASK_OVERDUE,
          triggeredBy: userId,
          beforeTask: existingTask as any,
        });
      }
    }

    void syncTaskEmbedding({
      taskId: task.id,
      tenantId,
      authorization: req.header('authorization') ?? undefined,
    });

    res.json(serializeTask(task));
  } catch (error: any) {
    console.error('Task update error:', error);
    res.status(500).json({ error: 'Failed to update task', details: error.message });
  }
  },
);

// DELETE /api/v1/tasks/:id - Archive task
router.delete(
  '/:id',
  requireAuth,
  requirePermission('tasks:write:own'),
  validateByMode({ params: taskSchemas.params.id }, { params: strictTaskSchemas.params.id }),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = (req as any).userId as string | undefined;
    const userRole = (req as any).user?.role as string | undefined;
    const hasAnyScope = userRole === 'ADMIN' || userRole === 'OWNER';
    const taskId = String(req.params.id);
    const where: any = { id: taskId, tenantId, isArchived: false };
    if (!hasAnyScope && userId) {
      where.OR = [
        { createdBy: userId },
        { userAssignments: { some: { userId } } },
        { groupAssignments: { some: { group: { members: { some: { userId } } } } } },
      ];
    }
    const updated = await prisma.task.updateMany({
      where,
      data: { isArchived: true }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Task archive error:', error);
    res.status(500).json({ error: 'Failed to archive task' });
  }
  },
);

// PUT /api/v1/tasks/:id/assignments - Replace all assignments
router.put('/:id/assignments', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = String(req.params.id);
    const { user_ids = [], group_ids = [] } = req.body;
    const assignedBy = (req as any).userId;

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

    await runWorkflowsForTask({
      tenantId,
      taskId,
      triggerType: TriggerType.TASK_ASSIGNED,
      triggeredBy: assignedBy,
    });

    // Return effective assignees
    const assignees = await getEffectiveAssignees(taskId);

    res.json({ task_id: taskId, assignees });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignments' });
  }
});

// GET /api/v1/tasks/:id/assignees - Get effective assignees
router.get('/:id/assignees', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = String(req.params.id);
    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const assignees = await getEffectiveAssignees(taskId);

    res.json({ task_id: taskId, assignees });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignees' });
  }
});

// Helper function to get effective assignees
async function getEffectiveAssignees(taskId: string) {
  const userAssignments = await prisma.taskUserAssignment.findMany({
    where: { taskId },
    include: { user: true }
  });

  const groupAssignments = await prisma.taskGroupAssignment.findMany({
    where: { taskId },
    include: { group: { include: { members: { include: { user: true } } } } }
  });

  const assignees: any[] = [];

  // Direct user assignments
  userAssignments.forEach(ua => {
    assignees.push({
      user_id: ua.user.id,
      display_name: ua.user.displayName,
      assignment_type: 'direct',
      via_groups: []
    });
  });

  // Group assignments
  groupAssignments.forEach(ga => {
    ga.group.members.forEach(member => {
      const existing = assignees.find(a => a.user_id === member.user.id);
      if (existing) {
        existing.via_groups.push({ group_id: ga.group.id, name: ga.group.name });
      } else {
        assignees.push({
          user_id: member.user.id,
          display_name: member.user.displayName,
          assignment_type: 'group',
          via_groups: [{ group_id: ga.group.id, name: ga.group.name }]
        });
      }
    });
  });

  return assignees;
}

export default router;
