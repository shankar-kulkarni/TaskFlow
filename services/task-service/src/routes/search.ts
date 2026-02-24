import { Router } from 'express';
import { Priority, TaskStatus } from '@prisma/client';
import { optionalAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { advancedSearchSchemas, searchSchemas } from '../validation/schemas';
import { strictAdvancedSearchSchemas, strictSearchSchemas } from '../validation/schemas.strict';

const router = Router();

// GET /api/v1/search?q=query&type=tasks|users|projects|all
router.get(
  '/',
  optionalAuth,
  validateByMode({ query: searchSchemas.query }, { query: strictSearchSchemas.query }),
  async (req: any, res) => {
  try {
    const { q, type = 'all', limit = 20, offset = 0 } = req.query;
    const tenantId = resolveTenantId(req, 'tenant-default') as string;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const pageLimit = Math.min(parseInt(limit), 100);
    const pageOffset = parseInt(offset);
    const searchQuery = q.trim();

    const results: any = {
      tasks: [],
      users: [],
      projects: [],
      count: 0
    };

    // Search tasks across title, description, project, status, priority, and due date.
    if (type === 'all' || type === 'tasks') {
      const normalizedQuery = searchQuery.toLowerCase();
      const normalizedEnumQuery = normalizedQuery.replace(/\s+/g, '_');
      const parsedDueDate = /^\d{4}-\d{2}-\d{2}$/.test(searchQuery) ? new Date(`${searchQuery}T00:00:00.000Z`) : null;
      const dueDateEnd = parsedDueDate ? new Date(parsedDueDate.getTime() + 24 * 60 * 60 * 1000) : null;
      const statusValue = (Object.values(TaskStatus) as string[]).find((value) => value.toLowerCase() === normalizedEnumQuery);
      const priorityValue = (Object.values(Priority) as string[]).find((value) => value.toLowerCase() === normalizedEnumQuery);

      const taskOrFilters: any[] = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
        { project: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ];

      if (statusValue) {
        taskOrFilters.push({ status: statusValue as TaskStatus });
      }
      if (priorityValue) {
        taskOrFilters.push({ priority: priorityValue as Priority });
      }
      if (parsedDueDate && dueDateEnd) {
        taskOrFilters.push({ dueDate: { gte: parsedDueDate, lt: dueDateEnd } });
      }

      const tasks = await prisma.task.findMany({
        where: {
          tenantId,
          OR: taskOrFilters
        },
        include: {
          project: { select: { id: true, name: true } },
          userAssignments: { include: { user: true } },
          groupAssignments: { include: { group: true } },
          creator: { select: { id: true, displayName: true } }
        },
        take: pageLimit,
        skip: pageOffset,
        orderBy: { updatedAt: 'desc' }
      });

      results.tasks = tasks.map((task: any) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        description: task.description?.substring(0, 100),
        status: task.status,
        priority: task.priority,
        project: task.project,
        assignees: task.userAssignments.map((ua: any) => ua.user),
        createdBy: task.creator
      }));
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { displayName: { contains: searchQuery, mode: 'insensitive' } },
            { email: { contains: searchQuery, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true
        },
        take: pageLimit,
        skip: pageOffset
      });

      results.users = users.map((user: any) => ({
        id: user.id,
        type: 'user',
        displayName: user.displayName,
        email: user.email,
        role: user.role
      }));
    }

    // Search projects
    if (type === 'all' || type === 'projects') {
      const projects = await prisma.project.findMany({
        where: {
          workspace: { tenantId },
          OR: [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } }
          ]
        },
        include: {
          owner: { select: { id: true, displayName: true } }
        },
        take: pageLimit,
        skip: pageOffset,
        orderBy: { updatedAt: 'desc' }
      });

      results.projects = projects.map((project: any) => ({
        id: project.id,
        type: 'project',
        name: project.name,
        description: project.description?.substring(0, 100),
        status: project.status,
        owner: project.owner
      }));
    }

    results.count = results.tasks.length + results.users.length + results.projects.length;

    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// GET /api/v1/search/advanced - Advanced search with filters
router.get(
  '/advanced',
  optionalAuth,
  validateByMode(
    { query: advancedSearchSchemas.query },
    { query: strictAdvancedSearchSchemas.query },
  ),
  async (req: any, res) => {
  try {
    const { q, status, priority, createdById, assignedTo, dateFrom, dateTo, limit = 20, offset = 0 } = req.query;
    const tenantId = resolveTenantId(req, 'tenant-default') as string;

    const pageLimit = Math.min(parseInt(limit), 100);
    const pageOffset = parseInt(offset);

    const where: any = { tenantId };

    // Text search
    if (q && q.trim().length >= 2) {
      where.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Creator filter
    if (createdById) {
      where.createdById = createdById;
    }

    // Assigned to filter (direct user assignments only)
    if (assignedTo) {
      where.userAssignments = {
        some: { userId: assignedTo }
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        userAssignments: { include: { user: true } },
        groupAssignments: { include: { group: true } },
        creator: { select: { id: true, displayName: true } }
      },
      take: pageLimit,
      skip: pageOffset,
      orderBy: { updatedAt: 'desc' }
    });

    const count = await prisma.task.count({ where });

    res.json({
      tasks: tasks.map(task => ({
        ...task,
        assignees: task.userAssignments.map((ua: any) => ua.user)
      })),
      count,
      limit: pageLimit,
      offset: pageOffset
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

export default router;
