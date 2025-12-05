import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics } from '../../types';
import { format, startOfDay, eachDayOfInterval, getDay, startOfYear, endOfYear, getYear } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { Phone, Video, Clock, Target } from 'lucide-react';
import * as d3 from 'd3';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { GlassContainer } from '../common/GlassContainer';
import { MetricCard } from '../common/MetricCard';
import { Tooltip } from '../common/Tooltip';
import clsx from 'clsx';

interface CallAnalysisProps {
  analytics: ProcessedAnalytics;
  isLoading?: boolean;
}

type AnalysisView = 'overview' | 'heatmap' | 'duration' | 'patterns' | 'success' | 'participants';

export const CallAnalysis: React.FC<CallAnalysisProps> = () => {
  const { rawCalls, metadata } = useChatStore();
  const { theme } = useTheme();
  const [activeView, setActiveView] = useState<AnalysisView>('overview');
  const isDark = theme === 'dark';

  // Year navigation for heatmap
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

  const callStats = useMemo(() => {
    if (!rawCalls || rawCalls.length === 0) {
      return {
        totalDuration: 0,
        avgDuration: 0,
        longestCall: 0,
        shortestCall: 0,
        voiceCalls: 0,
        videoCalls: 0,
        durationByType: { voice: 0, video: 0 },
        callsByInitiator: {},
        durationDistribution: [],
        dailyCalls: [],
        hourlySuccess: {},
        completionRate: 0
      };
    }

    // Basic stats
    const completedCalls = rawCalls.filter(call => call.status === 'completed');
    const totalDuration = completedCalls.reduce((sum, call) => sum + call.duration, 0);
    const voiceCalls = rawCalls.filter(call => call.type === 'voice').length;
    const videoCalls = rawCalls.filter(call => call.type === 'video').length;

    // Duration analysis
    const durations = completedCalls.map(call => call.duration).filter(d => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
    const longestCall = durations.length > 0 ? Math.max(...durations) : 0;
    const shortestCall = durations.length > 0 ? Math.min(...durations) : 0;

    // Duration by type
    const durationByType = {
      voice: completedCalls.filter(call => call.type === 'voice').reduce((sum, call) => sum + call.duration, 0),
      video: completedCalls.filter(call => call.type === 'video').reduce((sum, call) => sum + call.duration, 0)
    };

    // Calls by initiator
    const callsByInitiator: Record<string, number> = {};
    rawCalls.forEach(call => {
      callsByInitiator[call.initiator] = (callsByInitiator[call.initiator] || 0) + 1;
    });

    // Daily call activity
    const dailyCalls: { date: Date; count: number; duration: number }[] = [];
    const callsByDate: Record<string, { count: number; duration: number }> = {};

    rawCalls.forEach(call => {
      const dateKey = format(call.timestamp, 'yyyy-MM-dd');
      if (!callsByDate[dateKey]) {
        callsByDate[dateKey] = { count: 0, duration: 0 };
      }
      callsByDate[dateKey].count++;
      callsByDate[dateKey].duration += call.duration;
    });

    // Hourly success rate
    const hourlySuccess: Record<number, { total: number; completed: number }> = {};
    rawCalls.forEach(call => {
      const hour = new Date(call.timestamp).getHours();
      if (!hourlySuccess[hour]) {
        hourlySuccess[hour] = { total: 0, completed: 0 };
      }
      hourlySuccess[hour].total++;
      if (call.status === 'completed') {
        hourlySuccess[hour].completed++;
      }
    });

    const completionRate = rawCalls.length > 0
      ? (completedCalls.length / rawCalls.length) * 100
      : 0;

    // Heatmap Data
    const heatmapData = (() => {
      if (!metadata) return null;

      const yearStart = startOfYear(new Date(selectedYear, 0, 1));
      const yearEnd = endOfYear(new Date(selectedYear, 11, 31));
      const startDate = startOfDay(yearStart > metadata.dateRange.start ? yearStart : metadata.dateRange.start);
      const endDate = startOfDay(yearEnd < metadata.dateRange.end ? yearEnd : metadata.dateRange.end);

      const dailyActivityMap: Record<string, number> = {};
      const weeks: ({ date: Date; dateKey: string; count: number } | null)[][] = [];
      let currentWeek: ({ date: Date; dateKey: string; count: number } | null)[] = [];

      // Populate daily activity
      rawCalls.forEach(call => {
        const callYear = getYear(call.timestamp);
        if (callYear === selectedYear) {
          const dateKey = format(call.timestamp, 'yyyy-MM-dd');
          dailyActivityMap[dateKey] = (dailyActivityMap[dateKey] || 0) + 1;
        }
      });

      const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });

      // Pad first week
      const firstDayOfWeek = getDay(startDate);
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push(null);
      }

      let maxActivity = 0;
      let activeDays = 0;

      daysInterval.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const count = dailyActivityMap[dateKey] || 0;

        if (count > maxActivity) maxActivity = count;
        if (count > 0) activeDays++;

        currentWeek.push({ date: day, dateKey, count });

        if (currentWeek.length === 7) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      });

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }

      return {
        weeks,
        maxActivity,
        activeDays,
        totalDays: daysInterval.length
      };
    })();

    return {
      totalDuration,
      avgDuration,
      longestCall,
      shortestCall,
      voiceCalls,
      videoCalls,
      durationByType,
      callsByInitiator,
      dailyCalls,
      hourlySuccess,
      completionRate,
      heatmapData
    };
  }, [rawCalls, metadata, selectedYear]);

  const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getActivityColor = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-gray-100 dark:bg-gray-800';
      case 1: return 'bg-emerald-200 dark:bg-emerald-900/40';
      case 2: return 'bg-emerald-300 dark:bg-emerald-800/60';
      case 3: return 'bg-emerald-400 dark:bg-emerald-700/80';
      case 4: return 'bg-emerald-500 dark:bg-emerald-600';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  };

  const getActivityIntensity = (count: number, max: number) => {
    if (count === 0) return 0;
    if (max === 0) return 0;
    const percentage = count / max;
    if (percentage < 0.25) return 1;
    if (percentage < 0.5) return 2;
    if (percentage < 0.75) return 3;
    return 4;
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Render hourly patterns chart
  const renderHourlyPatterns = useD3((svg) => {
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = 800 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = Array.from({ length: 24 }, (_, i) => {
      const stats = callStats.hourlySuccess[i] || { total: 0, completed: 0 };
      return {
        hour: i,
        rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
        total: stats.total
      };
    });

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.hour.toString()))
      .padding(0.1);

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, 100]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}:00`))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('fill', isDark ? '#9CA3AF' : '#6B7280');

    g.append('g')
      .call(d3.axisLeft(y).tickFormat(d => `${d}%`))
      .selectAll('text')
      .style('fill', isDark ? '#9CA3AF' : '#6B7280');

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.hour.toString()) || 0)
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.rate))
      .attr('height', d => height - y(d.rate))
      .attr('fill', d => `rgba(59, 130, 246, ${0.3 + (d.total / Math.max(...data.map(i => i.total))) * 0.7})`)
      .attr('rx', 4)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        const tooltip = d3.select('body').append('div')
          .attr('class', 'chart-tooltip')
          .style('position', 'absolute')
          .style('background', isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)')
          .style('color', isDark ? '#fff' : '#000')
          .style('padding', '8px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1)');

        tooltip.html(`
          <strong>${d.hour}:00</strong><br/>
          Success Rate: ${d.rate.toFixed(1)}%<br/>
          Total Calls: ${d.total}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        d3.selectAll('.chart-tooltip').remove();
      });

  }, [callStats, isDark]);

  if (!rawCalls || rawCalls.length === 0) {
    return (
      <GlassContainer className="flex flex-col items-center justify-center p-12 text-center">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
          <Phone className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Call Data Available</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          No calls were found in this chat export. This feature analyzes voice and video call patterns.
        </p>
      </GlassContainer>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label="Total Call Time"
          value={formatDuration(callStats.totalDuration)}
          color="blue"
          description={`${rawCalls.length} total calls recorded`}
        />
        <MetricCard
          icon={Target}
          label="Success Rate"
          value={`${callStats.completionRate.toFixed(1)}%`}
          color="emerald"
          description="Percentage of completed calls"
          trend={callStats.completionRate > 80 ? "High" : "Average"}
        />
        <MetricCard
          icon={Video}
          label="Video Calls"
          value={callStats.videoCalls.toString()}
          color="purple"
          description={`${((callStats.videoCalls / rawCalls.length) * 100).toFixed(1)}% of all calls`}
        />
        <MetricCard
          icon={Phone}
          label="Voice Calls"
          value={callStats.voiceCalls.toString()}
          color="indigo"
          description={`${((callStats.voiceCalls / rawCalls.length) * 100).toFixed(1)}% of all calls`}
        />
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 bg-white/50 dark:bg-gray-900/50 rounded-xl backdrop-blur-sm border border-white/10 overflow-x-auto">
        {(['overview', 'heatmap', 'patterns', 'participants'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setActiveView(mode)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${activeView === mode
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm scale-105'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <GlassContainer>
        {activeView === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Call Duration Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Video Calls</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{callStats.videoCalls} calls</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">{formatDuration(callStats.durationByType.video)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">total time</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                      <Phone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Voice Calls</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{callStats.voiceCalls} calls</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900 dark:text-white">{formatDuration(callStats.durationByType.voice)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">total time</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Longest Call</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{formatDuration(callStats.longestCall)}</div>
                </div>
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Call</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{formatDuration(callStats.avgDuration)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'heatmap' && callStats.heatmapData && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Call Activity Heatmap</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tracking {callStats.heatmapData.activeDays} active days in {selectedYear}
                </p>
              </div>

              {availableYears.length > 1 && (
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  {availableYears.map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={clsx(
                        "px-3 py-1 text-xs font-medium rounded-md transition-all",
                        selectedYear === year
                          ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
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

            {/* Heatmap Grid */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 overflow-x-auto border border-white/10">
              <div className="min-w-max">
                {/* Month labels */}
                <div className="flex mb-2">
                  <div className="w-8"></div>
                  {callStats.heatmapData.weeks.map((week, weekIndex) => {
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

                <div className="flex">
                  {/* Day labels */}
                  <div className="flex flex-col mr-2 gap-1">
                    {dayNames.map((day, index) => (
                      <div
                        key={day}
                        className={clsx(
                          'w-6 h-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 flex items-center',
                          index % 2 === 1 ? 'opacity-100' : 'opacity-0'
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="flex gap-1">
                    {callStats.heatmapData.weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-1">
                        {week.map((day, dayIndex) => {
                          if (!day) return <div key={dayIndex} className="w-4 h-3"></div>;

                          const intensity = getActivityIntensity(day.count, callStats.heatmapData!.maxActivity);
                          const tooltipText = `${format(day.date, 'MMM d, yyyy')}: ${day.count} calls`;
                          const isInRange = metadata && day.date >= metadata.dateRange.start && day.date <= metadata.dateRange.end;

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
          </div>
        )}

        {activeView === 'patterns' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Hourly Success Rate</h3>
            <div className="overflow-x-auto">
              <svg ref={renderHourlyPatterns} className="w-full h-auto" />
            </div>
          </div>
        )}

        {activeView === 'participants' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Call Initiators</h3>
            <div className="space-y-3">
              {Object.entries(callStats.callsByInitiator)
                .sort(([, a], [, b]) => b - a)
                .map(([initiator, count]) => (
                  <div key={initiator} className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                        {initiator.substring(0, 1)}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{initiator}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${(count / rawCalls.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white w-12 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </GlassContainer>
    </div>
  );
};