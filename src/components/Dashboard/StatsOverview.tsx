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
      value: `${analytics.messageStats.totalMessages.toLocaleString()}`,
      icon: MessageSquare,
      color: 'from-blue-500 to-cyan-500',
      change: `${analytics.messageStats.totalWords.toLocaleString()} words`,
    },
    {
      label: 'Avg Response Time',
      value: `${Math.round(analytics.responseMetrics.averageResponseTime)} min`,
      icon: Clock,
      color: 'from-green-500 to-emerald-500',
      change: 'Between messages',
    },
    {
      label: 'Emojis Used',
      value: analytics.emojiAnalysis.totalEmojis.toLocaleString(),
      icon: Smile,
      color: 'from-yellow-500 to-orange-500',
      change: `${analytics.emojiAnalysis.uniqueEmojis} unique`,
    },
    {
      label: 'Unique Words',
      value: analytics.wordFrequency.uniqueWords.toLocaleString(),
      icon: Hash,
      color: 'from-purple-500 to-pink-500',
      change: `${analytics.messageStats.averageMessageLength.toFixed(0)} avg chars`,
    },
    {
      label: 'Video Calls',
      value: analytics.callAnalytics.totalCalls.toLocaleString(),
      icon: Phone,
      color: 'from-pink-500 to-rose-500',
      change: `${analytics.callAnalytics.completedCalls} completed`,
    },
    {
      label: 'Active Days',
      value: new Set(Object.values(analytics.timePatterns.dailyActivity).flatMap(senderDays => Object.keys(senderDays))).size.toLocaleString(),
      icon: Users,
      color: 'from-indigo-500 to-violet-500',
      change: `${Math.round((Date.now() - metadata.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} day span`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="group relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 lg:p-6 shadow-sm border border-white/20 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Gradient Background Glow */}
            <div className={clsx(
              "absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
              stat.color
            )} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div className={clsx(
                  'p-2.5 rounded-xl bg-gradient-to-br text-white shadow-md transform transition-transform group-hover:scale-110',
                  stat.color
                )}>
                  <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                </div>
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                  {stat.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 lg:mt-2 font-medium">
                  {stat.change}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
