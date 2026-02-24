import { create } from 'zustand';
import { apiClient } from './api/client';

export type ViewType = 'tasks' | 'calendar' | 'timeline' | 'my-tasks' | 'analytics' | 'workflows' | 'dashboard' | 'account' | 'inbox' | 'all-tasks';

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  icon?: string;
  workspaceId?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  startDate?: string;
  estimatedHrs?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  creator: User;
  projectId?: string;
  project?: Project;
  userAssignments: any[];
  groupAssignments: any[];
}

interface TaskFormData {
  title: string;
  project_id: string;
  status: string;
  priority: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  estimated_hrs?: number;
  user_ids: string[];
  group_ids: string[];
  watcher_ids: string[];
  tags: string[];
  parent_task_id?: string;
}

interface TaskFlowStore {
  // Navigation
  activeView: ViewType;
  activeProjectId: string | null;

  // Panel state (Section 3)
  selectedTaskId: string | null;
  formMode: 'none' | 'new-task' | 'edit-task';
  formDefaults: Partial<TaskFormData>;

  // Data caches
  tasks: Record<string, Task>;
  projects: Record<string, Project>;
  users: Record<string, User>;
  groups: Record<string, any>;

  // Actions
  selectTask: (id: string | null) => void;
  openNewTaskForm: (defaults?: Partial<TaskFormData>) => void;
  openEditTaskForm: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  closeForm: () => void;
  submitTask: (data: TaskFormData) => Promise<Task>;
  updateTask: (taskId: string, data: TaskFormData) => Promise<Task>;
  setActiveView: (view: ViewType, projectId?: string) => void;
  createProject: (name: string, color: string, icon?: string) => Promise<Project>;
  updateProject: (projectId: string, name: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  loadProjects: () => Promise<void>;
  loadTasks: () => Promise<void>;
  getTaskCount: (projectId?: string) => number;
  getTimelineCount: (projectId?: string) => number;
}

export const useStore = create<TaskFlowStore>((set, get) => ({
  // Navigation
  activeView: 'tasks',
  activeProjectId: null,

  // Panel state
  selectedTaskId: null,
  formMode: 'none',
  formDefaults: {},

  // Data caches
  tasks: {},
  projects: {},
  users: {
    'user-1': { id: 'user-1', email: 'john@example.com', displayName: 'John Doe', role: 'admin' },
    'user-2': { id: 'user-2', email: 'sarah@example.com', displayName: 'Sarah Wilson', role: 'developer' },
    'user-3': { id: 'user-3', email: 'mike@example.com', displayName: 'Mike Johnson', role: 'dba' }
  },
  groups: {},

  // Actions
  selectTask: (id) => set({ selectedTaskId: id }),
  openNewTaskForm: (defaults = {}) => set({
    formMode: 'new-task',
    formDefaults: defaults,
    selectedTaskId: null
  }),
  openEditTaskForm: (taskId) => set(state => ({
    formMode: 'edit-task',
    formDefaults: state.tasks[taskId] ? {
      title: state.tasks[taskId].title,
      project_id: state.tasks[taskId].project?.id || '',
      status: state.tasks[taskId].status,
      priority: state.tasks[taskId].priority,
      description: state.tasks[taskId].description,
      due_date: state.tasks[taskId].dueDate,
      start_date: state.tasks[taskId].startDate,
      estimated_hrs: state.tasks[taskId].estimatedHrs,
      user_ids: state.tasks[taskId].userAssignments?.map(a => a.userId) || [],
      group_ids: state.tasks[taskId].groupAssignments?.map(a => a.groupId) || [],
      watcher_ids: [],
      tags: [],
      parent_task_id: undefined
    } : {},
    selectedTaskId: taskId
  })),
  deleteTask: (taskId) => set(state => {
    const newTasks = { ...state.tasks };
    delete newTasks[taskId];
    return {
      tasks: newTasks,
      selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
      formMode: state.formMode === 'edit-task' && state.selectedTaskId === taskId ? 'none' : state.formMode
    };
  }),
  closeForm: () => set({ formMode: 'none', formDefaults: {} }),
  submitTask: async (data) => {
    const payload = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      project_id: data.project_id,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      estimated_hrs: data.estimated_hrs || null,
      assign_to: {
        user_ids: data.user_ids || [],
        group_ids: data.group_ids || []
      },
      watcher_ids: data.watcher_ids || []
    };

    const created = await apiClient.createTask(payload);
    const project = data.project_id ? get().projects[data.project_id] : undefined;
    const fallbackUserAssignments = (data.user_ids || []).map((userId) => ({ userId }));
    const fallbackGroupAssignments = (data.group_ids || []).map((groupId) => ({ groupId }));
    const task: Task = {
      id: created.id,
      title: created.title,
      description: created.description,
      status: created.status,
      priority: created.priority,
      projectId: created.projectId || created.project_id || created.project?.id || data.project_id || undefined,
      dueDate: created.dueDate || created.due_date || data.due_date,
      startDate: created.startDate || created.start_date || data.start_date,
      estimatedHrs: created.estimatedHrs ?? created.estimated_hrs ?? data.estimated_hrs,
      createdAt: created.createdAt || new Date().toISOString(),
      updatedAt: created.updatedAt || new Date().toISOString(),
      createdBy: created.createdBy || 'user-id',
      creator: created.creator || { id: 'user-id', email: 'user@example.com', displayName: 'User', role: 'member' },
      project: created.project || project,
      userAssignments: created.userAssignments || fallbackUserAssignments,
      groupAssignments: created.groupAssignments || fallbackGroupAssignments
    };

    set(state => ({ tasks: { ...state.tasks, [task.id]: task } }));
    return task;
  },
  updateTask: async (taskId, data) => {
    const payload: any = {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      start_date: data.start_date || null,
      due_date: data.due_date || null,
      estimated_hrs: data.estimated_hrs ?? null,
      project_id: data.project_id
    };

    const updated = await apiClient.updateTask(taskId, payload);
    await apiClient.updateTaskAssignments(taskId, {
      user_ids: data.user_ids || [],
      group_ids: data.group_ids || []
    });
    const project = data.project_id ? get().projects[data.project_id] : undefined;
    const fallbackUserAssignments = (data.user_ids || []).map((userId) => ({ userId }));
    const fallbackGroupAssignments = (data.group_ids || []).map((groupId) => ({ groupId }));
    const task: Task = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      priority: updated.priority,
      projectId: updated.projectId || updated.project_id || updated.project?.id || data.project_id || undefined,
      dueDate: updated.dueDate || updated.due_date || data.due_date,
      startDate: updated.startDate || updated.start_date || data.start_date,
      estimatedHrs: updated.estimatedHrs ?? updated.estimated_hrs ?? data.estimated_hrs,
      createdAt: updated.createdAt || new Date().toISOString(),
      updatedAt: updated.updatedAt || new Date().toISOString(),
      createdBy: updated.createdBy || 'user-id',
      creator: updated.creator || { id: 'user-id', email: 'user@example.com', displayName: 'User', role: 'member' },
      project: updated.project || project,
      userAssignments: updated.userAssignments || fallbackUserAssignments,
      groupAssignments: updated.groupAssignments || fallbackGroupAssignments
    };

    set(state => ({ tasks: { ...state.tasks, [task.id]: task } }));
    return task;
  },
  setActiveView: (view, projectId) => set({
    activeView: view,
    activeProjectId: projectId || null,
    selectedTaskId: null,
    formMode: 'none'
  }),
  createProject: async (name, color, icon) => {
    const payload = {
      workspace_id: 'workspace-uuid',
      name,
      description: '',
      color,
      icon: icon || '📁',
      owner_id: 'user-1'
    };

    const created = await apiClient.createProject(payload);
    const project: Project = {
      id: created.id,
      name: created.name,
      color: created.color,
      icon: created.icon,
      workspaceId: created.workspaceId || created.workspace_id
    };

    set(state => ({ projects: { ...state.projects, [project.id]: project } }));
    return project;
  },
  updateProject: async (projectId, name) => {
    const updated = await apiClient.updateProject(projectId, { name });
    const existing = get().projects[projectId];
    const project: Project = {
      id: updated.id || projectId,
      name: updated.name || name,
      color: updated.color || existing?.color || '#4f8eff',
      icon: updated.icon || existing?.icon,
      workspaceId: updated.workspaceId || updated.workspace_id || existing?.workspaceId
    };

    set(state => ({ projects: { ...state.projects, [projectId]: project } }));
    return project;
  },
  deleteProject: async (projectId) => {
    await apiClient.deleteProject(projectId);
    set(state => {
      const next = { ...state.projects };
      delete next[projectId];
      return { projects: next, activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId };
    });
  },
  loadProjects: async () => {
    const projects = await apiClient.getProjects();
    const projectMap: Record<string, Project> = {};
    projects.forEach((project: any) => {
      if (project.status === 'ARCHIVED') return;
      projectMap[project.id] = {
        id: project.id,
        name: project.name,
        color: project.color || '#4f8eff',
        icon: project.icon || '📁',
        workspaceId: project.workspaceId || project.workspace_id
      };
    });
    set({ projects: projectMap });
  },
  loadTasks: async () => {
    const tasks = await apiClient.getTasks();
    const projectMap = get().projects;
    const taskMap: Record<string, Task> = {};

    tasks.forEach((task: any) => {
      const projectId = task.projectId || task.project_id || task.project?.id;
      taskMap[task.id] = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        projectId,
        dueDate: task.dueDate || task.due_date,
        startDate: task.startDate || task.start_date,
        estimatedHrs: task.estimatedHrs ?? task.estimated_hrs,
        createdAt: task.createdAt || new Date().toISOString(),
        updatedAt: task.updatedAt || new Date().toISOString(),
        createdBy: task.createdBy || task.created_by,
        creator: task.creator || { id: task.createdBy || 'user-id', email: '', displayName: 'User', role: 'member' },
        project: task.project || (projectId ? projectMap[projectId] : undefined) || undefined,
        userAssignments: task.userAssignments || [],
        groupAssignments: task.groupAssignments || []
      };
    });

    set({ tasks: taskMap });
  },
  getTaskCount: (projectId?: string) => {
    const state = get();
    return Object.values(state.tasks).filter(task =>
      !projectId || (task.projectId || task.project?.id) === projectId
    ).length;
  },
  getTimelineCount: (projectId?: string) => {
    const state = get();
    return Object.values(state.tasks).filter(task =>
      (!projectId || (task.projectId || task.project?.id) === projectId) &&
      (task.startDate || task.dueDate)
    ).length;
  },
}));

