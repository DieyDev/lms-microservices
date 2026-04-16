import { useCallback, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lms-theme';

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDom(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyThemeToDom(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggle,
    }),
    [theme, toggle]
  );
}

