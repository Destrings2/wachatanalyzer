import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import { format, startOfDay, eachDayOfInterval, addDays, startOfWeek, endOfWeek, getDay, startOfYear, endOfYear, getYear } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { useFilterStore } from '../../stores/filterStore';
import { Info, ChevronLeft, ChevronRight, Calendar, BarChart3, Check } from 'lucide-react';
import clsx from 'clsx';

interface ActivityHeatmapProps {
  analytics: ProcessedAnalytics;
  messages: Message[];
  isLoading?: boolean;
}

// Tooltip component
const Tooltip: React.FC<{ content: string; children: React.ReactNode; className?: string }> = ({
  content,
  children,
  className = ''
}) => (
  <div className={`group relative inline-block ${className}`}>
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
      {content}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
    </div>
  </div>
);

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ analytics, messages, isLoading }) => {
  const { metadata, analytics: rawAnalytics } = useChatStore();
  const { searchKeyword } = useFilterStore();

  // Year navigation for multi-year data
  const availableYears = useMemo(() => {
    if (!metadata) return [];
    const startYear = getYear(metadata.dateRange.start);
    const endYear = getYear(metadata.dateRange.end);
    const years = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  }, [metadata]);

  const [selectedYear, setSelectedYear] = useState(() =>
    availableYears.length > 0 ? availableYears[availableYears.length - 1] : new Date().getFullYear()
  );
  const [normalizeSearch, setNormalizeSearch] = useState(true);

  const { heatmapData, totalDailyMessages, totalHourlyPatterns } = useMemo(() => {
    if (!analytics || !metadata) {
      return {
        heatmapData: {
          weeks: [],
          maxActivity: 0,
          totalDays: 0,
          hourlyPatterns: {} as Record<string, Record<number, number>>,
          activeParticipants: {},
          activityStreaks: { current: 0, longest: 0 },
          averageMessageLength: {},
          mediaActivity: {},
          responseVelocity: {}
        },
        totalDailyMessages: {} as Record<string, number>,
        totalHourlyPatterns: {} as Record<string, Record<number, number>>
      };
    }

    // Get date range for selected year
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 11, 31));
    const startDate = startOfDay(yearStart > metadata.dateRange.start ? yearStart : metadata.dateRange.start);
    const endDate = startOfDay(yearEnd < metadata.dateRange.end ? yearEnd : metadata.dateRange.end);

    // Use analytics data which is already filtered
    const dailyActivityMap: Record<string, number> = {};
    const totalDailyMessages: Record<string, number> = {}; // Total messages per day (for normalization)
    const activeParticipants: Record<string, string[]> = {};
    const mediaActivity: Record<string, number> = {};
    const hourlyPatterns: Record<string, Record<number, number>> = {}; // day of week -> hour -> count
    const totalHourlyPatterns: Record<string, Record<number, number>> = {}; // Total hourly patterns for normalization

    // Get unfiltered daily totals for normalization from raw analytics
    if (searchKeyword && normalizeSearch && rawAnalytics) {
      Object.entries(rawAnalytics.timePatterns.dailyActivity).forEach(([_sender, dailyData]) => {
        Object.entries(dailyData).forEach(([date, count]) => {
          const msgDate = new Date(date);
          const msgYear = getYear(msgDate);
          if (msgYear === selectedYear) {
            totalDailyMessages[date] = (totalDailyMessages[date] || 0) + count;
          }
        });
      });
    }

    // Initialize hourly patterns (7 days x 24 hours)
    for (let day = 0; day < 7; day++) {
      hourlyPatterns[day.toString()] = {};
      totalHourlyPatterns[day.toString()] = {};
      for (let hour = 0; hour < 24; hour++) {
        hourlyPatterns[day.toString()][hour] = 0;
        totalHourlyPatterns[day.toString()][hour] = 0;
      }
    }

    // Aggregate daily activity from analytics (already filtered)
    Object.entries(analytics.timePatterns.dailyActivity).forEach(([sender, dailyData]) => {
      Object.entries(dailyData).forEach(([date, count]) => {
        const msgDate = new Date(date);
        const msgYear = getYear(msgDate);
        
        // Filter by selected year
        if (msgYear !== selectedYear) return;
        
        // Daily message count
        dailyActivityMap[date] = (dailyActivityMap[date] || 0) + count;
        
        // Track active participants
        if (!activeParticipants[date]) activeParticipants[date] = [];
        if (!activeParticipants[date].includes(sender)) {
          activeParticipants[date].push(sender);
        }
      });
    });

    // Calculate actual hourly patterns by day of week from filtered messages
    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        const msgYear = getYear(msg.datetime);
        // Only include messages from the selected year
        if (msgYear === selectedYear) {
          const dayOfWeek = getDay(msg.datetime);
          const hour = msg.datetime.getHours();
          hourlyPatterns[dayOfWeek.toString()][hour]++;
        }
      });
    }

    // Calculate total hourly patterns from raw analytics for normalization
    if (searchKeyword && normalizeSearch && rawAnalytics) {
      // Get raw message data from chatStore for total hourly patterns
      const { rawMessages } = useChatStore.getState();
      if (rawMessages && rawMessages.length > 0) {
        rawMessages.forEach(msg => {
          const msgYear = getYear(msg.datetime);
          if (msgYear === selectedYear) {
            const dayOfWeek = getDay(msg.datetime);
            const hour = msg.datetime.getHours();
            totalHourlyPatterns[dayOfWeek.toString()][hour]++;
          }
        });
      }
    }

    // Media activity from analytics - use messageStats.mediaPerSender
    if (analytics.messageStats.mediaPerSender) {
      const totalMediaMessages = Object.values(analytics.messageStats.mediaPerSender).reduce((sum, count) => sum + count, 0);
      // Distribute media messages across active days (approximation)
      const activeDays = Object.keys(dailyActivityMap);
      if (activeDays.length > 0 && totalMediaMessages > 0) {
        const mediaPerDay = totalMediaMessages / activeDays.length;
        activeDays.forEach(date => {
          mediaActivity[date] = (mediaActivity[date] || 0) + mediaPerDay;
        });
      }
    }

    // Calculate activity streaks
    const sortedDates = Object.keys(dailyActivityMap).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let previousDate: Date | null = null;

    sortedDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      if (previousDate && (currentDate.getTime() - previousDate.getTime()) === 24 * 60 * 60 * 1000) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      previousDate = currentDate;
    });

    // Get all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Find max activity for scaling
    const maxActivity = Math.max(...Object.values(dailyActivityMap), 1);

    // Group days into weeks starting from Sunday
    const weeks: Array<Array<{ date: Date; activity: number; dateKey: string }>> = [];
    let currentWeek: Array<{ date: Date; activity: number; dateKey: string }> = [];

    // Start from the Sunday of the week containing the first day
    let currentDate = startOfWeek(startDate, { weekStartsOn: 0 });
    const lastDate = endOfWeek(endDate, { weekStartsOn: 0 });

    while (currentDate <= lastDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const activity = dailyActivityMap[dateKey] || 0;

      currentWeek.push({
        date: new Date(currentDate),
        activity,
        dateKey
      });

      // If it's Saturday (day 6) or we've reached the end, start a new week
      if (getDay(currentDate) === 6 || currentDate >= lastDate) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }

      currentDate = addDays(currentDate, 1);
    }

    return {
      heatmapData: {
        weeks,
        maxActivity,
        totalDays: allDays.length,
        hourlyPatterns,
        activeParticipants,
        activityStreaks: { current: currentStreak, longest: longestStreak },
        averageMessageLength: {},
        mediaActivity,
        activeDays: sortedDates.length,
        peakParticipants: Math.max(...Object.values(activeParticipants).map(p => p.length), 0),
        totalMediaMessages: Math.round(Object.values(mediaActivity).reduce((sum, count) => sum + count, 0))
      },
      totalDailyMessages,
      totalHourlyPatterns
    };
  }, [selectedYear, metadata, analytics, messages, searchKeyword, normalizeSearch, rawAnalytics]);

  const getActivityIntensity = (activity: number, maxActivity: number) => {
    if (activity === 0) return 0;
    return Math.ceil((activity / maxActivity) * 4); // 4 intensity levels
  };

  const getActivityColor = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-gray-100 dark:bg-gray-800';
      case 1: return 'bg-blue-200 dark:bg-blue-900';
      case 2: return 'bg-blue-400 dark:bg-blue-700';
      case 3: return 'bg-blue-600 dark:bg-blue-500';
      case 4: return 'bg-blue-800 dark:bg-blue-400';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics || Object.keys(analytics.timePatterns.dailyActivity).length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Message Data</div>
          <p className="text-gray-500 dark:text-gray-400">No messages found to generate activity heatmap.</p>
        </div>
      </div>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header with Year Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Heatmap</h3>
          <Tooltip content="Daily message activity over time. Darker colors indicate more activity.">
            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </Tooltip>
        </div>

        <div className="flex items-center gap-4 mr-12">
          {/* Normalization Toggle */}
          {searchKeyword && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNormalizeSearch(!normalizeSearch)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={normalizeSearch ? "Show absolute counts" : "Normalize by daily message volume"}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="font-medium">Normalize</span>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  normalizeSearch
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {normalizeSearch && (
                    <Check className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Year Navigation */}
          {availableYears.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(Math.max(selectedYear - 1, availableYears[0]))}
                disabled={selectedYear <= availableYears[0]}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedYear}</span>
              </div>

              <button
                onClick={() => setSelectedYear(Math.min(selectedYear + 1, availableYears[availableYears.length - 1]))}
                disabled={selectedYear >= availableYears[availableYears.length - 1]}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        <Tooltip content="Number of days with at least one message">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-green-600 dark:text-green-400">
              {heatmapData.activeDays || 0}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Active Days</div>
          </div>
        </Tooltip>

        <Tooltip content="Highest number of messages sent in a single day">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {heatmapData.maxActivity}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Peak Day</div>
          </div>
        </Tooltip>

        <Tooltip content="Longest consecutive days with messages">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {heatmapData.activityStreaks.longest}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Longest Streak</div>
          </div>
        </Tooltip>

        <Tooltip content="Maximum number of different people active in one day">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-orange-600 dark:text-orange-400">
              {heatmapData.peakParticipants}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Peak Participants</div>
          </div>
        </Tooltip>

        <Tooltip content="Total media messages (photos, videos, etc.) sent">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-pink-600 dark:text-pink-400">
              {heatmapData.totalMediaMessages}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Media Messages</div>
          </div>
        </Tooltip>

        <Tooltip content="Percentage of days with activity in this year">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 lg:p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-lg lg:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {Math.round(((heatmapData.activeDays || 0) / heatmapData.totalDays) * 100)}%
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Activity Rate</div>
          </div>
        </Tooltip>
      </div>

      {/* Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 overflow-x-auto">
        <div className="min-w-max">
          {/* Month labels */}
          <div className="flex mb-2">
            <div className="w-8"></div> {/* Space for day labels */}
            {heatmapData.weeks.map((week, weekIndex) => {
              const firstDay = week[0];
              if (!firstDay || weekIndex === 0 || firstDay.date.getDate() <= 7) {
                const monthLabel = weekIndex === 0 || firstDay.date.getDate() <= 7
                  ? monthNames[firstDay.date.getMonth()]
                  : '';
                return (
                  <div key={weekIndex} className="w-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                    {monthLabel}
                  </div>
                );
              }
              return <div key={weekIndex} className="w-4"></div>;
            })}
          </div>

          {/* Heatmap grid */}
          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col mr-2">
              {dayNames.map((day, index) => (
                <div
                  key={day}
                  className={clsx(
                    'w-6 h-4 text-xs text-gray-500 dark:text-gray-400 flex items-center',
                    index % 2 === 1 ? 'opacity-100' : 'opacity-0' // Show every other day
                  )}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex gap-1">
              {heatmapData.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day) => {
                    // Calculate normalized or absolute intensity
                    let tooltipText = `${format(day.date, 'MMM d, yyyy')}: ${day.activity} messages`;
                    let intensity = getActivityIntensity(day.activity, heatmapData.maxActivity);
                    
                    if (searchKeyword && normalizeSearch && totalDailyMessages[day.dateKey]) {
                      const normalizedValue = (day.activity / totalDailyMessages[day.dateKey]) * 100;
                      tooltipText = `${format(day.date, 'MMM d, yyyy')}: ${day.activity} matches / ${totalDailyMessages[day.dateKey]} total (${normalizedValue.toFixed(1)}%)`;
                      intensity = normalizedValue > 0 ? Math.max(1, Math.ceil((normalizedValue / 25) * 4)) : 0; // Scale 0-25% to intensity 1-4
                    }
                    
                    const isInRange = day.date >= metadata!.dateRange.start && day.date <= metadata!.dateRange.end;

                    return (
                      <Tooltip
                        key={day.dateKey}
                        content={tooltipText}
                      >
                        <div
                          className={clsx(
                            'w-3 h-3 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110',
                            isInRange ? getActivityColor(intensity) : 'bg-gray-50 dark:bg-gray-900',
                            !isInRange && 'opacity-30'
                          )}
                        />
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Intensity Legend */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(intensity => (
            <div
              key={intensity}
              className={`w-3 h-3 rounded-sm ${getActivityColor(intensity)}`}
            />
          ))}
        </div>
        <span>More</span>
      </div>

      {/* Weekly Activity Pattern Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Activity Patterns</h4>
          <Tooltip content="Shows when during the week people are most active (darker = more messages)">
            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </Tooltip>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Hour labels */}
            <div className="flex mb-2">
              <div className="w-16"></div> {/* Space for day labels */}
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="w-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  {hour % 4 === 0 ? hour : ''}
                </div>
              ))}
            </div>

            {/* Weekly heatmap grid */}
            {dayNames.map((dayName, dayIndex) => {
              // Calculate max activity for scaling (either normalized or absolute)
              let maxHourlyActivity = 1;
              const isNormalized = searchKeyword && normalizeSearch;
              
              if (isNormalized && totalHourlyPatterns[dayIndex.toString()]) {
                // For normalized data, find max percentage across all hours
                const normalizedValues = Array.from({ length: 24 }, (_, hour) => {
                  const activity = heatmapData.hourlyPatterns[dayIndex.toString()]?.[hour] || 0;
                  const total = totalHourlyPatterns[dayIndex.toString()]?.[hour] || 0;
                  return total > 0 ? (activity / total) * 100 : 0;
                });
                maxHourlyActivity = Math.max(...normalizedValues, 1);
              } else {
                // For absolute data, use original logic
                maxHourlyActivity = Math.max(
                  ...Object.values(heatmapData.hourlyPatterns[dayIndex.toString()] || {}),
                  1
                );
              }

              return (
                <div key={dayName} className="flex items-center mb-1">
                  <div className="w-14 text-right pr-2 text-sm text-gray-600 dark:text-gray-400">
                    {dayName}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const activity = heatmapData.hourlyPatterns[dayIndex.toString()]?.[hour] || 0;
                      let tooltipText = `${dayName} ${hour.toString().padStart(2, '0')}:00 - ${activity} messages`;
                      let intensity;

                      if (isNormalized && totalHourlyPatterns[dayIndex.toString()]?.[hour]) {
                        const total = totalHourlyPatterns[dayIndex.toString()][hour];
                        const normalizedValue = (activity / total) * 100;
                        tooltipText = `${dayName} ${hour.toString().padStart(2, '0')}:00 - ${activity} matches / ${total} total (${normalizedValue.toFixed(1)}%)`;
                        intensity = normalizedValue > 0 ? Math.max(1, Math.ceil((normalizedValue / maxHourlyActivity) * 4)) : 0;
                      } else {
                        intensity = maxHourlyActivity > 0 ? Math.ceil((activity / maxHourlyActivity) * 4) : 0;
                      }

                      return (
                        <Tooltip
                          key={hour}
                          content={tooltipText}
                        >
                          <div
                            className={clsx(
                              'w-5 h-4 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110',
                              getActivityColor(intensity)
                            )}
                          />
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
