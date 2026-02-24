import { prisma } from '../prisma';
import { EmailService } from './email.service';

export class NotificationService {
  // Create notification for task assignment
  static async notifyTaskAssignment(taskId: string, assignedUserIds: string[], assignedGroupIds: string[]) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { creator: true, project: true }
    });

    if (!task) return;

    // Get all effective assignees
    let allAssignees = new Set<string>(assignedUserIds);
    if (assignedGroupIds.length > 0) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: { in: assignedGroupIds } }
      });
      groupMembers.forEach(m => allAssignees.add(m.userId));
    }

    // Create notifications
    const notifications = [];
    for (const userId of allAssignees) {
      const notif = await prisma.notification.create({
        data: {
          userId,
          type: 'task_assigned',
          taskId,
          actorId: task.createdBy,
          data: {
            taskTitle: task.title,
            projectName: task.project?.name
          }
        },
        include: { user: true }
      });
      notifications.push(notif);

      // Send email if preferences allow
      const prefs = await prisma.notificationPreferences.findUnique({
        where: { userId }
      });
      if (prefs?.emailOnAssignment) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          setTimeout(() => {
            EmailService.sendTaskAssignedEmail(
              user.email,
              user.displayName,
              task.title,
              `${frontendUrl}/tasks/${taskId}`,
              userId
            );
          }, 5000);
        }
      }
    }

    return notifications;
  }

  // Notify comment added with mentions
  static async notifyCommentMentions(taskId: string, commentId: string, commentText: string, authorId: string, mentionedUserIds: string[]) {
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    const author = await prisma.user.findUnique({
      where: { id: authorId }
    });

    if (!task || !author) return;

    for (const userId of mentionedUserIds) {
      const notif = await prisma.notification.create({
        data: {
          userId,
          type: 'mentioned_in_comment',
          taskId,
          actorId: authorId,
          data: {
            commentExcerpt: commentText.substring(0, 100),
            taskTitle: task.title
          }
        },
        include: { user: true }
      });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const prefs = await prisma.notificationPreferences.findUnique({ where: { userId } });
        if (prefs?.emailOnMention) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          setTimeout(() => {
            EmailService.sendCommentMentionEmail(
              user.email,
              user.displayName,
              author.displayName,
              task.title,
              `${frontendUrl}/tasks/${taskId}`,
              commentText.substring(0, 150),
              userId
            );
          }, 5000);
        }
      }
    }
  }

  // Get notifications for user
  static async getNotifications(userId: string, limit: number = 20, offset: number = 0) {
    return prisma.notification.findMany({
      where: { userId },
      include: { actor: true, task: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Mark as read
  static async markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() }
    });
  }

  // Mark all as read
  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() }
    });
  }

  // Create notification preference
  static async createOrUpdatePreferences(userId: string, preferences: any) {
    return prisma.notificationPreferences.upsert({
      where: { userId },
      update: preferences,
      create: { userId, ...preferences }
    });
  }

  // Get preferences
  static async getPreferences(userId: string) {
    let prefs = await prisma.notificationPreferences.findUnique({
      where: { userId }
    });

    if (!prefs) {
      prefs = await prisma.notificationPreferences.create({
        data: { userId }
      });
    }

    return prefs;
  }
}
