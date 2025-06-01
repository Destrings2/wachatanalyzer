import { Theme } from '../types';

// Shared color palette for different senders
export function getSenderColors(theme: Theme): string[] {
  return theme === 'dark' ? [
    '#60a5fa', // Blue
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#a855f7', // Purple
    '#84cc16', // Lime
    '#f43f5e', // Rose
  ] : [
    '#3b82f6', // Blue
    '#d97706', // Amber
    '#059669', // Emerald
    '#dc2626', // Red
    '#7c3aed', // Violet
    '#0891b2', // Cyan
    '#ea580c', // Orange
    '#db2777', // Pink
    '#0d9488', // Teal
    '#9333ea', // Purple
    '#65a30d', // Lime
    '#e11d48', // Rose
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
    line: theme === 'dark' ? '#60a5fa' : '#3b82f6',
    area: theme === 'dark' ? '#60a5fa' : '#3b82f6',
    axis: theme === 'dark' ? '#9ca3af' : '#6b7280',
    grid: theme === 'dark' ? '#374151' : '#e5e7eb',
    text: theme === 'dark' ? '#f3f4f6' : '#111827',
    brush: theme === 'dark' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.2)',
    brushHandle: theme === 'dark' ? '#60a5fa' : '#3b82f6',
    background: theme === 'dark' ? '#1f2937' : '#ffffff',
    low: theme === 'dark' ? '#1e3a8a' : '#dbeafe',
    high: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
  };
}