import { useEffect, useMemo, useRef, useState } from 'react'
import {
  adminApi,
  type BillingInvoice,
  type DashboardResponse,
  type GroupRecord,
  type LoginResponse,
  type TenantAiSettings,
  type TenantRecord,
  type UserRecord,
} from './api/client'
import { Tooltip } from './components/shared/Tooltip'
import { HelpSection } from './components/shared/HelpSection'

type View =
  | 'dashboard'
  | 'tenants'
  | 'users'
  | 'groups'
  | 'billing'
  | 'infrastructure'
  | 'analytics'
  | 'security'
  | 'settings'
  | 'audit'

type CreateDialog = 'tenant' | 'user' | 'group' | null

type ThemeOption = 'light' | 'high-contrast' | 'monochrome' | 'vibrant'
type LocaleOption = 'en' | 'es' | 'hi' | 'zh'

const localeCodeByOption: Record<LocaleOption, string> = {
  en: 'en-US',
  es: 'es-ES',
  hi: 'hi-IN',
  zh: 'zh-CN',
}

const localeLabel: Record<LocaleOption, string> = {
  en: 'English',
  es: 'Español',
  hi: 'हिन्दी',
  zh: '中文',
}

const fallbackTimezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const allTimezones: string[] = (() => {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    if (typeof intl.supportedValuesOf === 'function') {
      const values = intl.supportedValuesOf('timeZone')
      if (Array.isArray(values) && values.length > 0) {
        return ['UTC', ...values.filter((zone) => zone !== 'UTC')]
      }
    }
  } catch {
    // no-op: fall back to static list
  }
  return fallbackTimezones
})()

const translations: Record<LocaleOption, Record<string, string>> = {
  en: {},
  es: {
    'TaskFlow Admin': 'TaskFlow Administración',
    'Dashboard': 'Panel',
    'Tenants': 'Inquilinos',
    'Users': 'Usuarios',
    'Groups': 'Grupos',
    'Billing': 'Facturación',
    'Infrastructure': 'Infraestructura',
    'Analytics': 'Analítica',
    'Security': 'Seguridad',
    'Preferences': 'Preferencias',
    'Audit Logs': 'Registros de auditoría',
    'Sign Out': 'Cerrar sesión',
    'Loading...': 'Cargando...',
    'Create User': 'Crear usuario',
    'Manage Users': 'Gestionar usuarios',
    'Delete': 'Eliminar',
    'Edit': 'Editar',
    'Save': 'Guardar',
    'Theme': 'Tema',
    'Language': 'Idioma',
    'Search': 'Buscar',
    'Create': 'Crear',
    'Suspend': 'Suspender',
    'Reinstate': 'Restablecer',
    'Unsuspend': 'Quitar suspensión',
    'Force Reset': 'Forzar restablecimiento',
    'Revoke Sessions': 'Revocar sesiones',
    'Bulk Set Role': 'Asignar rol en lote',
    'Bulk Suspend': 'Suspender en lote',
    'Overview': 'Resumen',
    'Invoices': 'Facturas',
    'Service Status': 'Estado de servicios',
    'Workload': 'Carga',
    'Feature Flags': 'Banderas de función',
    'Announcement': 'Anuncio',
    'Apply': 'Aplicar',
    'Enable': 'Habilitar',
    'Disable': 'Deshabilitar',
    'Hide password': 'Ocultar contraseña',
    'Show password': 'Mostrar contraseña',
    'Recent Tenants': 'Inquilinos recientes',
    'Active Users': 'Usuarios activos',
    'Suspended Users': 'Usuarios suspendidos',
    'Completion %': 'Finalización %',
    'Risk Level': 'Nivel de riesgo',
    'Suspicious Events (24h)': 'Eventos sospechosos (24 h)',
    'IP Blocks': 'Bloqueos de IP',
    'Send': 'Enviar',
    'Dashboard Help': 'Ayuda del panel',
    'Tenants Help': 'Ayuda de inquilinos',
    'Users Help': 'Ayuda de usuarios',
    'Groups Help': 'Ayuda de grupos',
    'Billing Help': 'Ayuda de facturación',
    'Infrastructure Help': 'Ayuda de infraestructura',
    'Analytics Help': 'Ayuda de analítica',
    'Security Help': 'Ayuda de seguridad',
    'Settings Help': 'Ayuda de preferencias',
    'Audit Help': 'Ayuda de auditoría',
  },
  hi: {
    'TaskFlow Admin': 'टास्कफ़्लो एडमिन',
    'Dashboard': 'डैशबोर्ड',
    'Tenants': 'टेनेंट',
    'Users': 'उपयोगकर्ता',
    'Groups': 'समूह',
    'Billing': 'बिलिंग',
    'Infrastructure': 'इन्फ्रास्ट्रक्चर',
    'Analytics': 'एनालिटिक्स',
    'Security': 'सुरक्षा',
    'Preferences': 'प्राथमिकताएँ',
    'Audit Logs': 'ऑडिट लॉग',
    'Sign Out': 'साइन आउट',
    'Loading...': 'लोड हो रहा है...',
    'Create User': 'उपयोगकर्ता बनाएं',
    'Manage Users': 'उपयोगकर्ता प्रबंधन',
    'Delete': 'हटाएं',
    'Edit': 'संपादित करें',
    'Save': 'सहेजें',
    'Theme': 'थीम',
    'Language': 'भाषा',
    'Search': 'खोजें',
    'Create': 'बनाएं',
    'Suspend': 'निलंबित करें',
    'Reinstate': 'बहाल करें',
    'Unsuspend': 'निलंबन हटाएं',
    'Force Reset': 'रीसेट लागू करें',
    'Revoke Sessions': 'सेशन रद्द करें',
    'Bulk Set Role': 'भूमिका सामूहिक रूप से सेट करें',
    'Bulk Suspend': 'सामूहिक निलंबन',
    'Overview': 'सारांश',
    'Invoices': 'इनवॉइस',
    'Service Status': 'सेवा स्थिति',
    'Workload': 'वर्कलोड',
    'Feature Flags': 'फीचर फ्लैग',
    'Announcement': 'घोषणा',
    'Apply': 'लागू करें',
    'Enable': 'सक्रिय करें',
    'Disable': 'निष्क्रिय करें',
    'Hide password': 'पासवर्ड छुपाएं',
    'Show password': 'पासवर्ड दिखाएं',
    'Recent Tenants': 'हाल के टेनेंट',
    'Active Users': 'सक्रिय उपयोगकर्ता',
    'Suspended Users': 'निलंबित उपयोगकर्ता',
    'Completion %': 'पूर्णता %',
    'Risk Level': 'जोखिम स्तर',
    'Suspicious Events (24h)': 'संदिग्ध घटनाएँ (24घं)',
    'IP Blocks': 'IP ब्लॉक',
    'Send': 'भेजें',
    'Dashboard Help': 'डैशबोर्ड सहायता',
    'Tenants Help': 'टेनेंट सहायता',
    'Users Help': 'उपयोगकर्ता सहायता',
    'Groups Help': 'समूह सहायता',
    'Billing Help': 'बिलिंग सहायता',
    'Infrastructure Help': 'इन्फ्रास्ट्रक्चर सहायता',
    'Analytics Help': 'एनालिटिक्स सहायता',
    'Security Help': 'सुरक्षा सहायता',
    'Settings Help': 'प्राथमिकता सहायता',
    'Audit Help': 'ऑडिट सहायता',
  },
  zh: {
    'TaskFlow Admin': 'TaskFlow 管理',
    'Dashboard': '仪表板',
    'Tenants': '租户',
    'Users': '用户',
    'Groups': '组',
    'Billing': '计费',
    'Infrastructure': '基础设施',
    'Analytics': '分析',
    'Security': '安全',
    'Preferences': '偏好设置',
    'Audit Logs': '审计日志',
    'Sign Out': '退出登录',
    'Loading...': '加载中...',
    'Create User': '创建用户',
    'Manage Users': '管理用户',
    'Delete': '删除',
    'Edit': '编辑',
    'Save': '保存',
    'Theme': '主题',
    'Language': '语言',
    'Search': '搜索',
    'Create': '创建',
    'Suspend': '暂停',
    'Reinstate': '恢复',
    'Unsuspend': '解除暂停',
    'Force Reset': '强制重置',
    'Revoke Sessions': '撤销会话',
    'Bulk Set Role': '批量设置角色',
    'Bulk Suspend': '批量暂停',
    'Overview': '概览',
    'Invoices': '发票',
    'Service Status': '服务状态',
    'Workload': '工作负载',
    'Feature Flags': '功能开关',
    'Announcement': '公告',
    'Apply': '应用',
    'Enable': '启用',
    'Disable': '禁用',
    'Hide password': '隐藏密码',
    'Show password': '显示密码',
    'Recent Tenants': '最近租户',
    'Active Users': '活跃用户',
    'Suspended Users': '已暂停用户',
    'Completion %': '完成率 %',
    'Risk Level': '风险级别',
    'Suspicious Events (24h)': '可疑事件（24小时）',
    'IP Blocks': 'IP 封锁',
    'Send': '发送',
    'Dashboard Help': '仪表板帮助',
    'Tenants Help': '租户帮助',
    'Users Help': '用户帮助',
    'Groups Help': '组帮助',
    'Billing Help': '计费帮助',
    'Infrastructure Help': '基础设施帮助',
    'Analytics Help': '分析帮助',
    'Security Help': '安全帮助',
    'Settings Help': '偏好帮助',
    'Audit Help': '审计帮助',
  },
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (login: LoginResponse) => void }) {
  const [email, setEmail] = useState('user-1@example.com')
  const [password, setPassword] = useState('Password123!')
  const [tenantId, setTenantId] = useState('saas-test')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const login = await adminApi.login(email, password, tenantId)
      if (!login.user.isSuperAdmin && login.user.role !== 'ADMIN' && login.user.role !== 'OWNER') {
        setError('This account does not have admin access.')
        return
      }
      localStorage.setItem('admin_access_token', login.accessToken)
      localStorage.setItem('admin_user_email', login.user.email)
      localStorage.setItem('admin_user_role', login.user.role)
      localStorage.setItem('admin_user_superadmin', String(Boolean(login.user.isSuperAdmin)))
      localStorage.setItem('admin_tenant_id', login.tenantId)
      onLoggedIn(login)
    } catch (e: any) {
      setError(e.message || 'Unable to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="section-title-row">
          <h1>TaskFlow Admin Portal</h1>
          <HelpSection
            title="Sign-in Help"
            items={[
              'Use a SUPERADMIN, ADMIN, or OWNER account to access admin modules.',
              'Enter tenant id used during login for your seeded/test data.',
              'If sign-in fails, reseed and verify backend is running on port 3001.',
            ]}
          />
        </div>
        <p className="muted">Sign in with a SUPERADMIN, ADMIN, or OWNER account.</p>
        {error && <div className="error">{error}</div>}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [login, setLogin] = useState<LoginResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([])
  const [billingOverview, setBillingOverview] = useState<{ activeTenants: number; plans: Array<{ plan: string; count: number }> } | null>(null)
  const [infrastructure, setInfrastructure] = useState<{ services: Array<{ name: string; status: string }>; stats: { activeUsers: number; projects: number; tasks: number } } | null>(null)
  const [analytics, setAnalytics] = useState<{ tenants: number; activeUsers: number; projects: number; tasks: number; doneTasks: number; completionRate: number } | null>(null)
  const [security, setSecurity] = useState<{ suspendedUsers: number; suspiciousEvents24h: number; ipBlocks: number; riskLevel: string } | null>(null)
  const [featureFlags, setFeatureFlags] = useState<Array<{ key: string; enabled: boolean; scope: string }>>([])
  const [auditRows, setAuditRows] = useState<Array<{ id: string; action: string; entityType: string; entityId: string; createdAt: string; actorEmail: string | null }>>([])

  const [tenantSearch, setTenantSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkRole, setBulkRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST'>('MEMBER')
  const [groupSearch, setGroupSearch] = useState('')
  const [newTenantName, setNewTenantName] = useState('')
  const [newTenantPlan, setNewTenantPlan] = useState('Business')
  const [newTenantTimezone, setNewTenantTimezone] = useState('UTC')
  const [newTenantEmail, setNewTenantEmail] = useState('')
  const [newTenantWebPortalUrl, setNewTenantWebPortalUrl] = useState('http://localhost:5175')
  const [selectedAiTenantId, setSelectedAiTenantId] = useState('saas-test')
  const [tenantAiSettings, setTenantAiSettings] = useState<TenantAiSettings>({
    tenantId: 'saas-test',
    enabled: false,
    tokensPerMonth: 100000,
  })
  const [newGroupTenantId, setNewGroupTenantId] = useState('saas-test')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditEntityFilter, setAuditEntityFilter] = useState('')
  const [auditActorFilter, setAuditActorFilter] = useState('')
  const [locale, setLocale] = useState<LocaleOption>(() => {
    return (localStorage.getItem('admin.locale') as LocaleOption) || 'en'
  })
  const [theme, setTheme] = useState<ThemeOption>(() => {
    return (localStorage.getItem('admin.theme') as ThemeOption) || 'vibrant'
  })

  const [newUserTenantId, setNewUserTenantId] = useState('saas-test')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserDisplayName, setNewUserDisplayName] = useState('')
  const [newUserRole, setNewUserRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST'>('MEMBER')
  const [newUserPassword, setNewUserPassword] = useState('Password123!')
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [tenantOptions, setTenantOptions] = useState<TenantRecord[]>([])
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST'>('MEMBER')
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE')
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [tenantEditName, setTenantEditName] = useState('')
  const [tenantEditPlan, setTenantEditPlan] = useState('Business')
  const [tenantEditTimezone, setTenantEditTimezone] = useState('UTC')
  const [tenantEditStatus, setTenantEditStatus] = useState('active')
  const [tenantEditEmail, setTenantEditEmail] = useState('')
  const [tenantEditWebPortalUrl, setTenantEditWebPortalUrl] = useState('http://localhost:5175')
  const [editTenantDialogOpen, setEditTenantDialogOpen] = useState(false)
  const [tenantPaneWidth, setTenantPaneWidth] = useState(320)
  const [tenantPaneCollapsed, setTenantPaneCollapsed] = useState(false)
  const [adminPaneCollapsed, setAdminPaneCollapsed] = useState(false)
  const [createDialog, setCreateDialog] = useState<CreateDialog>(null)
  const resizingRef = useRef(false)

  const loggedEmail = useMemo(() => login?.user.email || localStorage.getItem('admin_user_email') || '', [login])
  const adminRole = login?.user.role || 'VIEWER'
  const isSuperAdmin = Boolean(login?.user.isSuperAdmin)
  const canManageTenants = isSuperAdmin || adminRole === 'OWNER'
  const canManageUsersAndGroups = isSuperAdmin || adminRole === 'OWNER' || adminRole === 'ADMIN'
  const canViewBilling = isSuperAdmin || adminRole === 'OWNER'
  const canViewOperationalSections = isSuperAdmin || adminRole === 'OWNER' || adminRole === 'ADMIN'
  const canImpersonate = isSuperAdmin || adminRole === 'ADMIN'
  const localeCode = localeCodeByOption[locale]
  const tr = (text: string) => translations[locale]?.[text] || text
  const activeTenantTimezone =
    (isSuperAdmin
      ? tenants.find((tenant) => tenant.id === selectedTenantId)?.timezone
      : tenants[0]?.timezone) || 'UTC'
  const formatNumber = (value: number) => new Intl.NumberFormat(localeCode).format(value)
  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(localeCode, { dateStyle: 'medium', timeStyle: 'short', timeZone: activeTenantTimezone }).format(new Date(value))
  const formatDate = (value: string | Date) =>
    new Intl.DateTimeFormat(localeCode, { dateStyle: 'medium', timeZone: activeTenantTimezone }).format(new Date(value))
  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  useEffect(() => {
    if (view === 'tenants' && !canManageTenants) setView('dashboard')
    if (view === 'users' && !canManageUsersAndGroups) setView('dashboard')
    if (view === 'groups' && !canManageUsersAndGroups) setView('dashboard')
    if (view === 'billing' && !canViewBilling) setView('dashboard')
    if ((view === 'infrastructure' || view === 'analytics' || view === 'security' || view === 'settings' || view === 'audit') && !canViewOperationalSections) {
      setView('dashboard')
    }
  }, [view, canManageTenants, canManageUsersAndGroups, canViewBilling, canViewOperationalSections])

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      setDashboard(await adminApi.getDashboard())
    } catch (e: any) {
      setError(e.message || 'Failed loading dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadTenants = async () => {
    setLoading(true)
    setError('')
    try {
      const result = isSuperAdmin
        ? await adminApi.getTenantsGlobal(tenantSearch)
        : await adminApi.getTenants(tenantSearch)
      const items = Array.isArray(result?.items) ? result.items : []
      setTenants(items)
      setSelectedTenantId((current) => {
        if (items.length === 0) return null
        if (current && items.some((tenant) => tenant.id === current)) return current
        return items[0].id
      })
    } catch (e: any) {
      setError(e.message || 'Failed loading tenants')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.getUsers(userSearch)
      setUsers(Array.isArray(result?.items) ? result.items : [])
      setSelectedUserIds([])
    } catch (e: any) {
      setError(e.message || 'Failed loading users')
    } finally {
      setLoading(false)
    }
  }

  const loadTenantOptions = async () => {
    try {
      const result = isSuperAdmin ? await adminApi.getTenantsGlobal('') : await adminApi.getTenants('')
      const items = Array.isArray(result?.items) ? result.items : []
      setTenantOptions(items)
      if (items.length > 0 && !items.some((tenant) => tenant.id === newUserTenantId)) {
        setNewUserTenantId(items[0].id)
      }
      if (items.length > 0 && !items.some((tenant) => tenant.id === selectedAiTenantId)) {
        setSelectedAiTenantId(items[0].id)
      }
    } catch {
      // keep existing fallback tenant id
    }
  }

  const loadGroups = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.getGroups(groupSearch)
      setGroups(Array.isArray(result?.items) ? result.items : [])
    } catch (e: any) {
      setError(e.message || 'Failed loading groups')
    } finally {
      setLoading(false)
    }
  }

  const loadBilling = async () => {
    setLoading(true)
    setError('')
    try {
      const [overview, invoices] = await Promise.all([adminApi.getBillingOverview(), adminApi.getBillingInvoices()])
      setBillingOverview(overview)
      setBillingInvoices(invoices.items)
    } catch (e: any) {
      setError(e.message || 'Failed loading billing data')
    } finally {
      setLoading(false)
    }
  }

  const loadInfrastructure = async () => {
    setLoading(true)
    setError('')
    try {
      setInfrastructure(await adminApi.getInfrastructureServices())
    } catch (e: any) {
      setError(e.message || 'Failed loading infrastructure data')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setLoading(true)
    setError('')
    try {
      setAnalytics(await adminApi.getAnalyticsPlatform())
    } catch (e: any) {
      setError(e.message || 'Failed loading analytics data')
    } finally {
      setLoading(false)
    }
  }

  const loadSecurity = async () => {
    setLoading(true)
    setError('')
    try {
      const [threats, flags] = await Promise.all([adminApi.getSecurityThreats(), adminApi.getFeatureFlags()])
      setSecurity(threats)
      setFeatureFlags(flags.items)
    } catch (e: any) {
      setError(e.message || 'Failed loading security data')
    } finally {
      setLoading(false)
    }
  }

  const loadAudit = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await adminApi.getAudit(50, {
        action: auditActionFilter,
        entityType: auditEntityFilter,
        actorEmail: auditActorFilter,
      })
      setAuditRows(result.items)
    } catch (e: any) {
      setError(e.message || 'Failed loading audit logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('admin_access_token')
    if (!token) return
    const restoredRole = (localStorage.getItem('admin_user_role') || 'ADMIN') as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'GUEST'
    const restoredSuperAdmin = localStorage.getItem('admin_user_superadmin') === 'true'
    const restoredTenantId = localStorage.getItem('admin_tenant_id') || 'saas-test'
    setLogin({
      user: {
        id: 'unknown',
        email: localStorage.getItem('admin_user_email') || 'admin',
        displayName: 'Admin',
        role: restoredRole,
        isSuperAdmin: restoredSuperAdmin,
      },
      tenantId: restoredTenantId,
      accessToken: token,
      refreshToken: '',
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('admin.theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = localeCode
    document.documentElement.dir = 'ltr'
    localStorage.setItem('admin.locale', locale)
  }, [locale, localeCode])

  useEffect(() => {
    if (!login) return
    if (isSuperAdmin) {
      localStorage.removeItem('admin_tenant_id')
      setSelectedTenantId(null)
      setView('dashboard')
    } else if (canManageTenants) {
      setView('tenants')
    }
  }, [login, isSuperAdmin, canManageTenants])

  useEffect(() => {
    if (!isSuperAdmin) return
    const onMouseMove = (event: MouseEvent) => {
      if (!resizingRef.current || tenantPaneCollapsed) return
      const next = Math.max(260, Math.min(520, event.clientX))
      setTenantPaneWidth(next)
    }
    const onMouseUp = () => {
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isSuperAdmin, tenantPaneCollapsed])

  useEffect(() => {
    if (!login) return
    void loadTenantOptions()
    if (isSuperAdmin) {
      void loadTenants()
      if (!selectedTenantId) {
        return
      }
    }
    if (view === 'dashboard') {
      void loadDashboard()
    } else if (view === 'tenants' && canManageTenants && !isSuperAdmin) {
      void loadTenants()
    } else if (view === 'users' && canManageUsersAndGroups) {
      void loadUsers()
    } else if (view === 'groups' && canManageUsersAndGroups) {
      void loadGroups()
    } else if (view === 'billing' && canViewBilling) {
      void loadBilling()
    } else if (view === 'infrastructure' && canViewOperationalSections) {
      void loadInfrastructure()
    } else if (view === 'analytics' && canViewOperationalSections) {
      void loadAnalytics()
    } else if (view === 'security' && canViewOperationalSections) {
      void loadSecurity()
    } else if (view === 'settings' && canViewOperationalSections) {
      void loadSecurity()
    } else if (view === 'audit' && canViewOperationalSections) {
      void loadAudit()
    }
  }, [view, login, canManageTenants, canManageUsersAndGroups, canViewBilling, canViewOperationalSections, isSuperAdmin, selectedTenantId])

  useEffect(() => {
    if (!login || view !== 'tenants' || !selectedAiTenantId) return
    void loadTenantAiSettings(selectedAiTenantId)
  }, [login, view, selectedAiTenantId])

  useEffect(() => {
    if (!isSuperAdmin || !selectedTenantId) return
    localStorage.setItem('admin_tenant_id', selectedTenantId)
    setSelectedAiTenantId(selectedTenantId)
    setNewUserTenantId(selectedTenantId)
    setNewGroupTenantId(selectedTenantId)
  }, [isSuperAdmin, selectedTenantId])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const controls = Array.from(document.querySelectorAll('button,input,select,textarea')) as Array<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >

    controls.forEach((control) => {
      if (control.title && control.title.trim()) return
      const placeholder = 'placeholder' in control ? (control as HTMLInputElement).placeholder : ''
      const ariaLabel = control.getAttribute('aria-label') || ''
      const text = control.textContent?.trim() || ''
      const derived = placeholder || ariaLabel || text
      if (derived) {
        control.title = derived
      }
    })
  }, [view, users, tenants, groups, featureFlags, locale, theme])

  if (!login) {
    return <LoginScreen onLoggedIn={setLogin} />
  }

  const createTenant = async () => {
    if (!newTenantName.trim()) return false
    setError('')
    try {
      await adminApi.createTenant({
        name: newTenantName.trim(),
        plan: newTenantPlan,
        timezone: newTenantTimezone.trim() || 'UTC',
        contact_email: newTenantEmail.trim() || undefined,
        web_portal_url: newTenantWebPortalUrl.trim() || 'http://localhost:5175',
      })
      setNewTenantName('')
      setNewTenantTimezone('UTC')
      setNewTenantEmail('')
      setNewTenantWebPortalUrl('http://localhost:5175')
      await loadTenants()
      return true
    } catch (e: any) {
      setError(e.message || 'Create tenant failed')
      return false
    }
  }

  const saveSelectedTenantDetails = async () => {
    if (!selectedTenantId || !isSuperAdmin) return
    setError('')
    try {
      await adminApi.updateTenant(selectedTenantId, {
        name: tenantEditName.trim(),
        plan: tenantEditPlan.trim(),
        timezone: tenantEditTimezone.trim() || 'UTC',
        status: tenantEditStatus.trim(),
        contact_email: tenantEditEmail.trim() || null,
        web_portal_url: tenantEditWebPortalUrl.trim() || 'http://localhost:5175',
      })
      await loadTenants()
      setEditTenantDialogOpen(false)
    } catch (e: any) {
      setError(e.message || 'Update tenant failed')
    }
  }

  const loadTenantAiSettings = async (tenantId: string) => {
    if (!tenantId) return
    setError('')
    try {
      const settings = await adminApi.getTenantAiSettings(tenantId)
      setTenantAiSettings(settings)
    } catch (e: any) {
      setError(e.message || 'Failed loading AI settings')
    }
  }

  const saveTenantAiSettings = async () => {
    if (!selectedAiTenantId.trim()) return
    setError('')
    try {
      const updated = await adminApi.updateTenantAiSettings(selectedAiTenantId, {
        enabled: tenantAiSettings.enabled,
        tokensPerMonth: tenantAiSettings.tokensPerMonth,
      })
      setTenantAiSettings(updated)
    } catch (e: any) {
      setError(e.message || 'Failed updating AI settings')
    }
  }

  const createGroup = async () => {
    if (!newGroupName.trim() || !newGroupTenantId.trim()) {
      return false
    }

    setError('')
    try {
      await adminApi.createGroup({
        tenantId: newGroupTenantId.trim(),
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      })
      setNewGroupName('')
      setNewGroupDescription('')
      await loadGroups()
      return true
    } catch (e: any) {
      setError(e.message || 'Create group failed')
      return false
    }
  }

  const sendAnnouncement = async () => {
    if (!announcement.trim()) {
      return
    }

    setError('')
    try {
      await adminApi.announce(announcement.trim())
      setAnnouncement('')
    } catch (e: any) {
      setError(e.message || 'Announcement failed')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  const runBulkSuspend = async () => {
    if (selectedUserIds.length === 0) {
      return
    }
    setError('')
    try {
      await adminApi.bulkSuspendUsers(selectedUserIds)
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Bulk suspend failed')
    }
  }

  const runBulkRoleUpdate = async () => {
    if (selectedUserIds.length === 0) {
      return
    }
    setError('')
    try {
      await adminApi.bulkUpdateUserRole(selectedUserIds, bulkRole)
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Bulk role update failed')
    }
  }

  const toggleFlag = async (key: string, enabled: boolean) => {
    setError('')
    try {
      await adminApi.toggleFeatureFlag(key, enabled)
      const nextFlags = await adminApi.getFeatureFlags()
      setFeatureFlags(nextFlags.items)
    } catch (e: any) {
      setError(e.message || 'Feature flag update failed')
    }
  }

  const createUser = async () => {
    if (!newUserTenantId.trim() || !newUserEmail.trim() || !newUserDisplayName.trim() || !newUserPassword.trim()) {
      return false
    }

    setError('')
    try {
      await adminApi.createUser({
        tenantId: newUserTenantId.trim(),
        email: newUserEmail.trim(),
        displayName: newUserDisplayName.trim(),
        role: newUserRole,
        password: newUserPassword,
      })
      setNewUserEmail('')
      setNewUserDisplayName('')
      setNewUserRole('MEMBER')
      setNewUserPassword('Password123!')
      setShowNewUserPassword(false)
      await loadUsers()
      return true
    } catch (e: any) {
      setError(e.message || 'Create user failed')
      return false
    }
  }

  const beginEditUser = (user: UserRecord) => {
    setEditingUserId(user.id)
    setEditDisplayName(user.displayName)
    setEditEmail(user.email)
    setEditRole(user.role)
    setEditStatus(user.status as any)
    setEditUserDialogOpen(true)
  }

  const saveEditUser = async () => {
    if (!editingUserId) return
    setError('')
    try {
      await adminApi.updateUser(editingUserId, {
        displayName: editDisplayName,
        email: editEmail,
        role: editRole,
        status: editStatus,
      })
      setEditingUserId(null)
      setEditUserDialogOpen(false)
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Update user failed')
    }
  }

  const deleteUser = async (id: string) => {
    setError('')
    try {
      await adminApi.deleteUser(id)
      await loadUsers()
    } catch (e: any) {
      setError(e.message || 'Delete user failed')
    }
  }

  const helpByView: Record<View, { title: string; items: string[] }> = {
    dashboard: {
      title: tr('Dashboard Help'),
      items: [tr('Review tenant/platform KPIs'), tr('Check recent tenants'), tr('Use sidebar to switch modules')],
    },
    tenants: {
      title: tr('Tenants Help'),
      items: [tr('Create tenants with plan and email'), tr('Suspend/reinstate tenants'), tr('Use search to filter tenants')],
    },
    users: {
      title: tr('Users Help'),
      items: [tr('Create, edit, and delete users'), tr('Run bulk role/suspend actions'), tr('Force reset and revoke sessions')],
    },
    groups: {
      title: tr('Groups Help'),
      items: [tr('Create tenant groups'), tr('Review membership counts'), tr('Use search for quick filtering')],
    },
    billing: {
      title: tr('Billing Help'),
      items: [tr('Check plan distribution'), tr('Review invoice statuses'), tr('Use for finance operations handoff')],
    },
    infrastructure: {
      title: tr('Infrastructure Help'),
      items: [tr('Monitor service health'), tr('Track project/task load'), tr('Use alongside SRE checks')],
    },
    analytics: {
      title: tr('Analytics Help'),
      items: [tr('Watch completion trends'), tr('Track active user growth'), tr('Use metrics for planning')],
    },
    security: {
      title: tr('Security Help'),
      items: [tr('Monitor risk indicators'), tr('Manage feature flags safely'), tr('Send controlled announcements')],
    },
    settings: {
      title: tr('Settings Help'),
      items: [tr('Change language preferences'), tr('Switch visual theme'), tr('Persist preferences locally')],
    },
    audit: {
      title: tr('Audit Help'),
      items: [tr('Filter by action/entity/actor'), tr('Review latest admin actions'), tr('Use for incident investigations')],
    },
  }

  const detailHelp = {
    recentTenants: {
      title: tr('Recent Tenants Help'),
      items: [tr('Review newly created tenants'), tr('Confirm plan and status quickly')],
    },
    createTenant: {
      title: tr('Create Tenant Help'),
      items: [tr('Provide tenant name and plan'), tr('Add contact email for billing and support')],
    },
    createUser: {
      title: tr('Create User Help'),
      items: [tr('Assign user to the correct tenant'), tr('Set role and initial password securely')],
    },
    manageUsers: {
      title: tr('Manage Users Help'),
      items: [tr('Filter users then run safe bulk actions'), tr('Use force reset and session revoke carefully')],
    },
    createGroup: {
      title: tr('Create Group Help'),
      items: [tr('Create logical groups per tenant'), tr('Use clear names for access governance')],
    },
    billingOverview: {
      title: tr('Billing Overview Help'),
      items: [tr('Review active tenants and plan distribution'), tr('Use this summary before invoice operations')],
    },
    invoices: {
      title: tr('Invoices Help'),
      items: [tr('Track invoice status and issue dates'), tr('Use for finance reconciliation')],
    },
    serviceStatus: {
      title: tr('Service Status Help'),
      items: [tr('Check platform service health quickly'), tr('Investigate degraded services first')],
    },
    workload: {
      title: tr('Workload Help'),
      items: [tr('Monitor project/task volume'), tr('Use trend with analytics for capacity planning')],
    },
    featureFlags: {
      title: tr('Feature Flags Help'),
      items: [tr('Toggle features carefully in production'), tr('Audit flag changes after updates')],
    },
    announcement: {
      title: tr('Announcement Help'),
      items: [tr('Send concise platform-wide updates'), tr('Avoid sharing sensitive information')],
    },
    language: {
      title: tr('Language Help'),
      items: [tr('Choose preferred interface language'), tr('Changes apply across admin portal')],
    },
    theme: {
      title: tr('Theme Help'),
      items: [tr('Choose visual theme for readability'), tr('Preference persists for next sign-in')],
    },
  }

  const impersonateUser = async (user: UserRecord) => {
    const popup = window.open('about:blank', '_blank')
    if (popup?.document) {
      popup.document.title = 'Opening TaskFlow...'
      popup.document.body.style.margin = '0'
      popup.document.body.style.fontFamily = 'Segoe UI, Arial, sans-serif'
      popup.document.body.style.background = '#0f141b'
      popup.document.body.style.color = '#e8ecf1'
      popup.document.body.style.display = 'grid'
      popup.document.body.style.placeItems = 'center'
      popup.document.body.textContent = 'Opening TaskFlow...'
    }
    setError('')
    try {
      const session = await adminApi.impersonateUser(user.id)
      const tenantForUser = tenants.find((tenant) => tenant.id === session.tenantId || tenant.id === user.tenantId)
      const webPortalUrl = String(
        tenantForUser?.web_portal_url || import.meta.env.VITE_WEB_PORTAL_URL || 'http://localhost:5175',
      ).replace(/\/+$/, '')
      const params = new URLSearchParams({
        imp_access_token: session.accessToken,
        imp_refresh_token: session.refreshToken,
        imp_tenant_id: session.tenantId,
        imp_user: JSON.stringify(session.user),
      })
      const targetUrl = `${webPortalUrl}/?${params.toString()}`
      if (popup) {
        if (typeof popup.location?.replace === 'function') {
          popup.location.replace(targetUrl)
        } else {
          popup.location.href = targetUrl
        }
      } else {
        const opened = window.open(targetUrl, '_blank')
        if (!opened) window.location.assign(targetUrl)
      }
    } catch (e: any) {
      if (popup) {
        popup.close()
      }
      setError(e.message || 'Impersonation failed')
    }
  }

  const requiresTenantSelection = isSuperAdmin && !selectedTenantId

  const setActiveTenantScope = (tenantId: string) => {
    setSelectedTenantId(tenantId)
    localStorage.setItem('admin_tenant_id', tenantId)
    setSelectedAiTenantId(tenantId)
    setNewUserTenantId(tenantId)
    setNewGroupTenantId(tenantId)
    setView('dashboard')
  }

  const navIcons: Record<string, string> = {
    Tenants: '🏢',
    Dashboard: '📊',
    Users: '👥',
    Groups: '🧩',
    Billing: '💳',
    Infrastructure: '🛠',
    Analytics: '📈',
    Security: '🛡',
    Preferences: '⚙',
    'Audit Logs': '🧾',
    'Sign Out': '➜]',
  }

  const renderMenuLabel = (key: keyof typeof navIcons, text: string) => {
    if (adminPaneCollapsed) return <span className="menu-icon" aria-hidden="true">{navIcons[key]}</span>
    return (
      <span className="menu-item-content">
        <span className="menu-icon" aria-hidden="true">{navIcons[key]}</span>
        <span className="menu-text">{text}</span>
      </span>
    )
  }

  const menuButtonTitle = (label: string) => (adminPaneCollapsed ? label : undefined)

  const openCreateDialog = (dialog: Exclude<CreateDialog, null>) => setCreateDialog(dialog)
  const closeCreateDialog = () => setCreateDialog(null)

  const submitCreateTenant = async () => {
    const ok = await createTenant()
    if (ok) closeCreateDialog()
  }

  const submitCreateUser = async () => {
    const ok = await createUser()
    if (ok) closeCreateDialog()
  }

  const submitCreateGroup = async () => {
    const ok = await createGroup()
    if (ok) closeCreateDialog()
  }

  const openEditTenantDialog = (tenant: TenantRecord) => {
    setSelectedTenantId(tenant.id)
    setTenantEditName(tenant.name || '')
    setTenantEditPlan(tenant.plan || 'Business')
    setTenantEditTimezone(tenant.timezone || 'UTC')
    setTenantEditStatus(tenant.status || 'active')
    setTenantEditEmail(tenant.contact_email || '')
    setTenantEditWebPortalUrl(tenant.web_portal_url || 'http://localhost:5175')
    setEditTenantDialogOpen(true)
  }

  // Show action icon: collapsed => click to unpin/expand, expanded => click to pin/collapse.
  const renderPinToggleIcon = (collapsed: boolean) => <span aria-hidden="true">{collapsed ? '📍' : '📌'}</span>

  return (
    <div
      className={`admin-layout ${isSuperAdmin ? 'superadmin-layout' : ''}`}
      style={
        isSuperAdmin
          ? { gridTemplateColumns: `${tenantPaneCollapsed ? 56 : tenantPaneWidth}px ${adminPaneCollapsed ? 72 : 240}px minmax(0, 1fr)` }
          : { gridTemplateColumns: `${adminPaneCollapsed ? 72 : 240}px minmax(0, 1fr)` }
      }
    >
      {isSuperAdmin && (
        <aside className="tenant-context-sidebar">
          <div className="tenant-pane-head">
            <div className="brand"><span className="menu-icon">🏢</span><span className="menu-text">{tenantPaneCollapsed ? 'TC' : 'Tenant Context'}</span></div>
            <button
              className="secondary icon-btn pane-pin-btn"
              type="button"
              onClick={() => setTenantPaneCollapsed((current) => !current)}
              title={tenantPaneCollapsed ? 'Unpin tenant context (expand pane)' : 'Pin tenant context (collapse pane)'}
              aria-label={tenantPaneCollapsed ? 'Unpin tenant context (expand pane)' : 'Pin tenant context (collapse pane)'}
            >
              {renderPinToggleIcon(tenantPaneCollapsed)}
            </button>
          </div>
          {tenantPaneCollapsed ? (
            <div className="collapsed-icons">
              <button className="secondary collapsed-icon-btn" type="button" title="Tenant list">🏢</button>
              <button className="secondary collapsed-icon-btn" type="button" title="Search tenants" onClick={() => void loadTenants()}>🔎</button>
              <button className="secondary collapsed-icon-btn" type="button" title="Create tenant" onClick={() => openCreateDialog('tenant')}>➕</button>
            </div>
          ) : (
            <>
              <div className="toolbar">
                <input placeholder="Search tenants" value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} />
                <button className="secondary" type="button" onClick={() => void loadTenants()}>{tr('Search')}</button>
              </div>
              <div className="tenant-list">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className={`tenant-item ${selectedTenantId === tenant.id ? 'selected' : ''}`}>
                    <button type="button" className="tenant-item-main" onClick={() => setActiveTenantScope(tenant.id)}>
                      <strong>{tenant.name}</strong>
                      <div className="tenant-item-meta">
                        <span>{tenant.plan}</span>
                        <span>{tenant.status}</span>
                      </div>
                      <div className="muted">{tenant.id}</div>
                    </button>
                    <button
                      type="button"
                      className="secondary icon-btn tenant-edit-btn"
                      onClick={() => openEditTenantDialog(tenant)}
                      title={`Edit ${tenant.name}`}
                      aria-label={`Edit ${tenant.name}`}
                    >
                      ✎
                    </button>
                  </div>
                ))}
                {tenants.length === 0 && <p className="muted">{tr('No tenants match your search.')}</p>}
              </div>
              <div className="create-launch-row">
                <button type="button" onClick={() => openCreateDialog('tenant')}>➕ {tr('Create Tenant')}</button>
              </div>
            </>
          )}
          <div
            className="pane-resizer"
            onMouseDown={() => {
              if (tenantPaneCollapsed) return
              resizingRef.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize tenant context"
          />
        </aside>
      )}
      <aside className={`sidebar ${adminPaneCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="tenant-pane-head">
          <div className="brand"><span className="menu-icon">🧭</span><span className="menu-text">{adminPaneCollapsed ? '' : 'TaskFlow Admin'}</span></div>
          <button
            className="secondary icon-btn pane-pin-btn"
            type="button"
              onClick={() => setAdminPaneCollapsed((current) => !current)}
            title={adminPaneCollapsed ? 'Unpin TaskFlow pane (expand menu)' : 'Pin TaskFlow pane (collapse menu)'}
            aria-label={adminPaneCollapsed ? 'Unpin TaskFlow pane (expand menu)' : 'Pin TaskFlow pane (collapse menu)'}
          >
            {renderPinToggleIcon(adminPaneCollapsed)}
          </button>
        </div>
        {!adminPaneCollapsed && <div className="muted" style={{ marginBottom: 16 }}>{loggedEmail}</div>}
        <div className="menu">
          {!isSuperAdmin && canManageTenants && (
            <button className={view === 'tenants' ? 'active' : ''} onClick={() => setView('tenants')} title={menuButtonTitle(tr('Tenants'))}>
              {renderMenuLabel('Tenants', tr('Tenants'))}
            </button>
          )}
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')} title={menuButtonTitle(tr('Dashboard'))}>
            {renderMenuLabel('Dashboard', tr('Dashboard'))}
          </button>
          {canManageUsersAndGroups && (
            <button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')} title={menuButtonTitle(tr('Users'))}>
              {renderMenuLabel('Users', tr('Users'))}
            </button>
          )}
          {canManageUsersAndGroups && (
            <button className={view === 'groups' ? 'active' : ''} onClick={() => setView('groups')} title={menuButtonTitle(tr('Groups'))}>
              {renderMenuLabel('Groups', tr('Groups'))}
            </button>
          )}
          {canViewBilling && (
            <button className={view === 'billing' ? 'active' : ''} onClick={() => setView('billing')} title={menuButtonTitle(tr('Billing'))}>
              {renderMenuLabel('Billing', tr('Billing'))}
            </button>
          )}
          {canViewOperationalSections && (
            <button className={view === 'infrastructure' ? 'active' : ''} onClick={() => setView('infrastructure')} title={menuButtonTitle(tr('Infrastructure'))}>
              {renderMenuLabel('Infrastructure', tr('Infrastructure'))}
            </button>
          )}
          {canViewOperationalSections && (
            <button className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')} title={menuButtonTitle(tr('Analytics'))}>
              {renderMenuLabel('Analytics', tr('Analytics'))}
            </button>
          )}
          {canViewOperationalSections && (
            <button className={view === 'security' ? 'active' : ''} onClick={() => setView('security')} title={menuButtonTitle(tr('Security'))}>
              {renderMenuLabel('Security', tr('Security'))}
            </button>
          )}
          {canViewOperationalSections && (
            <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} title={menuButtonTitle(tr('Preferences'))}>
              {renderMenuLabel('Preferences', tr('Preferences'))}
            </button>
          )}
          {canViewOperationalSections && (
            <button className={view === 'audit' ? 'active' : ''} onClick={() => setView('audit')} title={menuButtonTitle(tr('Audit Logs'))}>
              {renderMenuLabel('Audit Logs', tr('Audit Logs'))}
            </button>
          )}
          <button
            className="secondary"
            title={menuButtonTitle(tr('Sign Out'))}
            onClick={() => {
              localStorage.removeItem('admin_access_token')
              localStorage.removeItem('admin_user_email')
              localStorage.removeItem('admin_user_role')
              localStorage.removeItem('admin_user_superadmin')
              localStorage.removeItem('admin_tenant_id')
              setLogin(null)
            }}
          >
            {renderMenuLabel('Sign Out', tr('Sign Out'))}
          </button>
        </div>
      </aside>
      <main className="content">
        <section className="content-main">
        {error && <div className="error">{error}</div>}
        {loading && <p className="muted">{tr('Loading...')}</p>}

        {view === 'dashboard' && dashboard && (
          <>
            <div className="section-title-row">
              <h2>{tr('Dashboard')}</h2>
              <HelpSection title={helpByView.dashboard.title} items={helpByView.dashboard.items} />
            </div>
            <div className="grid">
              {isSuperAdmin && <div className="panel kpi"><div className="label">{tr('Tenants')}</div><div className="value">{formatNumber(dashboard.totals.tenants)}</div></div>}
              <div className="panel kpi"><div className="label">{tr('Active Users')}</div><div className="value">{formatNumber(dashboard.totals.activeUsers)}</div></div>
              <div className="panel kpi"><div className="label">{tr('Suspended Users')}</div><div className="value">{formatNumber(dashboard.totals.suspendedUsers)}</div></div>
              <div className="panel kpi"><div className="label">{tr('Projects')}</div><div className="value">{formatNumber(dashboard.totals.projects)}</div></div>
              <div className="panel kpi"><div className="label">{tr('Tasks')}</div><div className="value">{formatNumber(dashboard.totals.tasks)}</div></div>
            </div>
            {isSuperAdmin && <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Recent Tenants')}</h3>
                <HelpSection title={detailHelp.recentTenants.title} items={detailHelp.recentTenants.items} />
              </div>
              <table>
                <thead>
                  <tr><th>Name</th><th>Plan</th><th>Status</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {dashboard.recentTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.plan}</td>
                      <td>{tenant.status}</td>
                      <td>{formatDateTime(tenant.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </>
        )}

        {requiresTenantSelection && (
          <div className="panel">
            <p className="muted">{tr('Select a tenant from Tenant Context to continue.')}</p>
          </div>
        )}

        {!requiresTenantSelection && view === 'tenants' && canManageTenants && !isSuperAdmin && (
          <>
            <div className="section-title-row">
              <h2>{tr('Tenants')}</h2>
              <HelpSection title={helpByView.tenants.title} items={helpByView.tenants.items} />
            </div>
            <div className="create-launch-row">
              <button type="button" onClick={() => openCreateDialog('tenant')}>➕ {tr('Create Tenant')}</button>
            </div>

            <div className="panel">
              <div className="toolbar">
                <input placeholder="Search tenants" value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} />
                <button className="secondary" onClick={() => void loadTenants()}>{tr('Search')}</button>
              </div>
              <table>
                <thead>
                  <tr><th>Name</th><th>Plan</th><th>Timezone</th><th>Status</th><th>Contact</th><th>Web URL</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.name}</td>
                      <td>{tenant.plan}</td>
                      <td>{tenant.timezone || 'UTC'}</td>
                      <td>{tenant.status}</td>
                      <td>{tenant.contact_email || '-'}</td>
                      <td>{tenant.web_portal_url || 'http://localhost:5175'}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => void adminApi.suspendTenant(tenant.id).then(loadTenants)}>{tr('Suspend')}</button>
                          <button className="secondary" onClick={() => void adminApi.reinstateTenant(tenant.id).then(loadTenants)}>{tr('Reinstate')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="detail-title-row">
                <h3>AI Controls</h3>
                <HelpSection
                  title="AI Controls Help"
                  items={[
                    'Enable or disable AI features for a tenant.',
                    'Set monthly token limit used by AI gateway enforcement.',
                  ]}
                />
              </div>
              <div className="toolbar">
                <select
                  value={selectedAiTenantId}
                  onChange={(e) => setSelectedAiTenantId(e.target.value)}
                >
                  {tenantOptions.length === 0 ? (
                    <option value="saas-test">saas-test</option>
                  ) : (
                    tenantOptions.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.id})
                      </option>
                    ))
                  )}
                </select>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={tenantAiSettings.enabled}
                    onChange={(e) =>
                      setTenantAiSettings((current) => ({ ...current, enabled: e.target.checked, tenantId: selectedAiTenantId }))
                    }
                  />
                  AI Enabled
                </label>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  placeholder="Tokens per month"
                  value={tenantAiSettings.tokensPerMonth}
                  onChange={(e) =>
                    setTenantAiSettings((current) => ({
                      ...current,
                      tenantId: selectedAiTenantId,
                      tokensPerMonth: Number(e.target.value || 0),
                    }))
                  }
                />
                <button className="secondary" onClick={() => void loadTenantAiSettings(selectedAiTenantId)}>
                  Refresh
                </button>
                <button onClick={saveTenantAiSettings}>Save AI Settings</button>
              </div>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'users' && canManageUsersAndGroups && (
          <>
            <div className="section-title-row">
              <h2>{tr('Users')}</h2>
              <HelpSection title={helpByView.users.title} items={helpByView.users.items} />
            </div>
            <div className="create-launch-row">
              <button type="button" onClick={() => openCreateDialog('user')}>➕ {tr('Create User')}</button>
            </div>

            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Manage Users')}</h3>
                <HelpSection title={detailHelp.manageUsers.title} items={detailHelp.manageUsers.items} />
              </div>
              <div className="toolbar">
                <input placeholder="Search users" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                <button className="secondary" onClick={() => void loadUsers()}>{tr('Search')}</button>
                <select value={bulkRole} onChange={(e) => setBulkRole(e.target.value as any)}>
                  {(isSuperAdmin || adminRole === 'OWNER') && <option value="OWNER">OWNER</option>}
                  {(isSuperAdmin || adminRole === 'OWNER') && <option value="ADMIN">ADMIN</option>}
                  <option value="MEMBER">MEMBER</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="GUEST">GUEST</option>
                </select>
                <button className="secondary" onClick={runBulkRoleUpdate}>{tr('Bulk Set Role')}</button>
                <button className="warn" onClick={runBulkSuspend}>{tr('Bulk Suspend')}</button>
              </div>
              <table>
                <thead>
                  <tr><th>Select</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Tenant</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
                      <td>{user.displayName}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.status}</td>
                      <td>{user.tenantName}</td>
                      <td>
                        <div className="actions">
                          <button className="secondary" onClick={() => beginEditUser(user)}>{tr('Edit')}</button>
                          <button
                            className="secondary"
                            onClick={() =>
                              void (user.status === 'SUSPENDED'
                                ? adminApi.unsuspendUser(user.id).then(loadUsers)
                                : adminApi.suspendUser(user.id).then(loadUsers))
                            }
                          >
                            {user.status === 'SUSPENDED' ? tr('Unsuspend') : tr('Suspend')}
                          </button>
                          <button className="warn" onClick={() => void adminApi.forceResetUser(user.id).then(loadUsers)}>{tr('Force Reset')}</button>
                          <button className="secondary" onClick={() => void adminApi.revokeUserSessions(user.id)}>{tr('Revoke Sessions')}</button>
                          {canImpersonate && <button className="secondary" onClick={() => void impersonateUser(user)}>Impersonate</button>}
                          <button className="warn" onClick={() => void deleteUser(user.id)}>{tr('Delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'groups' && canManageUsersAndGroups && (
          <>
            <div className="section-title-row">
              <h2>{tr('Groups')}</h2>
              <HelpSection title={helpByView.groups.title} items={helpByView.groups.items} />
            </div>
            <div className="create-launch-row">
              <button type="button" onClick={() => openCreateDialog('group')}>➕ {tr('Create Group')}</button>
            </div>

            <div className="panel">
              <div className="toolbar">
                <input placeholder="Search groups" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
                <button className="secondary" onClick={() => void loadGroups()}>{tr('Search')}</button>
              </div>
              <table>
                <thead>
                  <tr><th>Name</th><th>Tenant</th><th>Members</th><th>Description</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.id}>
                      <td>{group.name}</td>
                      <td>{group.tenantName}</td>
                      <td>{formatNumber(group.membersCount)}</td>
                      <td>{group.description || '-'}</td>
                      <td>{formatDateTime(group.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'billing' && canViewBilling && (
          <>
            <div className="section-title-row">
              <h2>{tr('Billing')}</h2>
              <HelpSection title={helpByView.billing.title} items={helpByView.billing.items} />
            </div>
            {billingOverview && (
              <div className="panel">
                <div className="detail-title-row">
                  <h3>{tr('Overview')}</h3>
                  <HelpSection title={detailHelp.billingOverview.title} items={detailHelp.billingOverview.items} />
                </div>
                <p>{tr('Active Tenants')}: <strong>{formatNumber(billingOverview.activeTenants)}</strong></p>
                <div className="actions">
                  {billingOverview.plans.map((plan) => (
                    <span key={plan.plan} className="muted">{plan.plan}: {formatNumber(plan.count)}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Invoices')}</h3>
                <HelpSection title={detailHelp.invoices.title} items={detailHelp.invoices.items} />
              </div>
              <table>
                <thead>
                  <tr><th>Invoice</th><th>Tenant</th><th>Amount</th><th>Status</th><th>Issued</th></tr>
                </thead>
                <tbody>
                  {billingInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.id}</td>
                      <td>{invoice.tenantName}</td>
                      <td>{formatCurrency(invoice.amount, invoice.currency)}</td>
                      <td>{invoice.status}</td>
                      <td>{formatDate(invoice.issuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'infrastructure' && canViewOperationalSections && (
          <>
            <div className="section-title-row">
              <h2>{tr('Infrastructure')}</h2>
              <HelpSection title={helpByView.infrastructure.title} items={helpByView.infrastructure.items} />
            </div>
            {infrastructure && (
              <>
                <div className="panel">
                  <div className="detail-title-row">
                    <h3>{tr('Service Status')}</h3>
                    <HelpSection title={detailHelp.serviceStatus.title} items={detailHelp.serviceStatus.items} />
                  </div>
                  <table>
                    <thead>
                      <tr><th>Service</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {infrastructure.services.map((service) => (
                        <tr key={service.name}>
                          <td>{service.name}</td>
                          <td>{service.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel">
                  <div className="detail-title-row">
                    <h3>{tr('Workload')}</h3>
                    <HelpSection title={detailHelp.workload.title} items={detailHelp.workload.items} />
                  </div>
                  <p>{tr('Projects')}: <strong>{formatNumber(infrastructure.stats.projects)}</strong></p>
                  <p>{tr('Tasks')}: <strong>{formatNumber(infrastructure.stats.tasks)}</strong></p>
                  <p>{tr('Active Users')}: <strong>{formatNumber(infrastructure.stats.activeUsers)}</strong></p>
                </div>
              </>
            )}
          </>
        )}

        {!requiresTenantSelection && view === 'analytics' && canViewOperationalSections && (
          <>
            <div className="section-title-row">
              <h2>{tr('Analytics')}</h2>
              <HelpSection title={helpByView.analytics.title} items={helpByView.analytics.items} />
            </div>
            {analytics && (
              <div className="grid">
                {isSuperAdmin && <div className="panel kpi"><div className="label">{tr('Tenants')}</div><div className="value">{formatNumber(analytics.tenants)}</div></div>}
                <div className="panel kpi"><div className="label">{tr('Active Users')}</div><div className="value">{formatNumber(analytics.activeUsers)}</div></div>
                <div className="panel kpi"><div className="label">{tr('Projects')}</div><div className="value">{formatNumber(analytics.projects)}</div></div>
                <div className="panel kpi"><div className="label">{tr('Tasks')}</div><div className="value">{formatNumber(analytics.tasks)}</div></div>
                <div className="panel kpi"><div className="label">{tr('Completion %')}</div><div className="value">{new Intl.NumberFormat(localeCode, { maximumFractionDigits: 1 }).format(analytics.completionRate)}%</div></div>
              </div>
            )}
          </>
        )}

        {!requiresTenantSelection && view === 'security' && canViewOperationalSections && (
          <>
            <div className="section-title-row">
              <h2>{tr('Security')}</h2>
              <HelpSection title={helpByView.security.title} items={helpByView.security.items} />
            </div>
            {security && (
              <div className="panel">
                <p>{tr('Risk Level')}: <strong>{security.riskLevel}</strong></p>
                <p>{tr('Suspended Users')}: <strong>{formatNumber(security.suspendedUsers)}</strong></p>
                <p>{tr('Suspicious Events (24h)')}: <strong>{formatNumber(security.suspiciousEvents24h)}</strong></p>
                <p>{tr('IP Blocks')}: <strong>{formatNumber(security.ipBlocks)}</strong></p>
              </div>
            )}
            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Feature Flags')}</h3>
                <HelpSection title={detailHelp.featureFlags.title} items={detailHelp.featureFlags.items} />
              </div>
              <table>
                <thead>
                  <tr><th>Key</th><th>Enabled</th><th>Scope</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {featureFlags.map((flag) => (
                    <tr key={flag.key}>
                      <td>{flag.key}</td>
                      <td>{flag.enabled ? 'true' : 'false'}</td>
                      <td>{flag.scope}</td>
                      <td>
                        <button className="secondary" onClick={() => void toggleFlag(flag.key, !flag.enabled)}>
                          {flag.enabled ? tr('Disable') : tr('Enable')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Announcement')}</h3>
                <HelpSection title={detailHelp.announcement.title} items={detailHelp.announcement.items} />
              </div>
              <div className="toolbar">
                <input placeholder="Admin announcement" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
                <button onClick={sendAnnouncement}>{tr('Send')}</button>
              </div>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'settings' && canViewOperationalSections && (
          <>
            <div className="section-title-row">
              <h2>{tr('Preferences')}</h2>
              <HelpSection title={helpByView.settings.title} items={helpByView.settings.items} />
            </div>
            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Language')}</h3>
                <HelpSection title={detailHelp.language.title} items={detailHelp.language.items} />
              </div>
              <div className="language-grid">
                {(['en', 'es', 'hi', 'zh'] as LocaleOption[]).map((lang) => (
                  <button key={lang} className={`language-card ${locale === lang ? 'on' : ''}`} onClick={() => setLocale(lang)}>
                    <div className="language-card-head">
                      <span className="language-label">{localeLabel[lang]}</span>
                      <span className={`language-dot ${locale === lang ? 'on' : ''}`}></span>
                    </div>
                    <div className="language-preview">
                      <div className="language-preview-title">TaskFlow Admin</div>
                      <div className="language-preview-sub">{localeLabel[lang]}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="detail-title-row">
                <h3>{tr('Theme')}</h3>
                <HelpSection title={detailHelp.theme.title} items={detailHelp.theme.items} />
              </div>
              <div className="theme-grid">
                {(['light', 'high-contrast', 'monochrome', 'vibrant'] as ThemeOption[]).map((themeOption) => (
                  <button key={themeOption} className={`theme-card ${theme === themeOption ? 'on' : ''}`} onClick={() => setTheme(themeOption)}>
                    <div className="theme-card-head">
                      <span className="theme-label">{themeOption}</span>
                      <span className={`theme-dot ${theme === themeOption ? 'on' : ''}`}></span>
                    </div>
                    <div className={`theme-preview theme-${themeOption}`}>
                      <div className="theme-preview-row" />
                      <div className="theme-preview-row short" />
                      <div className="theme-preview-pill" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!requiresTenantSelection && view === 'audit' && canViewOperationalSections && (
          <>
            <div className="section-title-row">
              <h2>{tr('Audit Logs')}</h2>
              <HelpSection title={helpByView.audit.title} items={helpByView.audit.items} />
            </div>
            <div className="panel">
              <div className="toolbar">
                <input placeholder="Action filter" value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} />
                <input placeholder="Entity filter" value={auditEntityFilter} onChange={(e) => setAuditEntityFilter(e.target.value)} />
                <input placeholder="Actor email filter" value={auditActorFilter} onChange={(e) => setAuditActorFilter(e.target.value)} />
                <button className="secondary" onClick={() => void loadAudit()}>{tr('Apply')}</button>
              </div>
              <table>
                <thead>
                  <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.actorEmail || '-'}</td>
                      <td>{row.action}</td>
                      <td>{row.entityType}</td>
                      <td>{row.entityId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {editUserDialogOpen && editingUserId && (
          <div className="dialog-backdrop" role="dialog" aria-modal="true">
            <div className="dialog-card">
              <div className="detail-title-row">
                <h3>{tr('Edit')} {tr('Users')}</h3>
                <button
                  className="secondary icon-btn"
                  type="button"
                  onClick={() => {
                    setEditUserDialogOpen(false)
                    setEditingUserId(null)
                  }}
                  title="Close edit user dialog"
                >
                  x
                </button>
              </div>
              <div className="dialog-form">
                <input placeholder="Display name" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
                <input placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as any)}>
                  {(isSuperAdmin || adminRole === 'OWNER') && <option value="OWNER">OWNER</option>}
                  {(isSuperAdmin || adminRole === 'OWNER') && <option value="ADMIN">ADMIN</option>}
                  <option value="MEMBER">MEMBER</option>
                  <option value="VIEWER">VIEWER</option>
                  <option value="GUEST">GUEST</option>
                </select>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
                <div className="actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      setEditUserDialogOpen(false)
                      setEditingUserId(null)
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" onClick={() => void saveEditUser()}>{tr('Save')}</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {editTenantDialogOpen && (
          <div className="dialog-backdrop" role="dialog" aria-modal="true">
            <div className="dialog-card">
              <div className="detail-title-row">
                <h3>Edit Tenant</h3>
                <button className="secondary icon-btn" type="button" onClick={() => setEditTenantDialogOpen(false)} title="Close edit dialog">x</button>
              </div>
              <div className="dialog-form">
                <input placeholder="Tenant name" value={tenantEditName} onChange={(e) => setTenantEditName(e.target.value)} />
                <select value={tenantEditPlan} onChange={(e) => setTenantEditPlan(e.target.value)}>
                  <option>Starter</option>
                  <option>Business</option>
                  <option>Enterprise</option>
                </select>
                <select value={tenantEditTimezone} onChange={(e) => setTenantEditTimezone(e.target.value)}>
                  {allTimezones.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
                <select value={tenantEditStatus} onChange={(e) => setTenantEditStatus(e.target.value)}>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="deleted">deleted</option>
                </select>
                <input placeholder="Contact email" value={tenantEditEmail} onChange={(e) => setTenantEditEmail(e.target.value)} />
                <input placeholder="Web portal URL" value={tenantEditWebPortalUrl} onChange={(e) => setTenantEditWebPortalUrl(e.target.value)} />
                <div className="actions">
                  <button className="secondary" type="button" onClick={() => setEditTenantDialogOpen(false)}>Cancel</button>
                  <button type="button" onClick={() => void saveSelectedTenantDetails()}>Save</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {createDialog && (
          <div className="dialog-backdrop" role="dialog" aria-modal="true">
            <div className="dialog-card">
              <div className="detail-title-row">
                <h3>
                  {createDialog === 'tenant' && tr('Create Tenant')}
                  {createDialog === 'user' && tr('Create User')}
                  {createDialog === 'group' && tr('Create Group')}
                </h3>
                <button className="secondary icon-btn" type="button" onClick={closeCreateDialog} title="Close create dialog">x</button>
              </div>
              {createDialog === 'tenant' && (
                <div className="dialog-form">
                  <input placeholder="Tenant name" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} />
                  <select value={newTenantPlan} onChange={(e) => setNewTenantPlan(e.target.value)}>
                    <option>Starter</option>
                    <option>Business</option>
                    <option>Enterprise</option>
                  </select>
                  <select value={newTenantTimezone} onChange={(e) => setNewTenantTimezone(e.target.value)}>
                    {allTimezones.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                  <input placeholder="Contact email" value={newTenantEmail} onChange={(e) => setNewTenantEmail(e.target.value)} />
                  <input placeholder="Web portal URL" value={newTenantWebPortalUrl} onChange={(e) => setNewTenantWebPortalUrl(e.target.value)} />
                  <div className="actions">
                    <button className="secondary" type="button" onClick={closeCreateDialog}>Cancel</button>
                    <button type="button" onClick={() => void submitCreateTenant()}>➕ {tr('Create')}</button>
                  </div>
                </div>
              )}
              {createDialog === 'user' && (
                <div className="dialog-form">
                  <Tooltip content="Select tenant to associate the user with" className="tooltip-block tooltip-align-start" placement="top">
                    <select value={newUserTenantId} onChange={(e) => setNewUserTenantId(e.target.value)}>
                      {tenantOptions.length === 0 ? (
                        <option value="saas-test">saas-test</option>
                      ) : (
                        tenantOptions.map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name} ({tenant.id})
                          </option>
                        ))
                      )}
                    </select>
                  </Tooltip>
                  <input placeholder="Display name" value={newUserDisplayName} onChange={(e) => setNewUserDisplayName(e.target.value)} />
                  <input placeholder="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
                  <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
                    {(isSuperAdmin || adminRole === 'OWNER') && <option value="OWNER">OWNER</option>}
                    {(isSuperAdmin || adminRole === 'OWNER') && <option value="ADMIN">ADMIN</option>}
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="GUEST">GUEST</option>
                  </select>
                  <div className="password-field">
                    <input
                      type={showNewUserPassword ? 'text' : 'password'}
                      placeholder="Initial password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="secondary icon-btn"
                      onClick={() => setShowNewUserPassword((current) => !current)}
                      aria-label={showNewUserPassword ? tr('Hide password') : tr('Show password')}
                      title={showNewUserPassword ? tr('Hide password') : tr('Show password')}
                    >
                      {showNewUserPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="actions">
                    <button className="secondary" type="button" onClick={closeCreateDialog}>Cancel</button>
                    <button type="button" onClick={() => void submitCreateUser()}>➕ {tr('Create User')}</button>
                  </div>
                </div>
              )}
              {createDialog === 'group' && (
                <div className="dialog-form">
                  <input placeholder="Tenant ID" value={newGroupTenantId} onChange={(e) => setNewGroupTenantId(e.target.value)} />
                  <input placeholder="Group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  <input placeholder="Description" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} />
                  <div className="actions">
                    <button className="secondary" type="button" onClick={closeCreateDialog}>Cancel</button>
                    <button type="button" onClick={() => void submitCreateGroup()}>➕ {tr('Create')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </section>
      </main>
    </div>
  )
}







