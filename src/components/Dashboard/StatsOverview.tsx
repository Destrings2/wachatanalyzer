import React from 'react';
import { ProcessedAnalytics, ChatMetadata } from '../../types';
import { MessageSquare, Clock, Smile, Hash, Phone, Users } from 'lucide-react';
import clsx from 'clsx';

interface StatsOverviewProps {
  analytics: ProcessedAnalytics;
  metadata: ChatMetadata;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ analytics, metadata }) => {
  const stats = [
    {
      label: 'Total Messages',
      value: metadata.totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: 'blue',
      change: `${analytics.messageStats.totalWords.toLocaleString()} words`,
    },
    {
      label: 'Avg Response Time',
      value: `${Math.round(analytics.responseMetrics.averageResponseTime)} min`,
      icon: Clock,
      color: 'green',
      change: 'Between messages',
    },
    {
      label: 'Emojis Used',
      value: analytics.emojiAnalysis.totalEmojis.toLocaleString(),
      icon: Smile,
      color: 'yellow',
      change: `${analytics.emojiAnalysis.uniqueEmojis} unique`,
    },
    {
      label: 'Unique Words',
      value: analytics.wordFrequency.uniqueWords.toLocaleString(),
      icon: Hash,
      color: 'purple',
      change: `${analytics.messageStats.averageMessageLength.toFixed(0)} avg chars`,
    },
    {
      label: 'Video Calls',
      value: analytics.callAnalytics.totalCalls.toLocaleString(),
      icon: Phone,
      color: 'pink',
      change: `${analytics.callAnalytics.completedCalls} completed`,
    },
    {
      label: 'Active Days',
      value: Object.keys(analytics.timePatterns.dailyActivity).length.toLocaleString(),
      icon: Users,
      color: 'indigo',
      change: `${Math.round((Date.now() - metadata.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} day span`,
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={clsx('p-2 rounded-lg', colorClasses[stat.color as keyof typeof colorClasses])}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                {stat.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {stat.change}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};