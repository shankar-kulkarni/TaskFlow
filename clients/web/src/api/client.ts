const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:4010';
const AUTH_TOKEN_KEY = 'taskflow.accessToken';
const REFRESH_TOKEN_KEY = 'taskflow.refreshToken';
const TENANT_KEY = 'taskflow.tenantId';
const USER_KEY = 'taskflow.user';
const SESSION_EXPIRED_EVENT = 'taskflow:session-expired';

class ApiClient {
  private baseURL: string;
  private aiBaseURL: string;
  private sessionExpiredNotified = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.aiBaseURL = AI_BASE_URL;
  }

  private getTenantId() {
    return localStorage.getItem(TENANT_KEY) || 'saas-test';
  }

  private getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  getAccessToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const authToken = this.getAuthToken();
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.getTenantId(),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      if (response.status === 401 && !this.sessionExpiredNotified) {
        this.sessionExpiredNotified = true;
        this.clearTokens();
        this.clearTenantId();
        localStorage.removeItem(USER_KEY);
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }

      let errorBody = '';
      try {
        if (isJson) {
          errorBody = await response.json();
          console.error(`API Error ${response.status}:`, errorBody);
        } else {
          errorBody = await response.text();
          console.error(`API Error ${response.status}: ${errorBody}`);
        }
      } catch (e) {
        console.error(`API Error ${response.status}: ${response.statusText}`);
      }
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody)}`);
    }

    if (response.status === 204) {
      return null;
    }

    if (!isJson) {
      return response.text();
    }

    return response.json();
  }

  private async aiRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.aiBaseURL}${endpoint}`;
    const authToken = this.getAuthToken();
    const tenantId = this.getTenantId();
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = isJson ? JSON.stringify(await response.json()) : await response.text();
      } catch {
        errorBody = response.statusText;
      }
      throw new Error(`AI API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    if (response.status === 204) return null;
    return isJson ? response.json() : response.text();
  }

  setTenantId(tenantId: string) {
    localStorage.setItem(TENANT_KEY, tenantId);
  }

  clearTenantId() {
    localStorage.removeItem(TENANT_KEY);
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    this.sessionExpiredNotified = false;
  }

  clearTokens() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  // Auth
  async register(payload: { email: string; displayName: string; password: string; password_confirm: string; tenant_id?: string }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyEmail(token: string) {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async login(payload: { email: string; password: string; tenant_id?: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async refresh(refreshToken: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async forgotPassword(payload: { email: string; tenant_id?: string }) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async resetPassword(payload: { token: string; newPassword: string; newPassword_confirm: string }) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Tasks
  async getTasks(params: any = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/tasks?${queryString}`);
  }

  async getMyTasks(params: any = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/my-tasks?${queryString}`);
  }

  async getTask(id: string) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(task: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Assignments
  async getTaskAssignees(taskId: string) {
    return this.request(`/tasks/${taskId}/assignees`);
  }

  async updateTaskAssignments(taskId: string, assignments: any) {
    return this.request(`/tasks/${taskId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify(assignments),
    });
  }

  // Comments
  async getTaskComments(taskId: string) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async addTaskComment(taskId: string, body: string) {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async updateTaskComment(commentId: string, body: string) {
    return this.request(`/tasks/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    });
  }

  async deleteTaskComment(commentId: string) {
    return this.request(`/tasks/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Projects
  async getProjects() {
    return this.request('/projects');
  }

  async getGroups() {
    return this.request('/groups');
  }

  async getUsers() {
    return this.request('/users');
  }

  async getFeatureFlags() {
    const tenantId = encodeURIComponent(this.getTenantId());
    return this.request(`/feature-flags/${tenantId}`);
  }

  async createProject(project: any) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, updates: any) {
    return this.request(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Account
  async getProfile() {
    return this.request('/account/me');
  }

  async updateProfile(payload: { displayName: string; email: string; avatarUrl?: string }) {
    return this.request('/account/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.request('/account/password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getSessions() {
    return this.request('/account/sessions');
  }

  async revokeSession(sessionId: string) {
    return this.request(`/account/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  async revokeAllSessions() {
    return this.request('/account/sessions/revoke-all', {
      method: 'POST'
    });
  }

  // Tenant preferences
  async getTenantPreferences() {
    return this.request('/tenants/preferences');
  }

  async updateTenantPreferences(payload: { locale?: string }) {
    return this.request('/tenants/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async seedDefaultProject() {
    return this.request('/projects/seed-default', {
      method: 'POST',
    });
  }

  async aiTaskCreateLite(payload: { description: string; targetLanguage?: string }) {
    return this.aiRequest('/ai/task/create-lite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async aiSemanticSearch(payload: { query: string; limit?: number; projectId?: string | null; status?: string | null }) {
    const normalizedLimit = payload.limit === undefined
      ? undefined
      : Math.max(1, Math.min(5000, Math.trunc(payload.limit)));
    const tenantId = this.getTenantId();

    return this.aiRequest('/ai/search', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        tenantId,
        ...(normalizedLimit === undefined ? {} : { limit: normalizedLimit }),
      }),
    });
  }

  async aiTaskSummarise(payload: { taskId: string }) {
    return this.aiRequest('/ai/task/summarise', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async aiWeeklyDigest(payload?: { projectId?: string | null }) {
    const projectId = payload?.projectId ?? null;
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    return this.aiRequest(`/ai/digest/weekly${query}`, {
      method: 'GET',
    });
  }

  async aiWorkflowSuggest() {
    return this.aiRequest('/ai/workflow/suggest', {
      method: 'GET',
    });
  }

  // Workflows
  async getWorkflows(params: { workspace_id?: string; project_id?: string } = {}) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null) as Array<[string, string]>
    ).toString();
    return this.request(`/workflows${queryString ? `?${queryString}` : ''}`);
  }

  async createWorkflow(payload: {
    workspace_id?: string;
    project_id?: string;
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config?: Record<string, any>;
    actions: Array<{
      action_order: number;
      action_type: string;
      action_config?: Record<string, any>;
    }>;
  }) {
    return this.request('/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateWorkflow(
    id: string,
    payload: {
      name?: string;
      description?: string;
      triggerType?: string;
      triggerConfig?: Record<string, any>;
      isActive?: boolean;
      projectId?: string | null;
      actions?: Array<{
        actionOrder: number;
        actionType: string;
        actionConfig?: Record<string, any>;
      }>;
    }
  ) {
    return this.request(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteWorkflow(id: string) {
    return this.request(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleWorkflow(id: string) {
    return this.request(`/workflows/${id}/toggle`, {
      method: 'POST',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
