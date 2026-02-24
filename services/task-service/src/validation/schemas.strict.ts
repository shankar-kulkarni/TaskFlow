import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) }).strict();
const groupIdParam = z.object({ groupId: z.string().min(1) }).strict();
const taskIdParam = z.object({ taskId: z.string().min(1) }).strict();
const watcherParam = z.object({ taskId: z.string().min(1), userId: z.string().min(1) }).strict();

const strictPaginationQuery = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    page_size: z.coerce.number().int().min(1).max(500).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    sort: z.string().optional(),
  })
  .strict();

export const strictTaskSchemas = {
  params: { id: idParam },
  query: strictPaginationQuery,
  body: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      project_id: z.string().optional(),
    })
    .strict(),
};

export const strictProjectSchemas = {
  params: { id: idParam },
  query: strictPaginationQuery,
  body: z
    .object({
      workspace_id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
    })
    .strict(),
};

export const strictGroupSchemas = {
  params: { groupId: groupIdParam },
  query: strictPaginationQuery,
  body: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    })
    .strict(),
};

export const strictUserSchemas = {
  query: strictPaginationQuery,
  body: z
    .object({
      displayName: z.string().min(1),
      email: z.string().email(),
      role: z.string().optional(),
    })
    .strict(),
};

export const strictWatcherSchemas = {
  params: { taskId: taskIdParam, watcher: watcherParam },
  query: strictPaginationQuery,
  body: z.object({ userId: z.string().min(1) }).strict(),
};

export const strictAnalyticsSchemas = {
  query: z
    .object({
      workspace_id: z.string().min(1).optional(),
      period: z.string().optional(),
      project_id: z.string().optional(),
    })
    .strict(),
};

export const strictMyTaskSchemas = {
  params: { id: idParam },
  query: strictPaginationQuery,
  body: z
    .object({
      status: z.string().optional(),
      priority: z.string().optional(),
      due_date: z.string().optional(),
    })
    .strict(),
};

export const strictSearchSchemas = {
  query: z
    .object({
      q: z.string().min(1),
      type: z.string().optional(),
      types: z.union([z.string(), z.array(z.string())]).optional(),
      workspace_id: z.string().optional(),
    })
    .strict(),
};

export const strictAdvancedSearchSchemas = {
  query: z
    .object({
      q: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      createdById: z.string().optional(),
      assignedTo: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    })
    .strict(),
};

export const strictTimelineSchemas = {
  query: z
    .object({
      workspace_id: z.string().min(1).optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      group_by: z.string().optional(),
      project_id: z.string().optional(),
    })
    .strict(),
};

export const strictDependencySchemas = {
  params: {
    id: idParam,
  },
  body: z
    .object({
      task_id: z.string().min(1),
      depends_on_id: z.string().min(1),
      dependency_type: z.string().optional(),
      lag_days: z.coerce.number().int().optional(),
    })
    .strict(),
};

export const strictCalendarSchemas = {
  query: z
    .object({
      workspace_id: z.string().min(1).optional(),
      year: z.coerce.number().int().optional(),
      month: z.coerce.number().int().min(1).max(12).optional(),
      project_id: z.string().optional(),
      assigned_to_user: z.string().optional(),
    })
    .strict(),
};

export const strictWorkflowSchemas = {
  params: {
    id: idParam,
  },
  query: z
    .object({
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
    })
    .strict(),
  body: z
    .object({
      workspace_id: z.string().min(1),
      project_id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      trigger_type: z.string().optional(),
      trigger_config: z.unknown().optional(),
      actions: z.array(z.unknown()).optional(),
    })
    .strict(),
};

export const strictAssignmentSchemas = {
  params: {
    taskId: taskIdParam,
  },
  body: z
    .object({
      user_ids: z.array(z.string()).optional(),
      group_ids: z.array(z.string()).optional(),
    })
    .strict(),
};

export const strictAssigneeSchemas = {
  params: {
    taskId: taskIdParam,
  },
};

export const strictCommentSchemas = {
  params: {
    taskId: taskIdParam,
    commentId: z.object({ commentId: z.string().min(1) }).strict(),
  },
  body: z
    .object({
      body: z.string().optional(),
      parent_comment_id: z.string().optional(),
    })
    .strict(),
};

export const strictTenantSchemas = {
  body: z
    .object({
      locale: z.string().optional(),
    })
    .strict(),
};
