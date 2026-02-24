import { z } from 'zod';

const idParam = z.object({ id: z.string().min(1) }).passthrough();
const groupIdParam = z.object({ groupId: z.string().min(1) }).passthrough();
const taskIdParam = z.object({ taskId: z.string().min(1) }).passthrough();
const watcherParam = z.object({ taskId: z.string().min(1), userId: z.string().min(1) }).passthrough();

const paginationQuery = z
  .object({
    page: z.union([z.string(), z.number()]).optional(),
    page_size: z.union([z.string(), z.number()]).optional(),
    limit: z.union([z.string(), z.number()]).optional(),
    offset: z.union([z.string(), z.number()]).optional(),
    sort: z.string().optional(),
  })
  .passthrough();

export const taskSchemas = {
  params: { id: idParam },
  query: paginationQuery,
  body: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      project_id: z.string().optional(),
    })
    .passthrough(),
};

export const projectSchemas = {
  params: { id: idParam },
  query: paginationQuery,
  body: z
    .object({
      workspace_id: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    })
    .passthrough(),
};

export const groupSchemas = {
  params: { groupId: groupIdParam },
  query: paginationQuery,
  body: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      memberIds: z.array(z.string()).optional(),
    })
    .passthrough(),
};

export const userSchemas = {
  query: paginationQuery,
  body: z
    .object({
      displayName: z.string().optional(),
      email: z.string().optional(),
      role: z.string().optional(),
    })
    .passthrough(),
};

export const watcherSchemas = {
  params: { taskId: taskIdParam, watcher: watcherParam },
  query: paginationQuery,
  body: z.object({ userId: z.string().optional() }).passthrough(),
};

export const analyticsSchemas = {
  query: z
    .object({
      workspace_id: z.string().optional(),
      period: z.string().optional(),
      project_id: z.string().optional(),
    })
    .passthrough(),
};

export const myTaskSchemas = {
  params: { id: idParam },
  query: paginationQuery,
  body: z
    .object({
      status: z.string().optional(),
      priority: z.string().optional(),
      due_date: z.string().optional(),
    })
    .passthrough(),
};

export const searchSchemas = {
  query: z
    .object({
      q: z.string().optional(),
      type: z.string().optional(),
      types: z.union([z.string(), z.array(z.string())]).optional(),
      workspace_id: z.string().optional(),
    })
    .passthrough(),
};

export const timelineSchemas = {
  query: z
    .object({
      workspace_id: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      group_by: z.string().optional(),
      project_id: z.string().optional(),
    })
    .passthrough(),
};

export const dependencySchemas = {
  params: {
    id: idParam,
  },
  body: z
    .object({
      task_id: z.string().optional(),
      depends_on_id: z.string().optional(),
      dependency_type: z.string().optional(),
      lag_days: z.union([z.string(), z.number()]).optional(),
    })
    .passthrough(),
};

export const calendarSchemas = {
  query: z
    .object({
      workspace_id: z.string().optional(),
      year: z.union([z.string(), z.number()]).optional(),
      month: z.union([z.string(), z.number()]).optional(),
      project_id: z.string().optional(),
      assigned_to_user: z.string().optional(),
    })
    .passthrough(),
};

export const workflowSchemas = {
  params: {
    id: idParam,
  },
  query: z
    .object({
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
    })
    .passthrough(),
  body: z
    .object({
      workspace_id: z.string().optional(),
      project_id: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      trigger_type: z.string().optional(),
      trigger_config: z.unknown().optional(),
      actions: z.array(z.unknown()).optional(),
    })
    .passthrough(),
};

export const assignmentSchemas = {
  params: {
    taskId: taskIdParam,
  },
  body: z
    .object({
      user_ids: z.array(z.string()).optional(),
      group_ids: z.array(z.string()).optional(),
    })
    .passthrough(),
};

export const assigneeSchemas = {
  params: {
    taskId: taskIdParam,
  },
};

export const commentSchemas = {
  params: {
    taskId: taskIdParam,
    commentId: z.object({ commentId: z.string().min(1) }).passthrough(),
  },
  body: z
    .object({
      body: z.string().optional(),
      parent_comment_id: z.string().optional(),
    })
    .passthrough(),
};

export const tenantSchemas = {
  body: z
    .object({
      locale: z.string().optional(),
    })
    .passthrough(),
};

export const advancedSearchSchemas = {
  query: z
    .object({
      q: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      createdById: z.string().optional(),
      assignedTo: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.union([z.string(), z.number()]).optional(),
      offset: z.union([z.string(), z.number()]).optional(),
    })
    .passthrough(),
};
