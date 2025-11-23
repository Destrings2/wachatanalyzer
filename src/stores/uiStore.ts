import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { View, Theme } from '../types';

export interface ChartSettings {
  separateMessagesBySender: boolean;
  showMessageCount: boolean;
  enableAnimations: boolean;
}

interface UIStore {
  // UI State
  theme: Theme;
  activeView: View;
  selectedChart: string | null;
  sidebarCollapsed: boolean;
  chartSettings: ChartSettings;

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setActiveView: (view: View) => void;
  setSelectedChart: (chart: string | null) => void;
  toggleSidebar: () => void;
  updateChartSettings: (settings: Partial<ChartSettings>) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'light',
      activeView: 'upload',
      selectedChart: null,
      sidebarCollapsed: true,
      chartSettings: {
        separateMessagesBySender: false,
        showMessageCount: true,
        enableAnimations: true,
      },

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

      updateChartSettings: (settings) => set((state) => ({
        chartSettings: { ...state.chartSettings, ...settings }
      })),
    }),
    {
      name: 'chatanalyzer-ui',
      partialize: (state) => ({
        theme: state.theme,
        chartSettings: state.chartSettings
      }),
    }
  )
);
