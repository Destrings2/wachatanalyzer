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

  // Check system preference and listen for changes
  useEffect(() => {
    // Check if matchMedia is supported
    if (typeof window.matchMedia !== 'function') {
      return; // Skip system theme detection if matchMedia not available
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Handler for system theme changes
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Check if there's a persisted theme preference
    const storedData = localStorage.getItem('chatanalyzer-ui');
    const hasPersistedTheme = storedData && JSON.parse(storedData).state?.theme;
    
    // Only apply system preference if no theme was previously chosen
    if (!hasPersistedTheme) {
      if (mediaQuery.matches) {
        setTheme('dark');
      }
    }

    // Add listener for system theme changes
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [setTheme]);

  return { theme, toggleTheme };
};