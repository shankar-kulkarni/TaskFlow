import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { apiClient } from '../api/client';
import { messages, Locale } from './messages';

interface LanguageContextValue {
  locale: Locale;
  isLoading: boolean;
  error: string | null;
  setLocale: (nextLocale: Locale) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const DEFAULT_LOCALE: Locale = 'en';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const prefs = await apiClient.getTenantPreferences();
        const nextLocale = (prefs?.locale as Locale) || DEFAULT_LOCALE;
        if (isActive) {
          setLocaleState(nextLocale);
        }
      } catch (err: any) {
        if (isActive) {
          setError(err?.message || 'Failed to load language');
          setLocaleState(DEFAULT_LOCALE);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  const setLocale = async (nextLocale: Locale) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.updateTenantPreferences({ locale: nextLocale });
      setLocaleState(nextLocale);
    } catch (err: any) {
      setError(err?.message || 'Failed to update language');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      locale,
      isLoading,
      error,
      setLocale
    }),
    [locale, isLoading, error]
  );

  return (
    <LanguageContext.Provider value={value}>
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};
