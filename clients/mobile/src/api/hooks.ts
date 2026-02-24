import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, Task, CreateTaskRequest, UpdateTaskRequest, Comment } from './client';

// Query keys
export const queryKeys = {
  tasks: ['tasks'] as const,
  task: (id: string) => ['tasks', id] as const,
  taskComments: (taskId: string) => ['tasks', taskId, 'comments'] as const,
};

// Tasks hooks
export const useTasks = (params?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery({
    queryKey: [...queryKeys.tasks, params],
    queryFn: () => apiClient.getTasks(params),
  });
};

export const useTask = (id: string) => {
  return useQuery({
    queryKey: queryKeys.task(id),
    queryFn: () => apiClient.getTask(id),
    enabled: !!id,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (task: CreateTaskRequest) => apiClient.createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTaskRequest }) =>
      apiClient.updateTask(id, updates),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
      queryClient.invalidateQueries({ queryKey: queryKeys.task(updatedTask.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(updatedTask.id) });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
};

// Comments hooks
export const useTaskComments = (taskId: string) => {
  return useQuery({
    queryKey: queryKeys.taskComments(taskId),
    queryFn: () => apiClient.getTaskComments(taskId),
    enabled: !!taskId,
  });
};

export const useAddTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      apiClient.addTaskComment(taskId, content),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(taskId) });
    },
  });
};

export const useUpdateTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      commentId,
      content,
    }: {
      taskId: string;
      commentId: string;
      content: string;
    }) => apiClient.updateTaskComment(taskId, commentId, content),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(taskId) });
    },
  });
};

export const useDeleteTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      apiClient.deleteTaskComment(taskId, commentId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taskComments(taskId) });
    },
  });
};

// Assignment hooks
export const useAssignTaskToUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userIds }: { taskId: string; userIds: string[] }) =>
      apiClient.assignTaskToUsers(taskId, userIds),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
    },
  });
};

export const useAssignTaskToGroups = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, groupIds }: { taskId: string; groupIds: string[] }) =>
      apiClient.assignTaskToGroups(taskId, groupIds),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
    },
  });
};

export const useRemoveTaskAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, assignmentId }: { taskId: string; assignmentId: string }) =>
      apiClient.removeTaskAssignment(taskId, assignmentId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
    },
  });
};