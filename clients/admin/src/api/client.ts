export type AdminRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST'

export interface LoginResponse {
  user: {
    id: string
    email: string
    displayName: string
    role: AdminRole
    isSuperAdmin?: boolean
  }
  tenantId: string
  accessToken: string
  refreshToken: string
}

export interface DashboardResponse {
  totals: {
    tenants: number
    activeUsers: number
    suspendedUsers: number
    projects: number
    tasks: number
  }
  recentTenants: Array<{
    id: string
    name: string
    plan: string
    status: string
    createdAt: string
  }>
}

export interface TenantRecord {
  id: string
  name: string
  plan: string
  timezone?: string
  web_portal_url: string
  contact_email: string | null
  status: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface TenantAiSettings {
  tenantId: string
  enabled: boolean
  tokensPerMonth: number
}

export interface UserRecord {
  id: string
  email: string
  displayName: string
  role: AdminRole
  status: string
  tenantId: string
  tenantName: string
  passwordResetRequired: boolean
  lastLoginAt: string | null
}

export interface GroupRecord {
  id: string
  name: string
  description: string | null
  color: string | null
  tenantId: string
  tenantName: string
  membersCount: number
  createdAt: string
}

export interface BillingInvoice {
  id: string
  tenantId: string
  tenantName: string
  amount: number
  currency: string
  status: string
  issuedAt: string
}

export interface ImpersonationResponse {
  tenantId: string
  user: {
    id: string
    email: string
    displayName: string
    role: AdminRole
  }
  accessToken: string
  refreshToken: string
}

const AUTH_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3000/api/v1/auth'
const ADMIN_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000/admin/v1'

const getToken = () => localStorage.getItem('admin_access_token') || ''
const getTenantId = () => localStorage.getItem('admin_tenant_id') || ''

const withTenantFilter = (path: string): string => {
  const tenantId = getTenantId()
  if (!tenantId) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}tenantId=${encodeURIComponent(tenantId)}`
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { skipTenantScope?: boolean },
): Promise<T> {
  const token = getToken()
  const tenantId = getTenantId()
  const scopedPath = options?.skipTenantScope ? path : withTenantFilter(path)
  const response = await fetch(`${ADMIN_BASE}${scopedPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!options?.skipTenantScope && tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`
    throw new Error(message)
  }

  return (await response.json()) as T
}

export const adminApi = {
  async login(email: string, password: string, tenantId: string): Promise<LoginResponse> {
    const response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenant_id: tenantId }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Login failed')
    }

    return data as LoginResponse
  },

  async getDashboard() {
    return request<DashboardResponse>('/dashboard')
  },

  async getTenants(search = '') {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    return request<{ items: TenantRecord[]; total: number }>(`/tenants?${params.toString()}`)
  },

  async getTenantsGlobal(search = '') {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    return request<{ items: TenantRecord[]; total: number }>(`/tenants?${params.toString()}`, undefined, {
      skipTenantScope: true,
    })
  },

  async createTenant(payload: { name: string; plan: string; timezone?: string; contact_email?: string; web_portal_url?: string }) {
    return request<TenantRecord>('/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateTenant(id: string, payload: Partial<Pick<TenantRecord, 'name' | 'plan' | 'timezone' | 'status' | 'contact_email' | 'web_portal_url'>>) {
    return request<TenantRecord>(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  async suspendTenant(id: string) {
    return request<TenantRecord>(`/tenants/${id}/suspend`, { method: 'POST' })
  },

  async reinstateTenant(id: string) {
    return request<TenantRecord>(`/tenants/${id}/reinstate`, { method: 'POST' })
  },

  async getUsers(search = '') {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    return request<{ items: UserRecord[]; total: number }>(`/users?${params.toString()}`)
  },

  async createUser(payload: { tenantId: string; email: string; displayName: string; role: AdminRole; password: string }) {
    return request<UserRecord>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async updateUser(id: string, payload: Partial<Pick<UserRecord, 'displayName' | 'email' | 'role' | 'status'>>) {
    return request<UserRecord>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  async deleteUser(id: string) {
    return request<{ deleted: boolean; id: string }>(`/users/${id}`, {
      method: 'DELETE',
    })
  },

  async suspendUser(id: string) {
    return request<UserRecord>(`/users/${id}/suspend`, { method: 'POST' })
  },

  async unsuspendUser(id: string) {
    return request<UserRecord>(`/users/${id}/unsuspend`, { method: 'POST' })
  },

  async forceResetUser(id: string) {
    return request<UserRecord>(`/users/${id}/force-reset`, { method: 'POST' })
  },

  async revokeUserSessions(id: string) {
    return request<{ revoked: number }>(`/users/${id}/revoke-sessions`, { method: 'POST' })
  },

  async impersonateUser(id: string) {
    return request<ImpersonationResponse>(`/users/${id}/impersonate`, { method: 'POST' })
  },

  async bulkSuspendUsers(userIds: string[]) {
    return request<{ updated: number }>('/users/bulk/suspend', {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    })
  },

  async bulkUpdateUserRole(userIds: string[], role: AdminRole) {
    return request<{ updated: number }>('/users/bulk/role', {
      method: 'POST',
      body: JSON.stringify({ userIds, role }),
    })
  },

  async getAudit(limit = 50, filters?: { action?: string; entityType?: string; actorEmail?: string }) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (filters?.action?.trim()) params.set('action', filters.action.trim())
    if (filters?.entityType?.trim()) params.set('entityType', filters.entityType.trim())
    if (filters?.actorEmail?.trim()) params.set('actorEmail', filters.actorEmail.trim())
    return request<{ items: Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string; actorEmail: string | null }> }>(`/audit?${params.toString()}`)
  },

  async getGroups(search = '') {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    return request<{ items: GroupRecord[]; total: number }>(`/groups?${params.toString()}`)
  },

  async createGroup(payload: { tenantId: string; name: string; description?: string; color?: string }) {
    return request<GroupRecord>('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async getBillingOverview() {
    return request<{ activeTenants: number; plans: Array<{ plan: string; count: number }> }>('/billing/overview')
  },

  async getBillingInvoices() {
    return request<{ items: BillingInvoice[]; total: number }>('/billing/invoices')
  },

  async getInfrastructureServices() {
    return request<{ services: Array<{ name: string; status: string }>; stats: { activeUsers: number; projects: number; tasks: number } }>('/infrastructure/services')
  },

  async getAnalyticsPlatform() {
    return request<{ tenants: number; activeUsers: number; projects: number; tasks: number; doneTasks: number; completionRate: number }>('/analytics/platform')
  },

  async getSecurityThreats() {
    return request<{ suspendedUsers: number; suspiciousEvents24h: number; ipBlocks: number; riskLevel: string }>('/security/threats')
  },

  async getFeatureFlags() {
    return request<{ items: Array<{ key: string; enabled: boolean; scope: string }> }>('/feature-flags')
  },

  async toggleFeatureFlag(key: string, enabled: boolean) {
    return request<{ key: string; enabled: boolean; scope: string }>(`/feature-flags/${key}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    })
  },

  async announce(message: string) {
    return request<{ ok: boolean }>('/notifications/announce', {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },

  async getTenantAiSettings(tenantId: string) {
    return request<TenantAiSettings>(`/tenants/${tenantId}/ai-settings`)
  },

  async updateTenantAiSettings(tenantId: string, payload: { enabled: boolean; tokensPerMonth: number }) {
    return request<TenantAiSettings>(`/tenants/${tenantId}/ai-settings`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
}
