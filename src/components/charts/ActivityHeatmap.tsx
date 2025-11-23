import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import { format, startOfDay, eachDayOfInterval, addDays, startOfWeek, endOfWeek, getDay, startOfYear, endOfYear, getYear } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { useFilterStore } from '../../stores/filterStore';
import { Info, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { GlassContainer } from '../common/GlassContainer';
import { Tooltip } from '../common/Tooltip';

interface ActivityHeatmapProps {
  analytics: ProcessedAnalytics;
  messages: Message[];
  isLoading?: boolean;
}

const getActivityColor = (intensity: number) => {
  switch (intensity) {
    case 0: return 'bg-gray-100 dark:bg-gray-800';
    case 1: return 'bg-violet-200 dark:bg-violet-900/40';
    case 2: return 'bg-violet-300 dark:bg-violet-800/60';
    case 3: return 'bg-violet-400 dark:bg-violet-700/80';
    case 4: return 'bg-violet-500 dark:bg-violet-600';
    default: return 'bg-gray-100 dark:bg-gray-800';
  }
};

const getActivityIntensity = (activity: number, maxActivity: number) => {
  if (activity === 0) return 0;
  if (maxActivity === 0) return 0;
  const percentage = activity / maxActivity;
  if (percentage < 0.25) return 1;
  if (percentage < 0.5) return 2;
  if (percentage < 0.75) return 3;
  return 4;
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          responseVelocity: {},
          activeDays: 0,
          peakParticipants: 0,
          totalMediaMessages: 0
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
    const hourlyPatterns: Record<string, Record<number, number>> = {}; // day of week -> hour -> count
    const totalHourlyPatterns: Record<string, Record<number, number>> = {}; // Total hourly patterns for normalization

    // Get unfiltered daily totals for normalization from raw analytics
    if (searchKeyword && normalizeSearch && rawAnalytics) {
      Object.entries(rawAnalytics.timePatterns.dailyActivity).forEach(([, dailyData]) => {
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

    // Populate daily activity from filtered analytics
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

    // Media activity from analytics
    let totalMediaMessages = 0;
    if (analytics.messageStats.mediaPerSender) {
      totalMediaMessages = Object.values(analytics.messageStats.mediaPerSender).reduce((sum, count) => sum + count, 0);
    }

    // Generate weeks for heatmap
    const weeks = [];
    let currentWeek = [];
    const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });

    // Pad the first week if it doesn't start on Sunday
    const firstDayOfWeek = getDay(startDate);
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    let maxActivity = 0;
    let activeDays = 0;
    let peakParticipants = 0;
    let currentStreak = 0;
    let longestStreak = 0;

    daysInterval.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const activity = dailyActivityMap[dateKey] || 0;

      if (activity > maxActivity) maxActivity = activity;
      if (activity > 0) {
        activeDays++;
        currentStreak++;
      } else {
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        currentStreak = 0;
      }

      if (activeParticipants[dateKey] && activeParticipants[dateKey].length > peakParticipants) {
        peakParticipants = activeParticipants[dateKey].length;
      }

      currentWeek.push({
        date: day,
        dateKey,
        activity
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Final streak check
    if (currentStreak > longestStreak) longestStreak = currentStreak;

    // Push remaining days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return {
      heatmapData: {
        weeks,
        maxActivity,
        totalDays: daysInterval.length,
        hourlyPatterns,
        activeParticipants,
        activityStreaks: { current: currentStreak, longest: longestStreak },
        activeDays,
        peakParticipants,
        totalMediaMessages
      },
      totalDailyMessages,
      totalHourlyPatterns
    };
  }, [analytics, messages, metadata, selectedYear, searchKeyword, normalizeSearch, rawAnalytics]);

  return (
    <GlassContainer>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Activity Heatmap
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {searchKeyword ? (
              <>
                Showing matches for <span className="font-semibold text-primary-600 dark:text-primary-400">"{searchKeyword}"</span>
                {normalizeSearch && " (normalized)"}
              </>
            ) : (
              "When are people most active?"
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {searchKeyword && (
            <div className="flex items-center gap-2 mr-4">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Normalize</span>
              <button
                onClick={() => setNormalizeSearch(!normalizeSearch)}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  ${normalizeSearch ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}
                `}
              >
                <span
                  className={`
                    inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                    ${normalizeSearch ? 'translate-x-5' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          )}

          {availableYears.length > 1 && (
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`
                    px-3 py-1 text-xs font-medium rounded-md transition-all
                    ${selectedYear === year
                      ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }
                  `}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-6">
        <Tooltip content="Number of days with at least one message">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              {heatmapData.activeDays || 0}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Active Days</div>
          </div>
        </Tooltip>

        <Tooltip content="Highest number of messages sent in a single day">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-primary-500 dark:text-primary-400 group-hover:scale-110 transition-transform">
              {heatmapData.maxActivity}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Peak Day</div>
          </div>
        </Tooltip>

        <Tooltip content="Longest consecutive days with messages">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform">
              {heatmapData.activityStreaks.longest}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Longest Streak</div>
          </div>
        </Tooltip>

        <Tooltip content="Maximum number of different people active in one day">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-orange-500 dark:text-orange-400 group-hover:scale-110 transition-transform">
              {heatmapData.peakParticipants}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Peak Participants</div>
          </div>
        </Tooltip>

        <Tooltip content="Total media messages (photos, videos, etc.) sent">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-pink-500 dark:text-pink-400 group-hover:scale-110 transition-transform">
              {heatmapData.totalMediaMessages}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Media Messages</div>
          </div>
        </Tooltip>

        <Tooltip content="Percentage of days with activity in this year">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 text-center cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/10 group">
            <div className="text-lg lg:text-2xl font-bold text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              {Math.round(((heatmapData.activeDays || 0) / heatmapData.totalDays) * 100)}%
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-medium">Activity Rate</div>
          </div>
        </Tooltip>
      </div>

      {/* Intensity Legend */}
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50 p-2 rounded-lg inline-flex backdrop-blur-sm border border-white/10 mb-4">
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

      {/* Heatmap */}
      <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 overflow-x-auto border border-white/10 mb-6">
        <div className="min-w-max">
          {/* Month labels */}
          <div className="flex mb-2">
            <div className="w-8"></div> {/* Space for day labels */}
            {heatmapData.weeks.map((week, weekIndex) => {
              const firstDay = week[0];
              if (!firstDay || weekIndex === 0 || firstDay.date.getDate() <= 7) {
                const monthLabel = weekIndex === 0 || (firstDay && firstDay.date.getDate() <= 7)
                  ? monthNames[firstDay ? firstDay.date.getMonth() : 0]
                  : '';
                return (
                  <div key={weekIndex} className="w-4 text-xs font-medium text-gray-400 dark:text-gray-500 text-center">
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
            <div className="flex flex-col mr-2 gap-1">
              {dayNames.map((day, index) => (
                <div
                  key={day}
                  className={clsx(
                    'w-6 h-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 flex items-center',
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
                  {week.map((day, dayIndex) => {
                    if (!day) return <div key={dayIndex} className="w-4 h-3"></div>;

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
                            'w-4 h-3 rounded-[2px] cursor-pointer transition-all duration-200 hover:scale-125 hover:shadow-sm',
                            isInRange ? getActivityColor(intensity) : 'bg-gray-100/30 dark:bg-gray-800/30',
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

      {/* Weekly Activity Pattern Heatmap */}
      <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 border border-white/10">
        <div className="flex items-center gap-2 mb-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Weekly Activity Patterns</h4>
          <Tooltip content="Shows when during the week people are most active (darker = more messages)">
            <Info className="h-4 w-4 text-gray-400 hover:text-primary-500 cursor-help transition-colors" />
          </Tooltip>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-2">
          <div className="min-w-[800px]">
            <div className="flex flex-col gap-1">
              {/* Hour labels */}
              <div className="flex mb-2">
                <div className="w-16"></div> {/* Space for day labels */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="w-6 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
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
                    <div className="w-14 text-right pr-2 text-sm font-medium text-gray-500 dark:text-gray-400">
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
                                'w-5 h-4 rounded-sm cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-sm',
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
    </GlassContainer>
  );
};
