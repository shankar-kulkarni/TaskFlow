import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const makeResponse = (data: unknown, ok = true) =>
  ({
    ok,
    json: async () => data,
  } as Response)

describe('Admin UI behavior', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('blocks MEMBER login from admin portal', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        user: { id: 'm1', email: 'member@example.com', displayName: 'Member', role: 'MEMBER' },
        tenantId: 'tenant-a',
        accessToken: 'a',
        refreshToken: 'b',
      }),
    )

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('This account does not have admin access.')).toBeInTheDocument()
    })
  })

  it('shows tenant menu for superadmin after login', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve(
          makeResponse({
            user: { id: 's1', email: 'superadmin@taskflow.local', displayName: 'SA', role: 'OWNER', isSuperAdmin: true },
            tenantId: 'tenant-a',
            accessToken: 'a',
            refreshToken: 'b',
          }),
        )
      }
      if (url.includes('/admin/v1/dashboard')) {
        return Promise.resolve(
          makeResponse({ totals: { tenants: 2, activeUsers: 1, suspendedUsers: 0, projects: 0, tasks: 0 }, recentTenants: [] }),
        )
      }
      if (url.includes('/admin/v1/tenants')) {
        return Promise.resolve(
          makeResponse({
            items: [
              {
                id: 'tenant-a',
                name: 'Tenant A',
                plan: 'Business',
                web_portal_url: 'http://localhost:5175',
                contact_email: 'a@example.com',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              },
              {
                id: 'tenant-b',
                name: 'Tenant B',
                plan: 'Starter',
                web_portal_url: 'http://localhost:5175',
                contact_email: 'b@example.com',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              },
            ],
            total: 2,
          }),
        )
      }
      if (url.includes('/admin/v1/users')) {
        return Promise.resolve(makeResponse({ items: [], total: 0 }))
      }
      return Promise.resolve(makeResponse({ items: [], total: 0 }))
    })

    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Tenant Context')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Users' }))
    await waitFor(() => {
      expect(screen.getByText('Tenant Context')).toBeInTheDocument()
      expect(screen.getByText('Tenant A')).toBeInTheDocument()
      expect(screen.getByText('Tenant B')).toBeInTheDocument()
    })

    const asides = Array.from(container.querySelectorAll('aside'))
    expect(asides.length).toBeGreaterThanOrEqual(2)
    expect(asides[0]?.textContent || '').toContain('Tenant Context')
  })

  it('shows tenants as first module for non-superadmin owners', async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse({
          user: { id: 'o1', email: 'owner@example.com', displayName: 'Owner', role: 'OWNER', isSuperAdmin: false },
          tenantId: 'tenant-a',
          accessToken: 'a',
          refreshToken: 'b',
        }),
      )
      .mockResolvedValue(makeResponse({ totals: { tenants: 1, activeUsers: 1, suspendedUsers: 0, projects: 0, tasks: 0 }, recentTenants: [] }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tenants' })).toBeInTheDocument()
    })
    const menuButtons = screen
      .getAllByRole('button')
      .filter((button) => (button.textContent || '').includes('Tenants') || (button.textContent || '').includes('Dashboard'))
    expect(menuButtons[0]?.textContent || '').toContain('Tenants')
  })

  it('unpin action expands TaskFlow menu after collapse', async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResponse({
          user: { id: 'o1', email: 'owner@example.com', displayName: 'Owner', role: 'OWNER', isSuperAdmin: false },
          tenantId: 'tenant-a',
          accessToken: 'a',
          refreshToken: 'b',
        }),
      )
      .mockResolvedValue(makeResponse({ totals: { tenants: 1, activeUsers: 1, suspendedUsers: 0, projects: 0, tasks: 0 }, recentTenants: [] }))

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pin TaskFlow pane (collapse menu)' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pin TaskFlow pane (collapse menu)' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Unpin TaskFlow pane (expand menu)' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Unpin TaskFlow pane (expand menu)' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pin TaskFlow pane (collapse menu)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Tenants' })).toBeInTheDocument()
    })
  })

  it('opens web portal with impersonation params when impersonate is clicked', async () => {
    const popup = { location: { href: '' }, close: vi.fn() } as any
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup)

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve(
          makeResponse({
            user: { id: 'a1', email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN', isSuperAdmin: false },
            tenantId: 'tenant-a',
            accessToken: 'a',
            refreshToken: 'b',
          }),
        )
      }
      if (url.includes('/admin/v1/dashboard')) {
        return Promise.resolve(
          makeResponse({ totals: { tenants: 1, activeUsers: 1, suspendedUsers: 0, projects: 0, tasks: 0 }, recentTenants: [] }),
        )
      }
      if (url.includes('/admin/v1/tenants')) {
        return Promise.resolve(
          makeResponse({
            items: [
              {
                id: 'tenant-a',
                name: 'Tenant A',
                plan: 'Business',
                web_portal_url: 'http://localhost:5175',
                contact_email: 'a@example.com',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              },
            ],
            total: 1,
          }),
        )
      }
      if (url.includes('/admin/v1/users/u-member/impersonate')) {
        return Promise.resolve(
          makeResponse({
            tenantId: 'tenant-a',
            user: { id: 'u-member', email: 'member@example.com', displayName: 'Member', role: 'MEMBER' },
            accessToken: 'imp-access',
            refreshToken: 'imp-refresh',
          }),
        )
      }
      if (url.includes('/admin/v1/users')) {
        return Promise.resolve(
          makeResponse({
            items: [
              {
                id: 'u-member',
                email: 'member@example.com',
                displayName: 'Member',
                role: 'MEMBER',
                status: 'ACTIVE',
                tenantId: 'tenant-a',
                tenantName: 'Tenant A',
                passwordResetRequired: false,
                lastLoginAt: null,
              },
            ],
            total: 1,
          }),
        )
      }
      return Promise.resolve(makeResponse({ items: [], total: 0 }))
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Users' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Users' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Impersonate' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Impersonate' }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank')
      expect(popup.location.href).toContain('imp_access_token=imp-access')
      expect(popup.location.href).toContain('imp_refresh_token=imp-refresh')
      expect(popup.location.href).toContain('imp_tenant_id=tenant-a')
    })
  })

  it('opens tenant edit dialog from row icon and saves updates', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/v1/auth/login')) {
        return Promise.resolve(
          makeResponse({
            user: { id: 's1', email: 'superadmin@taskflow.local', displayName: 'SA', role: 'OWNER', isSuperAdmin: true },
            tenantId: 'tenant-a',
            accessToken: 'a',
            refreshToken: 'b',
          }),
        )
      }
      if (url.includes('/admin/v1/dashboard')) {
        return Promise.resolve(
          makeResponse({ totals: { tenants: 2, activeUsers: 1, suspendedUsers: 0, projects: 0, tasks: 0 }, recentTenants: [] }),
        )
      }
      if (url.includes('/admin/v1/tenants/tenant-a') && init?.method === 'PATCH') {
        return Promise.resolve(
          makeResponse({
            id: 'tenant-a',
            name: 'Tenant A Updated',
            plan: 'Business',
            timezone: 'UTC',
            web_portal_url: 'http://localhost:5175',
            contact_email: 'updated@example.com',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
          }),
        )
      }
      if (url.includes('/admin/v1/tenants')) {
        return Promise.resolve(
          makeResponse({
            items: [
              {
                id: 'tenant-a',
                name: 'Tenant A',
                plan: 'Business',
                timezone: 'UTC',
                web_portal_url: 'http://localhost:5175',
                contact_email: 'a@example.com',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              },
              {
                id: 'tenant-b',
                name: 'Tenant B',
                plan: 'Starter',
                timezone: 'UTC',
                web_portal_url: 'http://localhost:5175',
                contact_email: 'b@example.com',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
              },
            ],
            total: 2,
          }),
        )
      }
      if (url.includes('/admin/v1/users')) {
        return Promise.resolve(makeResponse({ items: [], total: 0 }))
      }
      return Promise.resolve(makeResponse({ items: [], total: 0 }))
    })

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Tenant Context')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Edit Tenant A' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Tenant A' }))

    await waitFor(() => {
      expect(screen.getByText('Edit Tenant')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Tenant name'), { target: { value: 'Tenant A Updated' } })
    fireEvent.change(screen.getByPlaceholderText('Contact email'), { target: { value: 'updated@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([request, reqInit]) => {
        const requestUrl = String(request)
        const method = (reqInit as RequestInit | undefined)?.method
        return requestUrl.includes('/admin/v1/tenants/tenant-a') && method === 'PATCH'
      })
      expect(patchCall).toBeTruthy()
    })
  })
})
