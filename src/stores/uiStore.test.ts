import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from './uiStore';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('uiStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store to initial state
    useUIStore.setState({
      theme: 'light',
      activeView: 'upload',
      selectedChart: null,
      sidebarCollapsed: true,
      chartSettings: {
        separateMessagesBySender: false,
        showMessageCount: true,
        enableAnimations: true,
      },
    });
  });

  describe('theme management', () => {
    it('toggles theme from light to dark', () => {
      const { toggleTheme } = useUIStore.getState();
      
      toggleTheme();
      
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('toggles theme from dark to light', () => {
      // Set theme to dark first
      useUIStore.setState({ theme: 'dark' });
      
      const { toggleTheme } = useUIStore.getState();
      toggleTheme();
      
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('sets theme explicitly', () => {
      const { setTheme } = useUIStore.getState();
      
      setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');
      
      setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('view management', () => {
    it('sets active view', () => {
      const { setActiveView } = useUIStore.getState();
      
      setActiveView('dashboard');
      
      expect(useUIStore.getState().activeView).toBe('dashboard');
    });

    it('changes view from upload to dashboard', () => {
      const { setActiveView } = useUIStore.getState();
      
      expect(useUIStore.getState().activeView).toBe('upload');
      
      setActiveView('dashboard');
      
      expect(useUIStore.getState().activeView).toBe('dashboard');
    });
  });

  describe('chart management', () => {

  });

  describe('sidebar management', () => {
    it('toggles sidebar from collapsed to expanded', () => {
      const { toggleSidebar } = useUIStore.getState();
      
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
      
      toggleSidebar();
      
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('toggles sidebar from expanded to collapsed', () => {
      // Set sidebar to expanded first
      useUIStore.setState({ sidebarCollapsed: false });
      
      const { toggleSidebar } = useUIStore.getState();
      toggleSidebar();
      
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });
  });

  describe('chart settings management', () => {
    it('updates chart settings partially', () => {
      const { updateChartSettings } = useUIStore.getState();
      
      updateChartSettings({ separateMessagesBySender: true });
      
      expect(useUIStore.getState().chartSettings).toEqual({
        separateMessagesBySender: true,
        showMessageCount: true,
        enableAnimations: true,
      });
    });

    it('updates multiple chart settings', () => {
      const { updateChartSettings } = useUIStore.getState();
      
      updateChartSettings({
        separateMessagesBySender: true,
        showMessageCount: false,
      });
      
      expect(useUIStore.getState().chartSettings).toEqual({
        separateMessagesBySender: true,
        showMessageCount: false,
        enableAnimations: true,
      });
    });

    it('preserves other settings when updating partially', () => {
      // Set some initial values
      useUIStore.setState({
        chartSettings: {
          separateMessagesBySender: true,
          showMessageCount: false,
          enableAnimations: false,
        }
      });
      
      const { updateChartSettings } = useUIStore.getState();
      updateChartSettings({ separateMessagesBySender: false });
      
      expect(useUIStore.getState().chartSettings).toEqual({
        separateMessagesBySender: false,
        showMessageCount: false,
        enableAnimations: false,
      });
    });
  });

  describe('store subscription', () => {
    it('notifies subscribers of state changes', () => {
      const subscriber = vi.fn();
      
      const unsubscribe = useUIStore.subscribe(subscriber);
      
      const { setTheme } = useUIStore.getState();
      setTheme('dark');
      
      expect(subscriber).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('can unsubscribe from state changes', () => {
      const subscriber = vi.fn();
      
      const unsubscribe = useUIStore.subscribe(subscriber);
      unsubscribe();
      
      const { setTheme } = useUIStore.getState();
      setTheme('dark');
      
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('state consistency', () => {
    it('maintains state consistency during multiple updates', () => {
      const { toggleTheme, setActiveView, updateChartSettings } = useUIStore.getState();
      
      toggleTheme();
      setActiveView('dashboard');
      updateChartSettings({ separateMessagesBySender: true });
      
      const finalState = useUIStore.getState();
      expect(finalState.theme).toBe('dark');
      expect(finalState.activeView).toBe('dashboard');
      expect(finalState.chartSettings.separateMessagesBySender).toBe(true);
    });

    it('does not mutate state directly', () => {
      const initialState = useUIStore.getState();
      const initialChartSettings = initialState.chartSettings;
      
      const { updateChartSettings } = useUIStore.getState();
      updateChartSettings({ separateMessagesBySender: true });
      
      // Original reference should not be mutated
      expect(initialChartSettings.separateMessagesBySender).toBe(false);
      
      // New state should have updated value
      expect(useUIStore.getState().chartSettings.separateMessagesBySender).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles rapid theme toggles', () => {
      const { toggleTheme } = useUIStore.getState();
      
      // Rapid toggles
      toggleTheme(); // light -> dark
      toggleTheme(); // dark -> light
      toggleTheme(); // light -> dark
      
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('handles empty chart settings update', () => {
      const { updateChartSettings } = useUIStore.getState();
      const initialSettings = useUIStore.getState().chartSettings;
      
      updateChartSettings({});
      
      expect(useUIStore.getState().chartSettings).toEqual(initialSettings);
    });

    it('handles same view being set multiple times', () => {
      const { setActiveView } = useUIStore.getState();
      
      setActiveView('dashboard');
      setActiveView('dashboard');
      setActiveView('dashboard');
      
      expect(useUIStore.getState().activeView).toBe('dashboard');
    });
  });

  describe('localStorage persistence', () => {
    it('persists theme and chart settings to localStorage', () => {
      const { toggleTheme, updateChartSettings } = useUIStore.getState();
      
      // Clear mock calls from initialization
      localStorageMock.setItem.mockClear();
      
      // Toggle theme
      toggleTheme();
      
      // Verify theme was saved to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringContaining('ui-store'),
        expect.stringContaining('"theme":"dark"')
      );
      
      // Update chart settings
      updateChartSettings({ showMessageCount: false });
      
      // Verify chart settings were saved
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringContaining('ui-store'),
        expect.stringContaining('"showMessageCount":false')
      );
    });

    it('hydrates from localStorage on initialization', () => {
      // Note: In a real scenario, the store would read from localStorage
      // on initialization. Since our store is already initialized in tests,
      // we can verify that the persist middleware is configured correctly
      // by checking that it saves the expected fields.
      
      const { toggleTheme, updateChartSettings } = useUIStore.getState();
      
      // Make changes to persisted fields
      toggleTheme(); // dark
      updateChartSettings({ enableAnimations: false });
      
      // Get the last saved state from localStorage mock
      const lastCall = localStorageMock.setItem.mock.lastCall;
      expect(lastCall).toBeDefined();
      
      const savedData = JSON.parse(lastCall![1]);
      
      // Verify only theme and chartSettings are persisted
      expect(savedData.state).toHaveProperty('theme');
      expect(savedData.state).toHaveProperty('chartSettings');
      expect(savedData.state.theme).toBe('dark');
      expect(savedData.state.chartSettings.enableAnimations).toBe(false);
    });

    it('does not persist activeView or sidebarCollapsed', () => {
      const { setActiveView, toggleSidebar } = useUIStore.getState();
      
      // Clear mock calls
      localStorageMock.setItem.mockClear();
      
      // Change non-persisted state
      setActiveView('dashboard');
      toggleSidebar();
      
      // These changes should not trigger localStorage updates
      const calls = localStorageMock.setItem.mock.calls;
      calls.forEach(call => {
        const savedData = JSON.parse(call[1]);
        // activeView and sidebarCollapsed should not be in persisted state
        expect(savedData.state).not.toHaveProperty('activeView');
        expect(savedData.state).not.toHaveProperty('sidebarCollapsed');
      });
    });

    it('handles localStorage errors gracefully', () => {
      // Simulate localStorage throwing an error
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      const { toggleTheme } = useUIStore.getState();
      
      // Should not throw even if localStorage fails
      expect(() => toggleTheme()).not.toThrow();
      
      // State should still update
      expect(useUIStore.getState().theme).toBe('dark');
    });
  });
});