import { Theme } from '../types';

/**
 * Shared color palette for sender visualization
 */
export const getSenderColors = (theme: Theme): string[] => [
  theme === 'dark' ? '#60a5fa' : '#3b82f6', // Blue
  theme === 'dark' ? '#f59e0b' : '#d97706', // Amber
  theme === 'dark' ? '#10b981' : '#059669', // Emerald
  theme === 'dark' ? '#ef4444' : '#dc2626', // Red
  theme === 'dark' ? '#8b5cf6' : '#7c3aed', // Violet
  theme === 'dark' ? '#06b6d4' : '#0891b2', // Cyan
  theme === 'dark' ? '#f97316' : '#ea580c', // Orange
  theme === 'dark' ? '#ec4899' : '#db2777', // Pink
  theme === 'dark' ? '#84cc16' : '#65a30d', // Lime
  theme === 'dark' ? '#6366f1' : '#4f46e5', // Indigo
];

/**
 * Get color for a specific sender by index
 */
export const getSenderColor = (senderIndex: number, theme: Theme): string => {
  const colors = getSenderColors(theme);
  return colors[senderIndex % colors.length];
};

/**
 * Get consistent sender index from sender list
 */
export const getSenderIndex = (sender: string, allSenders: string[]): number => {
  return allSenders.indexOf(sender);
};

/**
 * Get color for a specific sender by name
 */
export const getSenderColorByName = (sender: string, allSenders: string[], theme: Theme): string => {
  const index = getSenderIndex(sender, allSenders);
  return getSenderColor(index, theme);
};

/**
 * Generate sender legend data
 */
export interface SenderLegendItem {
  sender: string;
  color: string;
  index: number;
}

export const generateSenderLegend = (senders: string[], theme: Theme): SenderLegendItem[] => {
  return senders.map((sender, index) => ({
    sender,
    color: getSenderColor(index, theme),
    index,
  }));
};

/**
 * Truncate sender name for display
 */
export const truncateSenderName = (sender: string, maxLength: number = 15): string => {
  return sender.length > maxLength ? `${sender.substring(0, maxLength)}...` : sender;
};
