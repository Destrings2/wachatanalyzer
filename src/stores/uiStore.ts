import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { View, Theme } from '../types';

interface UIStore {
  // UI State
  theme: Theme;
  activeView: View;
  selectedChart: string | null;
  sidebarCollapsed: boolean;
  
  // Actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setActiveView: (view: View) => void;
  setSelectedChart: (chart: string | null) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'light',
      activeView: 'upload',
      selectedChart: null,
      sidebarCollapsed: false,
      
      // Actions
      toggleTheme: () => set((state) => ({ 
        theme: state.theme === 'light' ? 'dark' : 'light' 
      })),
      
      setTheme: (theme) => set({ theme }),
      
      setActiveView: (view) => set({ activeView: view }),
      
      setSelectedChart: (chart) => set({ selectedChart: chart }),
      
      toggleSidebar: () => set((state) => ({ 
        sidebarCollapsed: !state.sidebarCollapsed 
      })),
    }),
    {
      name: 'chatanalyzer-ui',
      partialize: (state) => ({ theme: state.theme }), // Only persist theme
    }
  )
);