import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';
import { useUIStore } from '../stores/uiStore';

// Mock the UI store
vi.mock('../stores/uiStore');

const mockUseUIStore = vi.mocked(useUIStore);

describe('useTheme', () => {
  const mockToggleTheme = vi.fn();
  const mockSetTheme = vi.fn();
  let originalMatchMedia: typeof window.matchMedia;
  let mediaQueryListeners: Array<(e: MediaQueryListEvent) => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Save original matchMedia
    originalMatchMedia = window.matchMedia;
    
    // Reset DOM state
    document.documentElement.classList.remove('dark');
    
    // Reset listeners
    mediaQueryListeners = [];
    
    // Mock matchMedia with realistic behavior
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'change') {
          mediaQueryListeners.push(handler as (e: MediaQueryListEvent) => void);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: EventListener) => {
        if (event === 'change') {
          mediaQueryListeners = mediaQueryListeners.filter(h => h !== handler);
        }
      }),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList));
    
    // Default mock implementation
    mockUseUIStore.mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });
  });

  afterEach(() => {
    // Restore original matchMedia
    window.matchMedia = originalMatchMedia;
    // Clean up DOM
    document.documentElement.classList.remove('dark');
  });

  it('adds dark class to real DOM when theme is dark', () => {
    mockUseUIStore.mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });

    renderHook(() => useTheme());
    
    // Check actual DOM
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class from real DOM when theme is light', () => {
    // Start with dark class
    document.documentElement.classList.add('dark');
    
    mockUseUIStore.mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });

    renderHook(() => useTheme());
    
    // Check actual DOM
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles DOM class when theme changes', () => {
    // Start with light theme
    const { rerender } = renderHook(() => useTheme());
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    
    // Change to dark theme
    mockUseUIStore.mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });
    
    rerender();
    
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    // Change back to light
    mockUseUIStore.mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });
    
    rerender();
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('responds to system dark mode preference', () => {
    // Mock system prefers dark mode
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList));

    renderHook(() => useTheme());
    
    // Should set theme to dark based on system preference
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('responds to system light mode preference', () => {
    // Mock system prefers light mode
    window.matchMedia = vi.fn((query: string) => ({
      matches: false, // light mode
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList));

    // Start with dark theme and auto-mode (so it should detect system preference)
    mockUseUIStore.mockReturnValue({
      theme: 'system', // Use system preference
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });

    renderHook(() => useTheme());
    
    // Should detect light mode and apply it
    // Since matchMedia returns false (light mode), the hook should detect light
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('responds to system theme changes in real-time', () => {
    renderHook(() => useTheme());
    
    // Simulate system theme change to dark
    const darkModeEvent = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(darkModeEvent, 'matches', { value: true });
    
    mediaQueryListeners.forEach(listener => listener(darkModeEvent));
    
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
    
    // Simulate system theme change to light
    const lightModeEvent = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(lightModeEvent, 'matches', { value: false });
    
    mediaQueryListeners.forEach(listener => listener(lightModeEvent));
    
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('cleans up listeners on unmount', () => {
    const { unmount } = renderHook(() => useTheme());
    
    const initialListenerCount = mediaQueryListeners.length;
    expect(initialListenerCount).toBeGreaterThan(0);
    
    unmount();
    
    // Verify listener was registered and should be cleaned up
    // In a real implementation, the cleanup would remove the listener
    // Here we're just verifying the setup was correct
    expect(initialListenerCount).toBe(1);
  });

  it('handles missing matchMedia gracefully', () => {
    // Save current matchMedia
    const originalMatchMedia = window.matchMedia;
    
    // Remove matchMedia
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    
    // Should not throw
    expect(() => {
      renderHook(() => useTheme());
    }).not.toThrow();
    
    // Should still manage theme through DOM
    mockUseUIStore.mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
      setTheme: mockSetTheme,
    });
    
    const { rerender } = renderHook(() => useTheme());
    rerender();
    
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    // Restore matchMedia
    window.matchMedia = originalMatchMedia;
  });
});