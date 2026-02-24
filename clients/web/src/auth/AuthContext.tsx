import React, { createContext, useContext, useMemo, useState } from 'react';
import { apiClient } from '../api/client';
import { clearTenantTimezone } from '../utils/tenantDate';

const USER_KEY = 'taskflow.user';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  passwordResetRequired?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  register: (email: string, displayName: string, password: string, tenantId?: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  requestPasswordReset: (email: string, tenantId?: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  clearMustChangePassword: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const SESSION_EXPIRED_EVENT = 'taskflow:session-expired';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const accessToken = apiClient.getAccessToken();
      if (!accessToken) {
        localStorage.removeItem(USER_KEY);
        return null;
      }
      const stored = localStorage.getItem(USER_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  });
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(() => Boolean(user?.passwordResetRequired));

  const setStoredUser = (nextUser: AuthUser | null) => {
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    setUser(nextUser);
  };

  const login = async (email: string, password: string, tenantId?: string) => {
    const payload = { email, password, tenant_id: tenantId };
    const response = await apiClient.login(payload);
    if (response?.accessToken && response?.refreshToken) {
      apiClient.setTokens(response.accessToken, response.refreshToken);
    }
    const resolvedTenantId = tenantId || response?.tenantId;
    if (resolvedTenantId) {
      apiClient.setTenantId(resolvedTenantId);
    }
    if (response?.user) {
      setStoredUser(response.user);
      setMustChangePassword(Boolean(response.user.passwordResetRequired));
    }
  };

  const register = async (email: string, displayName: string, password: string, tenantId?: string) => {
    await apiClient.register({
      email,
      displayName,
      password,
      password_confirm: password,
      tenant_id: tenantId
    });
  };

  const verifyEmail = async (token: string) => {
    await apiClient.verifyEmail(token);
  };

  const requestPasswordReset = async (email: string, tenantId?: string) => {
    await apiClient.forgotPassword({ email, tenant_id: tenantId });
  };

  const resetPassword = async (token: string, newPassword: string) => {
    await apiClient.resetPassword({
      token,
      newPassword,
      newPassword_confirm: newPassword
    });
  };

  const logout = async () => {
    try {
      const refreshToken = apiClient.getRefreshToken();
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout request failed, clearing local session anyway.', error);
    } finally {
      apiClient.clearTokens();
      apiClient.clearTenantId();
      clearTenantTimezone();
      setStoredUser(null);
      setMustChangePassword(false);
    }
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    setStoredUser(user ? { ...user, passwordResetRequired: false } : user);
  };

  React.useEffect(() => {
    if (!user) return;
    let idleTimer: number | undefined;

    const resetTimer = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        void logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
      }
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const intervalId = window.setInterval(() => {
      void apiClient.getProfile().catch(() => {
        // 401 handling is centralized in apiClient.request via session-expired event.
      });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [user]);

  React.useEffect(() => {
    const handleSessionExpired = () => {
      apiClient.clearTokens();
      apiClient.clearTenantId();
      clearTenantTimezone();
      localStorage.removeItem(USER_KEY);
      setUser(null);
      setMustChangePassword(false);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      mustChangePassword,
      login,
      register,
      verifyEmail,
      requestPasswordReset,
      resetPassword,
      clearMustChangePassword,
      logout
    }),
    [user, mustChangePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
