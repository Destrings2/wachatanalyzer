import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export const useTheme = () => {
  const { theme, toggleTheme, setTheme } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Check system preference on mount
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial theme based on system preference if not already set
    if (mediaQuery.matches && theme === 'light') {
      setTheme('dark');
    }

    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { theme, toggleTheme };
};