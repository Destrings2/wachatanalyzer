import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics } from '../../types';
import { format } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { Phone, Video, Clock, Target } from 'lucide-react';
import * as d3 from 'd3';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { GlassContainer } from '../common/GlassContainer';
import { MetricCard } from '../common/MetricCard';

interface CallAnalysisProps {
  analytics: ProcessedAnalytics;
  isLoading?: boolean;
}

type AnalysisView = 'overview' | 'duration' | 'patterns' | 'success' | 'participants';

export const CallAnalysis: React.FC<CallAnalysisProps> = () => {
  const { rawCalls } = useChatStore();
  const { theme } = useTheme();
  const [activeView, setActiveView] = useState<AnalysisView>('overview');
  const isDark = theme === 'dark';

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
      completionRate
    };
  }, [rawCalls]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

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
        {(['overview', 'patterns', 'participants'] as const).map((mode) => (
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