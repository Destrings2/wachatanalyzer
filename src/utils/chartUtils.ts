import { Theme } from '../types';

// Shared color palette for different senders
export function getSenderColors(theme: Theme): string[] {
  return theme === 'dark' ? [
    '#a855f7', // Purple (Primary)
    '#ec4899', // Pink (Secondary)
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#84cc16', // Lime
  ] : [
    '#9333ea', // Purple (Primary)
    '#db2777', // Pink (Secondary)
    '#0891b2', // Cyan
    '#059669', // Emerald
    '#d97706', // Amber
    '#dc2626', // Red
    '#7c3aed', // Violet
    '#e11d48', // Rose
    '#0d9488', // Teal
    '#ea580c', // Orange
    '#4f46e5', // Indigo
    '#65a30d', // Lime
  ];
}

// Get color for a specific sender by index
export function getSenderColor(senderIndex: number, theme: Theme): string {
  const colors = getSenderColors(theme);
  return colors[senderIndex % colors.length];
}

// Common chart colors based on theme
export function getChartColors(theme: Theme) {
  return {
    line: theme === 'dark' ? '#a855f7' : '#9333ea', // Primary Purple
    area: theme === 'dark' ? '#a855f7' : '#9333ea',
    axis: theme === 'dark' ? '#9ca3af' : '#6b7280',
    grid: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    text: theme === 'dark' ? '#f3f4f6' : '#111827',
    brush: theme === 'dark' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(147, 51, 234, 0.1)',
    brushHandle: theme === 'dark' ? '#a855f7' : '#9333ea',
    background: theme === 'dark' ? '#1f2937' : '#ffffff',
    low: theme === 'dark' ? '#4c1d95' : '#f3e8ff',
    high: theme === 'dark' ? '#a855f7' : '#9333ea',
  };
}