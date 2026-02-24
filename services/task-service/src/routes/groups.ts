import { Router } from 'express';
import { AuditService } from '../services/audit.service';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { v4 as uuidv4 } from 'uuid';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { groupSchemas } from '../validation/schemas';
import { strictGroupSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req, 'tenant-default') as string;

// GET /api/v1/groups - List all groups in tenant
router.get(
  '/',
  optionalAuth,
  validateByMode({ query: groupSchemas.query }, { query: strictGroupSchemas.query }),
  async (req: any, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const tenantId = getTenantId(req);

    const groups = await prisma.group.findMany({
      where: { tenantId },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, role: true } }
          }
        }
      },
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { name: 'asc' }
    });

    const count = await prisma.group.count({ where: { tenantId } });

    res.json({
      groups: groups.map(group => ({
        ...group,
        members: group.members.map(member => ({
          user: member.user,
          role: member.role,
          addedAt: member.addedAt
        }))
      })),
      count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// GET /api/v1/groups/:groupId - Get group details
router.get(
  '/:groupId',
  requireAuth,
  validateByMode({ params: groupSchemas.params.groupId }, { params: strictGroupSchemas.params.groupId }),
  async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const tenantId = getTenantId(req);

    const group = await prisma.group.findFirstOrThrow({
      where: { id: groupId, tenantId },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, role: true } }
          }
        }
      }
    });

    res.json({
      ...group,
      members: group.members.map(member => ({
        user: member.user,
        role: member.role,
        addedAt: member.addedAt
      }))
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// POST /api/v1/groups - Create new group
router.post(
  '/',
  requireAuth,
  validateByMode({ body: groupSchemas.body }, { body: strictGroupSchemas.body }),
  async (req: any, res) => {
  try {
    const { name, description, memberIds = [] } = req.body;
    const tenantId = getTenantId(req);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Verify user has permission (ADMIN or OWNER only)
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to create groups' });
    }

    // Check if group name already exists
    const existing = await prisma.group.findFirst({
      where: { tenantId, name: name.trim() }
    });

    if (existing) {
      return res.status(400).json({ error: 'Group name already exists' });
    }

    const group = await prisma.group.create({
      data: {
        id: uuidv4(),
        tenantId,
        name: name.trim(),
        description: description || null,
        createdBy: req.userId,
        members: {
          create: memberIds.map((id: string) => ({
            userId: id,
            addedBy: req.userId
          }))
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, role: true } }
          }
        }
      }
    });

    // Log audit event
    await AuditService.log(
      tenantId,
      req.userId,
      'group',
      group.id,
      'create',
      null,
      { name: group.name, memberCount: memberIds.length },
      req.ip
    );

    res.json({
      ...group,
      members: group.members.map(member => ({
        user: member.user,
        role: member.role,
        addedAt: member.addedAt
      }))
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// PATCH /api/v1/groups/:groupId - Update group
router.patch(
  '/:groupId',
  requireAuth,
  validateByMode(
    { params: groupSchemas.params.groupId, body: groupSchemas.body },
    { params: strictGroupSchemas.params.groupId, body: strictGroupSchemas.body },
  ),
  async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const tenantId = getTenantId(req);

    // Verify permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to update groups' });
    }

    const group = await prisma.group.findFirstOrThrow({
      where: { id: groupId, tenantId }
    });

    // Check if new name conflicts
    if (name && name !== group.name) {
      const existing = await prisma.group.findFirst({
        where: {
          tenantId,
          name: name.trim(),
          id: { not: groupId }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Group name already exists' });
      }
    }

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: name || group.name,
        description: description !== undefined ? description : group.description
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, displayName: true, email: true, role: true } }
          }
        }
      }
    });

    // Log audit event
    await AuditService.log(
      tenantId,
      req.userId,
      'group',
      groupId,
      'update',
      { name: group.name, description: group.description },
      { name: updated.name, description: updated.description },
      req.ip
    );

    res.json({
      ...updated,
      members: updated.members.map(member => ({
        user: member.user,
        role: member.role,
        addedAt: member.addedAt
      }))
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// DELETE /api/v1/groups/:groupId - Delete group
router.delete(
  '/:groupId',
  requireAuth,
  validateByMode({ params: groupSchemas.params.groupId }, { params: strictGroupSchemas.params.groupId }),
  async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const tenantId = getTenantId(req);

    // Verify permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to delete groups' });
    }

    const group = await prisma.group.findFirstOrThrow({
      where: { id: groupId, tenantId }
    });

    await prisma.group.delete({
      where: { id: groupId }
    });

    // Log audit event
    await AuditService.log(
      tenantId,
      req.userId,
      'group',
      groupId,
      'delete',
      { name: group.name },
      null,
      req.ip
    );

    res.json({ message: 'Group deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
  },
);

// POST /api/v1/groups/:groupId/members - Add member to group
router.post('/:groupId/members', requireAuth, async (req: any, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const tenantId = getTenantId(req);

    // Verify permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to manage group members' });
    }

    await prisma.group.findFirstOrThrow({
      where: { id: groupId, tenantId }
    });

    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });

    const existingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } }
    });
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        addedBy: req.userId
      }
    });

    // Log audit event
    await AuditService.log(
      tenantId,
      req.userId,
      'group_member',
      groupId,
      'add',
      null,
      { userId, displayName: targetUser.displayName },
      req.ip
    );

    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/groups/:groupId/members/:userId - Remove member from group
router.delete('/:groupId/members/:userId', requireAuth, async (req: any, res) => {
  try {
    const { groupId, userId } = req.params;
    const tenantId = getTenantId(req);

    // Verify permission
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
      return res.status(403).json({ error: 'Not authorized to manage group members' });
    }

    await prisma.group.findFirstOrThrow({
      where: { id: groupId, tenantId }
    });

    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId }
    });

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } }
    });

    // Log audit event
    await AuditService.log(
      tenantId,
      req.userId,
      'group_member',
      groupId,
      'remove',
      { userId, displayName: targetUser.displayName },
      null,
      req.ip
    );

    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
