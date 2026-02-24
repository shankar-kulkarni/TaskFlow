import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from './client'

describe('adminApi tenant filter behavior', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    } as Response)
    localStorage.setItem('admin_access_token', 'token-123')
    localStorage.setItem('admin_tenant_id', 'tenant-123')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('sends tenant filter and X-Tenant-ID on admin requests', async () => {
    await adminApi.getUsers('john')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/admin/v1/users?q=john&tenantId=tenant-123')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-123')
    expect((init.headers as Record<string, string>)['X-Tenant-ID']).toBe('tenant-123')
  })

  it('sends tenant_id in login payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: 'u1', email: 'a@b.com', displayName: 'A', role: 'ADMIN' },
        tenantId: 'tenant-xyz',
        accessToken: 'a',
        refreshToken: 'b',
      }),
    } as Response)

    await adminApi.login('a@b.com', 'password', 'tenant-xyz')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v1/auth/login')
    expect(String(init.body)).toContain('"tenant_id":"tenant-xyz"')
  })

  it('loads global tenant list without tenant filter header', async () => {
    await adminApi.getTenantsGlobal('acme')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(url).toContain('/admin/v1/tenants?q=acme')
    expect(url).not.toContain('tenantId=')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token-123')
    expect((init.headers as Record<string, string>)['X-Tenant-ID']).toBeUndefined()
  })
})
