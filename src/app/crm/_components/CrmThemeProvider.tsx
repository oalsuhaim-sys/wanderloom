'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type CrmTheme = 'light' | 'dark';

const STORAGE_KEY = 'wanderloom-crm-theme';

type CrmThemeContextValue = {
  theme: CrmTheme;
  ready: boolean;
  setTheme: (theme: CrmTheme) => void;
  toggleTheme: () => void;
};

const CrmThemeContext = createContext<CrmThemeContextValue | null>(null);

function readStoredTheme(): CrmTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function CrmThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<CrmTheme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const next = readStoredTheme();
    setThemeState(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    return () => {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = '';
    };
  }, [theme, ready]);

  const setTheme = useCallback((next: CrmTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, ready, setTheme, toggleTheme }),
    [theme, ready, setTheme, toggleTheme],
  );

  return (
    <CrmThemeContext.Provider value={value}>{children}</CrmThemeContext.Provider>
  );
}

export function useCrmTheme(): CrmThemeContextValue {
  const ctx = useContext(CrmThemeContext);
  if (!ctx) {
    throw new Error('useCrmTheme must be used within CrmThemeProvider');
  }
  return ctx;
}
