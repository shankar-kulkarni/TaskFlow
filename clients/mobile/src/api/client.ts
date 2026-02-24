import { API_BASE_URL, TENANT_ID } from '@env';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    displayName: string;
  };
  userAssignments: Array<{
    id: string;
    user: {
      id: string;
      displayName: string;
    };
  }>;
  groupAssignments: Array<{
    id: string;
    group: {
      id: string;
      name: string;
      members: Array<{
        id: string;
        displayName: string;
      }>;
    };
  }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    author: {
      id: string;
      displayName: string;
    };
  }>;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  userAssignments?: string[];
  groupAssignments?: string[];
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: string;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
  };
}

class ApiClient {
  private baseUrl: string;
  private tenantId: string;

  constructor(baseUrl: string = API_BASE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.tenantId = TENANT_ID || 'tenant-uuid';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantId,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Tasks
  async getTasks(params?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tasks: Task[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: string): Promise<Task> {
    return this.request(`/api/tasks/${id}`);
  }

  async createTask(task: CreateTaskRequest): Promise<Task> {
    return this.request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: UpdateTaskRequest): Promise<Task> {
    return this.request(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string): Promise<void> {
    return this.request(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Comments
  async getTaskComments(taskId: string): Promise<Comment[]> {
    return this.request(`/api/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: string, content: string): Promise<Comment> {
    return this.request(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateTaskComment(
    taskId: string,
    commentId: string,
    content: string
  ): Promise<Comment> {
    return this.request(`/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteTaskComment(taskId: string, commentId: string): Promise<void> {
    return this.request(`/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Assignments
  async assignTaskToUsers(taskId: string, userIds: string[]): Promise<void> {
    return this.request(`/api/tasks/${taskId}/assignments/users`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  }

  async assignTaskToGroups(taskId: string, groupIds: string[]): Promise<void> {
    return this.request(`/api/tasks/${taskId}/assignments/groups`, {
      method: 'POST',
      body: JSON.stringify({ groupIds }),
    });
  }

  async removeTaskAssignment(taskId: string, assignmentId: string): Promise<void> {
    return this.request(`/api/tasks/${taskId}/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
  }

  // Tenant preferences
  async getTenantPreferences(): Promise<{ locale: string } | null> {
    return this.request('/api/v1/tenants/preferences');
  }

  async updateTenantPreferences(payload: { locale?: string }) {
    return this.request('/api/v1/tenants/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }
}

export const apiClient = new ApiClient();