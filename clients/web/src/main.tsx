import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { LanguageProvider } from './i18n/LanguageProvider'
import { ErrorBoundary } from './components/ErrorBoundary'

const bootstrapImpersonationSession = () => {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('imp_access_token')
  const refreshToken = params.get('imp_refresh_token')
  const tenantId = params.get('imp_tenant_id')
  const encodedUser = params.get('imp_user')

  if (!accessToken || !refreshToken || !tenantId || !encodedUser) return

  try {
    let userJson = encodedUser
    try {
      userJson = atob(encodedUser)
    } catch {
      // Newer admin payload sends plain JSON in query param.
      userJson = encodedUser
    }
    const user = JSON.parse(userJson)
    localStorage.setItem('taskflow.accessToken', accessToken)
    localStorage.setItem('taskflow.refreshToken', refreshToken)
    localStorage.setItem('taskflow.tenantId', tenantId)
    localStorage.setItem('taskflow.user', JSON.stringify(user))
    localStorage.setItem('taskflow.impersonating', 'true')
  } catch {
    // Ignore malformed impersonation payloads.
  } finally {
    window.history.replaceState({}, document.title, window.location.pathname)
  }
}

bootstrapImpersonationSession()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
