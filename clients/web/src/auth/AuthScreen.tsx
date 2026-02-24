import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useIntl } from 'react-intl';
import { HelpSection } from '../components/shared/HelpSection';
import { Tooltip } from '../components/shared/Tooltip';

const DEFAULT_TENANT = 'saas-test';

type View = 'login' | 'signup' | 'forgot' | 'reset' | 'verify';

export const AuthScreen: React.FC = () => {
  const { login, register, verifyEmail, requestPasswordReset, resetPassword } = useAuth();
  const intl = useIntl();
  const [view, setView] = useState<View>('login');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const tokenFromUrl = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT);

  React.useEffect(() => {
    if (tokenFromUrl && window.location.pathname.includes('verify-email')) {
      setView('verify');
    } else if (tokenFromUrl && window.location.pathname.includes('reset-password')) {
      setView('reset');
    }
  }, [tokenFromUrl]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (view === 'login') {
        await login(email, password, tenantId);
        setMessage(intl.formatMessage({ id: 'auth.message.signedIn' }));
      }
      if (view === 'signup') {
        await register(email, displayName, password, tenantId);
        setMessage(intl.formatMessage({ id: 'auth.message.registered' }));
        setView('login');
      }
      if (view === 'forgot') {
        await requestPasswordReset(email, tenantId);
        setMessage(intl.formatMessage({ id: 'auth.message.resetSent' }));
        setView('login');
      }
      if (view === 'verify' && tokenFromUrl) {
        await verifyEmail(tokenFromUrl);
        setMessage(intl.formatMessage({ id: 'auth.message.verified' }));
        setView('login');
      }
      if (view === 'reset' && tokenFromUrl) {
        await resetPassword(tokenFromUrl, password);
        setMessage(intl.formatMessage({ id: 'auth.message.passwordUpdated' }));
        setView('login');
      }
    } catch (err: any) {
      setError(err?.message || intl.formatMessage({ id: 'auth.error.generic' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1>TaskFlow</h1>
          <HelpSection
            titleId="help.auth.title"
            items={["help.auth.item1", "help.auth.item2", "help.auth.item3"]}
          />
        </div>
        <p className="auth-subtitle">
          {view === 'login' && intl.formatMessage({ id: 'auth.subtitle.login' })}
          {view === 'signup' && intl.formatMessage({ id: 'auth.subtitle.signup' })}
          {view === 'forgot' && intl.formatMessage({ id: 'auth.subtitle.forgot' })}
          {view === 'verify' && intl.formatMessage({ id: 'auth.subtitle.verify' })}
          {view === 'reset' && intl.formatMessage({ id: 'auth.subtitle.reset' })}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {(view === 'login' || view === 'signup' || view === 'forgot') && (
            <label>
              {intl.formatMessage({ id: 'auth.label.email' })}
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.email' })} className="tooltip-block" placement="right">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Tooltip>
            </label>
          )}

          {view === 'signup' && (
            <label>
              {intl.formatMessage({ id: 'auth.label.displayName' })}
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.displayName' })} className="tooltip-block" placement="right">
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </Tooltip>
            </label>
          )}

          {(view === 'login' || view === 'signup' || view === 'reset') && (
            <label>
              {intl.formatMessage({ id: 'auth.label.password' })}
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.password' })} className="tooltip-block" placement="right">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Tooltip>
            </label>
          )}

          {(view === 'login' || view === 'signup' || view === 'forgot') && (
            <label>
              {intl.formatMessage({ id: 'auth.label.tenant' })}
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.tenant' })} className="tooltip-block" placement="right">
                <input
                  type="text"
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                />
              </Tooltip>
            </label>
          )}

          {message && <div className="auth-message">{message}</div>}
          {error && <div className="auth-error">{error}</div>}

          <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.continue' })}>
            <button type="submit" disabled={loading}>
              {loading ? intl.formatMessage({ id: 'auth.button.loading' }) : intl.formatMessage({ id: 'auth.button.continue' })}
            </button>
          </Tooltip>
        </form>

        <div className="auth-actions">
          {view !== 'login' && (
            <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.backToSignIn' })}>
              <button type="button" onClick={() => setView('login')} className="link-button">
                {intl.formatMessage({ id: 'auth.link.backToSignIn' })}
              </button>
            </Tooltip>
          )}
          {view === 'login' && (
            <>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.createAccount' })}>
                <button type="button" onClick={() => setView('signup')} className="link-button">
                  {intl.formatMessage({ id: 'auth.link.createAccount' })}
                </button>
              </Tooltip>
              <Tooltip content={intl.formatMessage({ id: 'tooltip.auth.forgotPassword' })}>
                <button type="button" onClick={() => setView('forgot')} className="link-button">
                  {intl.formatMessage({ id: 'auth.link.forgotPassword' })}
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
