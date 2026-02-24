import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageProvider';
import { messages } from '../i18n/messages';
import type { Locale } from '../i18n/messages';
import { HelpSection } from './shared/HelpSection';
import { Tooltip } from './shared/Tooltip';

interface SessionItem {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

type ThemeOption = 'light' | 'high-contrast' | 'monochrome' | 'vibrant';

export const AccountView = () => {
  const { user, logout } = useAuth();
  const { locale, setLocale, isLoading: localeLoading, error: localeError } = useLanguage();
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'sessions' | 'language' | 'theme'>('profile');
  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    avatarUrl: ''
  });
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [languageStatus, setLanguageStatus] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [themeStatus, setThemeStatus] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window === 'undefined') return 'vibrant';
    return (localStorage.getItem('taskflow.theme') as ThemeOption) || 'vibrant';
  });

  useEffect(() => {
    const load = async () => {
      try {
        const me = await apiClient.getProfile();
        setProfile({
          displayName: me.displayName || '',
          email: me.email || '',
          avatarUrl: me.avatarUrl || ''
        });
        const sessionList = await apiClient.getSessions();
        setSessions(sessionList || []);
      } catch (err: any) {
        setError(err?.message || intl.formatMessage({ id: 'account.errors.load' }));
      }
    };

    void load();
  }, [intl]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow.theme', theme);
  }, [theme]);

  const handleProfileSave = async () => {
    setStatus(null);
    setError(null);
    try {
      await apiClient.updateProfile({
        displayName: profile.displayName,
        email: profile.email,
        avatarUrl: profile.avatarUrl
      });
      setStatus(intl.formatMessage({ id: 'account.status.profileUpdated' }));
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'account.errors.profileUpdate' }));
    }
  };

  const handlePasswordSave = async () => {
    setStatus(null);
    setError(null);
    try {
      await apiClient.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      setPasswords({ currentPassword: '', newPassword: '' });
      setStatus(intl.formatMessage({ id: 'account.status.passwordUpdated' }));
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'account.errors.passwordUpdate' }));
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.revokeSession(sessionId);
      setSessions(prev => prev.filter(session => session.id !== sessionId));
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'account.errors.revoke' }));
    }
  };

  const handleRevokeAll = async () => {
    try {
      await apiClient.revokeAllSessions();
      setSessions([]);
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'account.errors.revokeAll' }));
    }
  };

  const languageOptions = useMemo(() => {
    const options: Array<{ value: Locale; labelKey: string }> = [
      { value: 'en', labelKey: 'account.language.option.english' },
      { value: 'es', labelKey: 'account.language.option.spanish' },
      { value: 'hi', labelKey: 'account.language.option.hindi' },
      { value: 'zh', labelKey: 'account.language.option.chinese' }
    ];

    if (!options.some(option => option.value === 'es')) {
      options.push({ value: 'es', labelKey: 'account.language.option.spanish' });
    }

    return options;
  }, []);

  const handleLanguageChange = async (nextLocale: Locale) => {
    setLanguageStatus(null);
    setError(null);
    try {
      await setLocale(nextLocale);
      setLanguageStatus(intl.formatMessage({ id: 'account.status.languageUpdated' }));
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'account.errors.languageUpdate' }));
    }
  };

  const themeOptions = useMemo(
    () => [
      { value: 'light', labelKey: 'account.theme.option.light', descKey: 'account.theme.desc.light' },
      { value: 'high-contrast', labelKey: 'account.theme.option.highContrast', descKey: 'account.theme.desc.highContrast' },
      { value: 'monochrome', labelKey: 'account.theme.option.monochrome', descKey: 'account.theme.desc.monochrome' },
      { value: 'vibrant', labelKey: 'account.theme.option.vibrant', descKey: 'account.theme.desc.vibrant' }
    ] as const,
    []
  );

  const handleThemeChange = (nextTheme: typeof theme) => {
    setThemeStatus(null);
    setError(null);
    setTheme(nextTheme);
    setThemeStatus(intl.formatMessage({ id: 'account.status.themeUpdated' }));
  };

  return (
    <div className="main">
      <div className="ph">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="ph-title">{intl.formatMessage({ id: 'account.title' })}</h1>
            <HelpSection
              titleId="help.account.title"
              items={["help.account.item1", "help.account.item2", "help.account.item3"]}
            />
          </div>
          <p className="ph-sub">{intl.formatMessage({ id: 'account.subtitle' })}</p>
        </div>
        <div className="ph-actions">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.signOut' })} placement="right">
            <button className="btn btn-ghost" onClick={() => void logout()}>
              {intl.formatMessage({ id: 'account.signOut' })}
            </button>
          </Tooltip>
        </div>
      </div>


      <div className="account-container">
        <div className="ftabs">
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.tabProfile' })} placement="right">
            <button
              className={`ftab ${activeTab === 'profile' ? 'on' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              {intl.formatMessage({ id: 'account.tabs.profile' })}
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.tabSecurity' })} placement="right">
            <button
              className={`ftab ${activeTab === 'security' ? 'on' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              {intl.formatMessage({ id: 'account.tabs.security' })}
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.tabSessions' })} placement="right">
            <button
              className={`ftab ${activeTab === 'sessions' ? 'on' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              {intl.formatMessage({ id: 'account.tabs.sessions' })}
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.tabLanguage' })} placement="right">
            <button
              className={`ftab ${activeTab === 'language' ? 'on' : ''}`}
              onClick={() => setActiveTab('language')}
            >
              {intl.formatMessage({ id: 'account.tabs.language' })}
            </button>
          </Tooltip>
          <Tooltip content={intl.formatMessage({ id: 'tooltip.account.tabTheme' })} placement="right">
            <button
              className={`ftab ${activeTab === 'theme' ? 'on' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              {intl.formatMessage({ id: 'account.tabs.theme' })}
            </button>
          </Tooltip>
        </div>

        {activeTab === 'profile' && (
          <section className="stat account-section">
            <div className="stat-lbl">{intl.formatMessage({ id: 'account.profile.title' })}</div>
            <div className="form-group">
              <label className="form-label">
                {intl.formatMessage({ id: 'account.profile.displayName' })}
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.displayName' })} className="tooltip-block tooltip-align-start" placement="top">
                  <input
                    value={profile.displayName}
                    onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                    className="form-input"
                  />
                </Tooltip>
              </label>
              <label className="form-label">
                {intl.formatMessage({ id: 'account.profile.email' })}
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.email' })} className="tooltip-block tooltip-align-start" placement="top">
                  <input
                    value={profile.email}
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                    className="form-input"
                  />
                </Tooltip>
              </label>
              <label className="form-label">
                {intl.formatMessage({ id: 'account.profile.avatarUrl' })}
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.avatarUrl' })} className="tooltip-block tooltip-align-start" placement="top">
                  <input
                    value={profile.avatarUrl}
                    onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })}
                    className="form-input"
                  />
                </Tooltip>
              </label>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.account.saveProfile' })} placement="right">
                <button className="btn btn-primary" onClick={() => void handleProfileSave()}>
                  {intl.formatMessage({ id: 'account.profile.save' })}
                </button>
              </Tooltip>
            </div>
          </section>
        )}

        {activeTab === 'security' && (
          <section className="stat account-section">
            <div className="stat-lbl">{intl.formatMessage({ id: 'account.security.title' })}</div>
            <div className="form-group">
              <label className="form-label">
                {intl.formatMessage({ id: 'account.security.currentPassword' })}
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.currentPassword' })} className="tooltip-block tooltip-align-start" placement="top">
                  <input
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
                    className="form-input"
                  />
                </Tooltip>
              </label>
              <label className="form-label">
                {intl.formatMessage({ id: 'account.security.newPassword' })}
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.newPassword' })} className="tooltip-block tooltip-align-start" placement="top">
                  <input
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
                    className="form-input"
                  />
                </Tooltip>
              </label>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.account.changePassword' })} placement="right">
                <button className="btn btn-primary" onClick={() => void handlePasswordSave()}>
                  {intl.formatMessage({ id: 'account.security.changePassword' })}
                </button>
              </Tooltip>
            </div>
          </section>
        )}

        {activeTab === 'sessions' && (
          <section className="stat account-section">
            <div className="stat-lbl">{intl.formatMessage({ id: 'account.sessions.title' })}</div>
            <div className="sessions-list">
              {sessions.length === 0 && (
                <div className="no-sessions">{intl.formatMessage({ id: 'account.sessions.none' })}</div>
              )}
              {sessions.map(session => (
                <div key={session.id} className="session-item">
                  <div>
                    <div className="session-device">{session.userAgent || 'Unknown device'}</div>
                    <div className="session-meta">
                      {session.ipAddress || 'Unknown IP'} · Expires {new Date(session.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  <Tooltip content={intl.formatMessage({ id: 'tooltip.account.revokeSession' })} placement="right">
                    <button className="btn btn-ghost" onClick={() => void handleRevokeSession(session.id)}>
                      {intl.formatMessage({ id: 'account.sessions.revoke' })}
                    </button>
                  </Tooltip>
                </div>
              ))}
              {sessions.length > 0 && (
                <Tooltip content={intl.formatMessage({ id: 'tooltip.account.revokeAll' })} placement="right">
                  <button className="btn btn-ghost" onClick={() => void handleRevokeAll()}>
                    {intl.formatMessage({ id: 'account.sessions.revokeAll' })}
                  </button>
                </Tooltip>
              )}
            </div>
          </section>
        )}

        {activeTab === 'language' && (
          <section className="stat account-section">
            <div className="stat-lbl">{intl.formatMessage({ id: 'account.language.title' })}</div>
            <div className="account-language">
              <p className="account-language-sub">
                {intl.formatMessage({ id: 'account.language.description' })}
              </p>
              <div className="language-grid">
                {languageOptions.map(option => {
                  const isActive = locale === option.value;
                  const localizedLabel = messages[option.value][option.labelKey] ||
                    intl.formatMessage({ id: option.labelKey });
                  const previewTitle = messages[option.value]['account.language.preview.title'];
                  const previewSubtitle = messages[option.value]['account.language.preview.subtitle'];
                  const previewCta = messages[option.value]['account.language.preview.cta'];

                  return (
                    <Tooltip key={option.value} content={intl.formatMessage({ id: 'tooltip.account.languageCard' })} className="tooltip-block tooltip-align-start" placement="top">
                      <button
                        type="button"
                        className={`language-card ${isActive ? 'on' : ''}`}
                        onClick={() => void handleLanguageChange(option.value)}
                        disabled={localeLoading}
                      >
                        <div className="language-card-head">
                          <span className="language-label">{localizedLabel}</span>
                          <span className={`language-dot ${isActive ? 'on' : ''}`}></span>
                        </div>
                        <div className="language-preview">
                          <div className="language-preview-title">{previewTitle}</div>
                          <div className="language-preview-sub">{previewSubtitle}</div>
                          <div className="language-preview-cta">{previewCta}</div>
                        </div>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
              {localeError && <div className="status-error">{localeError}</div>}
              {languageStatus && <div className="status-success">{languageStatus}</div>}
            </div>
          </section>
        )}

        {activeTab === 'theme' && (
          <section className="stat account-section">
            <div className="stat-lbl">{intl.formatMessage({ id: 'account.theme.title' })}</div>
            <div className="account-theme">
              <p className="account-theme-sub">
                {intl.formatMessage({ id: 'account.theme.description' })}
              </p>
              <div className="theme-grid">
                {themeOptions.map(option => (
                  <Tooltip key={option.value} content={intl.formatMessage({ id: 'tooltip.account.themeCard' })} className="tooltip-block tooltip-align-start" placement="top">
                    <button
                      className={`theme-card ${theme === option.value ? 'on' : ''}`}
                      onClick={() => handleThemeChange(option.value)}
                      type="button"
                    >
                      <div className="theme-card-head">
                        <span className="theme-label">{intl.formatMessage({ id: option.labelKey })}</span>
                        <span className={`theme-dot ${theme === option.value ? 'on' : ''}`}></span>
                      </div>
                      <div className={`theme-preview theme-${option.value}`}>
                        <div className="theme-preview-row"></div>
                        <div className="theme-preview-row short"></div>
                        <div className="theme-preview-pill"></div>
                      </div>
                      <span className="theme-caption">{intl.formatMessage({ id: option.descKey })}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
              {themeStatus && <div className="status-success">{themeStatus}</div>}
            </div>
          </section>
        )}

        {(status || error) && (
          <div className={error ? 'status-error' : 'status-success'}>
            {error || status}
          </div>
        )}
      </div>
    </div>
  );
};
