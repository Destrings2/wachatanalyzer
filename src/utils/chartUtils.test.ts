import { describe, it, expect } from 'vitest';
import { getSenderColor, getSenderColors, getChartColors } from './chartUtils';

describe('chartUtils', () => {
  describe('getSenderColor', () => {
    it('returns consistent colors for the same index', () => {
      const color1 = getSenderColor(0, 'light');
      const color2 = getSenderColor(0, 'light');
      
      expect(color1).toBe(color2);
    });

    it('returns different colors for different indices', () => {
      const color0 = getSenderColor(0, 'light');
      const color1 = getSenderColor(1, 'light');
      const color2 = getSenderColor(2, 'light');
      
      expect(color0).not.toBe(color1);
      expect(color1).not.toBe(color2);
      expect(color0).not.toBe(color2);
    });

    it('cycles through colors when index exceeds palette size', () => {
      const color0 = getSenderColor(0, 'light');
      const colorCycle = getSenderColor(12, 'light'); // Assuming palette has 12 colors
      
      expect(color0).toBe(colorCycle);
    });

    it('returns valid hex colors for light theme', () => {
      for (let i = 0; i < 15; i++) {
        const color = getSenderColor(i, 'light');
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('returns valid hex colors for dark theme', () => {
      for (let i = 0; i < 15; i++) {
        const color = getSenderColor(i, 'dark');
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('returns different colors for light and dark themes', () => {
      const lightColor = getSenderColor(0, 'light');
      const darkColor = getSenderColor(0, 'dark');
      
      expect(lightColor).not.toBe(darkColor);
    });

    it('handles negative indices gracefully', () => {
      expect(() => getSenderColor(-1, 'light')).not.toThrow();
      expect(() => getSenderColor(-5, 'dark')).not.toThrow();
    });

    it('handles very large indices', () => {
      expect(() => getSenderColor(1000, 'light')).not.toThrow();
      expect(() => getSenderColor(9999, 'dark')).not.toThrow();
    });

    it('returns same color for equivalent modulo indices', () => {
      const color1 = getSenderColor(1, 'light');
      const color13 = getSenderColor(13, 'light'); // Assuming 12-color palette
      
      expect(color1).toBe(color13);
    });
  });

  describe('getSenderColors', () => {
    it('returns array of colors for light theme', () => {
      const colors = getSenderColors('light');
      
      expect(Array.isArray(colors)).toBe(true);
      expect(colors.length).toBeGreaterThan(0);
      
      colors.forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('returns array of colors for dark theme', () => {
      const colors = getSenderColors('dark');
      
      expect(Array.isArray(colors)).toBe(true);
      expect(colors.length).toBeGreaterThan(0);
      
      colors.forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('returns different color arrays for different themes', () => {
      const lightColors = getSenderColors('light');
      const darkColors = getSenderColors('dark');
      
      expect(lightColors).not.toEqual(darkColors);
    });

    it('returns unique colors within each theme', () => {
      const lightColors = getSenderColors('light');
      const darkColors = getSenderColors('dark');
      
      const uniqueLightColors = new Set(lightColors);
      const uniqueDarkColors = new Set(darkColors);
      
      expect(uniqueLightColors.size).toBe(lightColors.length);
      expect(uniqueDarkColors.size).toBe(darkColors.length);
    });

    it('returns consistent color arrays', () => {
      const colors1 = getSenderColors('light');
      const colors2 = getSenderColors('light');
      
      expect(colors1).toEqual(colors2);
    });
  });

  describe('getChartColors', () => {
    it('returns complete color configuration for light theme', () => {
      const colors = getChartColors('light');
      
      expect(colors).toHaveProperty('line');
      expect(colors).toHaveProperty('area');
      expect(colors).toHaveProperty('axis');
      expect(colors).toHaveProperty('grid');
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('brush');
      expect(colors).toHaveProperty('brushHandle');
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('low');
      expect(colors).toHaveProperty('high');
    });

    it('returns complete color configuration for dark theme', () => {
      const colors = getChartColors('dark');
      
      expect(colors).toHaveProperty('line');
      expect(colors).toHaveProperty('area');
      expect(colors).toHaveProperty('axis');
      expect(colors).toHaveProperty('grid');
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('brush');
      expect(colors).toHaveProperty('brushHandle');
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('low');
      expect(colors).toHaveProperty('high');
    });

    it('returns different colors for light and dark themes', () => {
      const lightColors = getChartColors('light');
      const darkColors = getChartColors('dark');
      
      expect(lightColors.line).not.toBe(darkColors.line);
      expect(lightColors.background).not.toBe(darkColors.background);
      expect(lightColors.text).not.toBe(darkColors.text);
    });

    it('returns valid color values', () => {
      const lightColors = getChartColors('light');
      const darkColors = getChartColors('dark');
      
      // Check hex colors
      expect(lightColors.line).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(darkColors.line).toMatch(/^#[0-9A-Fa-f]{6}$/);
      
      // Check rgba colors
      expect(lightColors.brush).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
      expect(darkColors.brush).toMatch(/^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/);
    });

    it('provides appropriate colors for chart theming', () => {
      const lightColors = getChartColors('light');
      const darkColors = getChartColors('dark');
      
      // Background should be light for light theme, dark for dark theme
      expect(lightColors.background).toBe('#ffffff');
      expect(darkColors.background).not.toBe('#ffffff');
      
      // Text should be dark for light theme, light for dark theme
      expect(lightColors.text).toMatch(/^#[01][0-9a-f]{5}$/); // Dark color
      expect(darkColors.text).toMatch(/^#[def][0-9a-f]{5}$/); // Light color
    });
  });

  describe('integration tests', () => {
    it('color functions work together for multiple senders', () => {
      const senders = ['Alice', 'Bob', 'Charlie'];
      const lightColors = senders.map((_, i) => getSenderColor(i, 'light'));
      const darkColors = senders.map((_, i) => getSenderColor(i, 'dark'));
      
      // All colors should be unique within theme
      const uniqueLightColors = new Set(lightColors);
      const uniqueDarkColors = new Set(darkColors);
      
      expect(uniqueLightColors.size).toBe(senders.length);
      expect(uniqueDarkColors.size).toBe(senders.length);
    });

    it('chart colors complement sender colors', () => {
      const chartColors = getChartColors('light');
      const senderColors = getSenderColors('light');
      
      // Chart line color should be compatible with sender colors
      expect(senderColors).toContain(chartColors.line);
    });

    it('provides consistent theming across all functions', () => {
      const lightChartColors = getChartColors('light');
      const darkChartColors = getChartColors('dark');
      const lightSenderColors = getSenderColors('light');
      const darkSenderColors = getSenderColors('dark');
      
      // All should provide valid color schemes
      expect(lightChartColors.line).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(darkChartColors.line).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(lightSenderColors.length).toBeGreaterThan(0);
      expect(darkSenderColors.length).toBeGreaterThan(0);
    });
  });
});