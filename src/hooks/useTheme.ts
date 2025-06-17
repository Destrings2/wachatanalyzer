import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export const useTheme = () => {
  const { theme, toggleTheme, setTheme } = useUIStore();

  useEffect(() => {
    // Apply to both html and body to ensure compatibility
    const root = document.documentElement;
    const body = document.body;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, [theme]);

  // Only check system preference on initial mount if no theme is persisted
  useEffect(() => {
    // Check if matchMedia is supported
    if (typeof window.matchMedia !== 'function') {
      return; // Skip system theme detection if matchMedia not available
    }

    // Check if there's a persisted theme preference
    const storedData = localStorage.getItem('chatanalyzer-ui');
    const hasPersistedTheme = storedData && JSON.parse(storedData).state?.theme;
    
    // Only apply system preference if no theme was previously chosen
    if (!hasPersistedTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        setTheme('dark');
      }
    }
    // Remove the listener that was overriding user choice
  }, [setTheme]);

  return { theme, toggleTheme };
};