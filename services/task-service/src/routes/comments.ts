import { Router } from 'express';
import { prisma } from '../prisma';
import { AuditService } from '../services/audit.service';
import { NotificationService } from '../services/notification.service';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId as resolveTenantId } from '../utils/tenant';
import { validateByMode } from '../middleware/validate';
import { commentSchemas } from '../validation/schemas';
import { strictCommentSchemas } from '../validation/schemas.strict';

const router = Router();

const getTenantId = (req: any) => resolveTenantId(req, 'tenant-default') as string;

const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex) || [];
  return matches.map(m => m.substring(1));
};

const resolveMentions = async (mentions: string[], tenantId: string) => {
  if (mentions.length === 0) return [];
  return prisma.user.findMany({
    where: {
      tenantId,
      displayName: { in: mentions }
    },
    select: { id: true, displayName: true, email: true }
  });
};

// GET /api/v1/tasks/:taskId/comments - List task comments with threading
router.get(
  '/:taskId/comments',
  optionalAuth,
  validateByMode(
    { params: commentSchemas.params.taskId },
    { params: strictCommentSchemas.params.taskId },
  ),
  async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = req.params.taskId as string;

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comments = await prisma.taskComment.findMany({
      where: {
        taskId,
        parentCommentId: null,
        deletedAt: null
      },
      include: {
        author: true,
        mentions: { include: { user: true } },
        replies: {
          where: { deletedAt: null },
          include: {
            author: true,
            mentions: { include: { user: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
  },
);

// POST /api/v1/tasks/:taskId/comments - Add a comment or reply
router.post(
  '/:taskId/comments',
  requireAuth,
  validateByMode(
    { params: commentSchemas.params.taskId, body: commentSchemas.body },
    { params: strictCommentSchemas.params.taskId, body: strictCommentSchemas.body },
  ),
  async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = req.params.taskId as string;
    const { body, parent_comment_id } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, tenantId }
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const mentionedUsernames = extractMentions(body);
    const mentionedUsers = await resolveMentions(mentionedUsernames, tenantId);

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: req.userId,
        body: body.trim(),
        parentCommentId: parent_comment_id || null,
        mentions: {
          create: mentionedUsers.map(u => ({ userId: u.id }))
        }
      },
      include: {
        author: true,
        mentions: { include: { user: true } }
      }
    });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_comment',
      comment.id,
      'create',
      null,
      { taskId, excerpt: body.substring(0, 120) },
      req.ip
    );

    if (mentionedUsers.length > 0) {
      await NotificationService.notifyCommentMentions(
        taskId,
        comment.id,
        body,
        req.userId,
        mentionedUsers.map(u => u.id)
      );
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
  },
);

// PATCH /api/v1/tasks/comments/:commentId - Edit a comment
router.patch(
  '/comments/:commentId',
  requireAuth,
  validateByMode(
    { params: commentSchemas.params.commentId, body: commentSchemas.body },
    { params: strictCommentSchemas.params.commentId, body: strictCommentSchemas.body },
  ),
  async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const commentId = req.params.commentId as string;
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const existing = await prisma.taskComment.findUnique({
      where: { id: commentId }
    });

    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.authorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const mentionedUsernames = extractMentions(body);
    const mentionedUsers = await resolveMentions(mentionedUsernames, tenantId);

    await prisma.taskCommentMention.deleteMany({ where: { commentId } });

    const updated = await prisma.taskComment.update({
      where: { id: commentId },
      data: {
        body: body.trim(),
        isEdited: true,
        mentions: {
          create: mentionedUsers.map(u => ({ userId: u.id }))
        }
      },
      include: {
        author: true,
        mentions: { include: { user: true } }
      }
    });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_comment',
      commentId,
      'update',
      { excerpt: existing.body.substring(0, 120) },
      { excerpt: body.substring(0, 120) },
      req.ip
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update comment' });
  }
  },
);

// DELETE /api/v1/tasks/comments/:commentId - Soft delete comment
router.delete(
  '/comments/:commentId',
  requireAuth,
  validateByMode(
    { params: commentSchemas.params.commentId },
    { params: strictCommentSchemas.params.commentId },
  ),
  async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const commentId = req.params.commentId as string;

    const existing = await prisma.taskComment.findUnique({
      where: { id: commentId }
    });

    if (!existing) return res.status(404).json({ error: 'Comment not found' });
    if (existing.authorId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    await prisma.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() }
    });

    await AuditService.log(
      tenantId,
      req.userId,
      'task_comment',
      commentId,
      'delete',
      { excerpt: existing.body.substring(0, 120) },
      null,
      req.ip
    );

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
  },
);

export default router;