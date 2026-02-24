import { ActionType, Prisma, RunStatus, TaskStatus, TriggerType } from '@prisma/client';
import { prisma } from '../prisma';

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    userAssignments: true;
    groupAssignments: true;
  };
}>;

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const loadTask = async (taskId: string) =>
  prisma.task.findUnique({
    where: { id: taskId },
    include: {
      userAssignments: true,
      groupAssignments: true,
    },
  });

const matchesTriggerConfig = (
  trigger: TriggerType,
  config: Record<string, any>,
  beforeTask: TaskWithRelations | null,
  afterTask: TaskWithRelations,
): boolean => {
  if (config.projectId && afterTask.projectId !== config.projectId) return false;
  if (config.status && afterTask.status !== config.status) return false;
  if (config.priority && afterTask.priority !== config.priority) return false;

  if (trigger === TriggerType.TASK_STATUS_CHANGED) {
    if (!beforeTask) return false;
    if (config.from && beforeTask.status !== config.from) return false;
    if (config.to && afterTask.status !== config.to) return false;
  }

  if (trigger === TriggerType.TASK_PRIORITY_CHANGED) {
    if (!beforeTask) return false;
    if (config.from && beforeTask.priority !== config.from) return false;
    if (config.to && afterTask.priority !== config.to) return false;
  }

  if (trigger === TriggerType.TASK_DUE_DATE_APPROACHING) {
    if (!afterTask.dueDate) return false;
    const dueInDays = typeof config.dueInDays === 'number' ? config.dueInDays : 3;
    const now = new Date();
    const dueDate = new Date(afterTask.dueDate);
    const diff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= dueInDays && diff >= 0;
  }

  if (trigger === TriggerType.TASK_OVERDUE) {
    if (!afterTask.dueDate) return false;
    return new Date(afterTask.dueDate).getTime() < Date.now() && afterTask.status !== TaskStatus.DONE;
  }

  return true;
};

const executeActions = async (
  workflowId: string,
  task: TaskWithRelations,
  triggerType: TriggerType,
  actions: Array<{ actionType: ActionType; actionConfig: any }>,
  triggeredBy: string | undefined,
) => {
  const nextStatus: { status?: TaskStatus; priority?: any; dueDate?: Date | null } = {};
  const assignUsers = new Set<string>();
  const unassignUsers = new Set<string>();
  const assignGroups = new Set<string>();
  let tagsToAdd: string[] = [];

  actions.forEach((action) => {
      const config = (action.actionConfig ?? {}) as Record<string, any>;
      switch (action.actionType) {
      case ActionType.CHANGE_STATUS:
        if (
          config.status &&
          !(
            triggerType === TriggerType.TASK_CREATED &&
            task.status !== TaskStatus.TODO
          )
        ) {
          nextStatus.status = config.status as TaskStatus;
        }
        break;
      case ActionType.CHANGE_PRIORITY:
        if (config.priority) nextStatus.priority = config.priority;
        break;
      case ActionType.SET_DUE_DATE:
        if (typeof config.daysFromNow === 'number') {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + config.daysFromNow);
          nextStatus.dueDate = nextDate;
        } else if (config.date) {
          nextStatus.dueDate = toDate(config.date);
        }
        break;
      case ActionType.ASSIGN_USER:
        if (config.userId) assignUsers.add(String(config.userId));
        break;
      case ActionType.UNASSIGN_USER:
        if (config.userId) unassignUsers.add(String(config.userId));
        break;
      case ActionType.ASSIGN_GROUP:
        if (config.groupId) assignGroups.add(String(config.groupId));
        break;
      case ActionType.ADD_TAG:
        if (config.tag) tagsToAdd.push(String(config.tag));
        break;
      case ActionType.POST_COMMENT:
        if (config.comment) {
          void prisma.taskComment.create({
            data: {
              taskId: task.id,
              authorId: triggeredBy || task.createdBy,
              body: String(config.comment),
            },
          });
        }
        break;
      default:
        break;
    }
  });

  if (Object.keys(nextStatus).length > 0 || tagsToAdd.length > 0) {
    const customFields = (task.customFields as Record<string, any> | null) ?? {};
    if (tagsToAdd.length > 0) {
      const existingTags = Array.isArray(customFields.tags) ? customFields.tags : [];
      customFields.tags = Array.from(new Set([...existingTags, ...tagsToAdd]));
    }
    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...nextStatus,
        customFields,
      },
    });
  }

  if (assignUsers.size > 0) {
    await prisma.taskUserAssignment.createMany({
      data: Array.from(assignUsers).map((userId) => ({
        taskId: task.id,
        userId,
        assignedBy: triggeredBy || task.createdBy,
      })),
      skipDuplicates: true,
    });
  }

  if (unassignUsers.size > 0) {
    await prisma.taskUserAssignment.deleteMany({
      where: {
        taskId: task.id,
        userId: { in: Array.from(unassignUsers) },
      },
    });
  }

  if (assignGroups.size > 0) {
    await prisma.taskGroupAssignment.createMany({
      data: Array.from(assignGroups).map((groupId) => ({
        taskId: task.id,
        groupId,
        assignedBy: triggeredBy || task.createdBy,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      runCount: { increment: 1 },
      lastRunAt: new Date(),
    },
  });
};

export const runWorkflowsForTask = async ({
  tenantId,
  taskId,
  triggerType,
  triggeredBy,
  beforeTask,
}: {
  tenantId: string;
  taskId: string;
  triggerType: TriggerType;
  triggeredBy?: string;
  beforeTask?: TaskWithRelations | null;
}) => {
  const afterTask = await loadTask(taskId);
  if (!afterTask) return;
  const currentTask: TaskWithRelations = afterTask;

  const workflows = await prisma.workflow.findMany({
    where: {
      isActive: true,
      triggerType,
      workspace: { tenantId },
      OR: [{ projectId: null }, { projectId: afterTask.projectId }],
    },
    include: {
      actions: {
        orderBy: { actionOrder: 'asc' },
      },
    },
  });

  for (const workflow of workflows) {
    const triggerConfig = (workflow.triggerConfig as Record<string, any> | null) ?? {};
    const shouldRun = matchesTriggerConfig(triggerType, triggerConfig, beforeTask ?? null, currentTask);
    if (!shouldRun) continue;

    const run = await prisma.workflowRun.create({
      data: {
        workflowId: workflow.id,
        taskId: currentTask.id,
        triggeredBy: triggeredBy || null,
        status: RunStatus.SUCCESS,
      },
    });

    try {
      await executeActions(workflow.id, currentTask, triggerType, workflow.actions, triggeredBy);
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.SUCCESS,
          finishedAt: new Date(),
        },
      });
    } catch (error: any) {
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.FAILED,
          errorMsg: error?.message || 'Workflow action execution failed',
          finishedAt: new Date(),
        },
      });
    }
  }
};
