import React, { useMemo, useState, useCallback } from 'react';
import { ProcessedAnalytics } from '../../types';
import { format, startOfDay, eachDayOfInterval, isValid } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { Phone, Video, Clock, Target, TrendingUp, Calendar, Users, BarChart3, Info } from 'lucide-react';
import clsx from 'clsx';

interface CallAnalysisProps {
  analytics: ProcessedAnalytics;
  isLoading?: boolean;
}

type AnalysisView = 'overview' | 'duration' | 'patterns' | 'success' | 'participants';

// Tooltip component
const Tooltip: React.FC<{ content: string; children: React.ReactNode; className?: string }> = ({ 
  content, 
  children, 
  className = '' 
}) => (
  <div className={`group relative inline-block ${className}`}>
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
      {content}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
    </div>
  </div>
);

// Animated metric card
const MetricCard: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  color: string;
  description?: string;
  trend?: string;
}> = ({ icon: Icon, label, value, color, description, trend }) => (
  <Tooltip content={description || label}>
    <div className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`h-8 w-8 text-${color}-600 dark:text-${color}-400`} />
        {trend && (
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium text-${color}-900 dark:text-${color}-100 mb-2`}>{label}</p>
        <p className={`text-3xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
      </div>
    </div>
  </Tooltip>
);

export const CallAnalysis: React.FC<CallAnalysisProps> = ({ analytics, isLoading }) => {
  const { rawCalls, metadata } = useChatStore();
  const [activeView, setActiveView] = useState<AnalysisView>('overview');

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
    const callsByInitiator: Record<string, { total: number; completed: number; duration: number }> = {};
    rawCalls.forEach(call => {
      if (!callsByInitiator[call.initiator]) {
        callsByInitiator[call.initiator] = { total: 0, completed: 0, duration: 0 };
      }
      callsByInitiator[call.initiator].total++;
      if (call.status === 'completed') {
        callsByInitiator[call.initiator].completed++;
        callsByInitiator[call.initiator].duration += call.duration;
      }
    });

    // Duration distribution (buckets)
    const durationDistribution = [
      { label: '< 1 min', count: durations.filter(d => d < 1).length },
      { label: '1-5 min', count: durations.filter(d => d >= 1 && d < 5).length },
      { label: '5-15 min', count: durations.filter(d => d >= 5 && d < 15).length },
      { label: '15-30 min', count: durations.filter(d => d >= 15 && d < 30).length },
      { label: '30-60 min', count: durations.filter(d => d >= 30 && d < 60).length },
      { label: '> 1 hour', count: durations.filter(d => d >= 60).length }
    ];

    // Daily call pattern
    const dailyCalls: Record<string, { total: number; completed: number; avgDuration: number }> = {};
    if (metadata) {
      const days = eachDayOfInterval({
        start: startOfDay(metadata.dateRange.start),
        end: startOfDay(metadata.dateRange.end)
      });

      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayCalls = rawCalls.filter(call => 
          isValid(call.datetime) && format(startOfDay(call.datetime), 'yyyy-MM-dd') === dateKey
        );
        const dayCompleted = dayCalls.filter(call => call.status === 'completed');
        const dayDuration = dayCompleted.reduce((sum, call) => sum + call.duration, 0);
        
        dailyCalls[dateKey] = {
          total: dayCalls.length,
          completed: dayCompleted.length,
          avgDuration: dayCompleted.length > 0 ? dayDuration / dayCompleted.length : 0
        };
      });
    }

    // Hourly success rates
    const hourlySuccess: Record<number, { total: number; completed: number }> = {};
    for (let i = 0; i < 24; i++) {
      hourlySuccess[i] = { total: 0, completed: 0 };
    }
    
    rawCalls.forEach(call => {
      if (isValid(call.datetime)) {
        const hour = call.datetime.getHours();
        hourlySuccess[hour].total++;
        if (call.status === 'completed') {
          hourlySuccess[hour].completed++;
        }
      }
    });

    return {
      totalDuration,
      avgDuration,
      longestCall,
      shortestCall,
      voiceCalls,
      videoCalls,
      durationByType,
      callsByInitiator,
      durationDistribution,
      dailyCalls,
      hourlySuccess,
      completionRate: rawCalls.length > 0 ? (analytics.callAnalytics.completedCalls / rawCalls.length) * 100 : 0
    };
  }, [rawCalls, metadata, analytics.callAnalytics]);

  const views = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'duration', name: 'Duration', icon: Clock },
    { id: 'patterns', name: 'Patterns', icon: TrendingUp },
    { id: 'success', name: 'Success Rate', icon: Target },
    { id: 'participants', name: 'Participants', icon: Users }
  ];

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!rawCalls || rawCalls.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Call Data</h3>
          <p className="text-gray-500 dark:text-gray-400">No calls found in this chat.</p>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          icon={Phone}
          label="Total Calls"
          value={analytics.callAnalytics.totalCalls.toString()}
          color="blue"
          description={`${analytics.callAnalytics.completedCalls} completed, ${analytics.callAnalytics.missedCalls} missed`}
        />
        
        <MetricCard 
          icon={Target}
          label="Success Rate"
          value={`${callStats.completionRate.toFixed(1)}%`}
          color="green"
          description={`${analytics.callAnalytics.completedCalls} out of ${analytics.callAnalytics.totalCalls} calls completed successfully`}
        />
        
        <MetricCard 
          icon={Clock}
          label="Avg Duration"
          value={`${callStats.avgDuration.toFixed(1)}m`}
          color="purple"
          description={`Average duration of completed calls. Longest: ${Math.floor(callStats.longestCall / 60)}h ${Math.round(callStats.longestCall % 60)}m`}
        />
        
        <MetricCard 
          icon={Video}
          label="Total Time"
          value={`${Math.round(callStats.totalDuration / 60)}h`}
          color="orange"
          description={`${Math.round(callStats.totalDuration)} minutes of total call time across all completed calls`}
        />
      </div>

      {/* Call Type Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Call Type Distribution</h3>
          <Tooltip content="Breakdown of voice vs video calls">
            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Tooltip content={`${callStats.voiceCalls} voice calls (${((callStats.voiceCalls / analytics.callAnalytics.totalCalls) * 100).toFixed(1)}%)`}>
            <div className="space-y-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-4 rounded-lg transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Voice Calls</span>
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{callStats.voiceCalls}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${(callStats.voiceCalls / analytics.callAnalytics.totalCalls) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(callStats.durationByType.voice)} min total duration
              </p>
            </div>
          </Tooltip>
          
          <Tooltip content={`${callStats.videoCalls} video calls (${((callStats.videoCalls / analytics.callAnalytics.totalCalls) * 100).toFixed(1)}%)`}>
            <div className="space-y-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-4 rounded-lg transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Video Calls</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{callStats.videoCalls}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${(callStats.videoCalls / analytics.callAnalytics.totalCalls) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(callStats.durationByType.video)} min total duration
              </p>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  );

  const renderDurationAnalysis = () => (
    <div className="space-y-6">
      {/* Duration Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Longest Call</h4>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {Math.floor(callStats.longestCall / 60)}h {Math.round(callStats.longestCall % 60)}m
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Average Call</h4>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
            {callStats.avgDuration.toFixed(1)}m
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">Shortest Call</h4>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {callStats.shortestCall.toFixed(1)}m
          </p>
        </div>
      </div>

      {/* Duration Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Duration Distribution</h3>
        <div className="space-y-3">
          {callStats.durationDistribution.map((bucket, index) => (
            <div key={index} className="flex items-center">
              <div className="w-20 text-sm text-gray-600 dark:text-gray-400">{bucket.label}</div>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.max((bucket.count / Math.max(...callStats.durationDistribution.map(b => b.count))) * 100, bucket.count > 0 ? 10 : 0)}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 dark:text-white text-right">{bucket.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Duration by Type */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Total Duration by Type</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium">Voice Calls</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.round(callStats.durationByType.voice)} min
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {Math.round(callStats.durationByType.voice / 60 * 10) / 10}h total
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Video className="h-6 w-6 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm font-medium">Video Calls</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Math.round(callStats.durationByType.video)} min
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {Math.round(callStats.durationByType.video / 60 * 10) / 10}h total
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTimePatterns = () => (
    <div className="space-y-6">
      {/* Hourly Activity Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calls by Hour</h3>
          <Tooltip content="Hourly distribution of call activity throughout the day">
            <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {Object.entries(analytics.callAnalytics.callsByHour).map(([hour, count]) => {
            const maxCalls = Math.max(...Object.values(analytics.callAnalytics.callsByHour));
            const intensity = maxCalls > 0 ? count / maxCalls : 0;
            const timeLabel = `${hour.padStart(2, '0')}:00`;
            
            return (
              <Tooltip key={hour} content={`${timeLabel} - ${count} calls`}>
                <div className="text-center group cursor-pointer">
                  <div 
                    className={clsx(
                      'w-full h-16 rounded-lg mb-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
                      intensity > 0.7 ? 'bg-gradient-to-t from-blue-600 to-blue-500' :
                      intensity > 0.4 ? 'bg-gradient-to-t from-blue-400 to-blue-300' :
                      intensity > 0.1 ? 'bg-gradient-to-t from-blue-200 to-blue-100' :
                      'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{hour}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <span>No calls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-300 rounded"></div>
            <span>Low activity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>High activity</span>
          </div>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Calls by Day of Week</h3>
        <div className="space-y-3">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
            const count = analytics.callAnalytics.callsByDay[index] || 0;
            const maxCalls = Math.max(...Object.values(analytics.callAnalytics.callsByDay));
            return (
              <div key={day} className="flex items-center">
                <div className="w-20 text-sm text-gray-600 dark:text-gray-400">{day}</div>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-blue-600 h-4 rounded-full transition-all duration-300" 
                      style={{ width: `${maxCalls > 0 ? Math.max((count / maxCalls) * 100, count > 0 ? 10 : 0) : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-12 text-sm font-medium text-gray-900 dark:text-white text-right">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderSuccessAnalysis = () => (
    <div className="space-y-6">
      {/* Overall Success Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-green-900 dark:text-green-100">Completed</h4>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
            {analytics.callAnalytics.completedCalls}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-100">Missed</h4>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
            {analytics.callAnalytics.missedCalls}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Success Rate</h4>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {callStats.completionRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Success Rate by Hour */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Success Rate by Hour</h3>
        <div className="space-y-2">
          {Object.entries(callStats.hourlySuccess).map(([hour, data]) => {
            const successRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
            return (
              <div key={hour} className="flex items-center">
                <div className="w-16 text-sm text-gray-600 dark:text-gray-400">{hour}:00</div>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className={clsx(
                        'h-3 rounded-full transition-all duration-300',
                        successRate >= 80 ? 'bg-green-500' :
                        successRate >= 60 ? 'bg-yellow-500' :
                        successRate >= 40 ? 'bg-orange-500' :
                        'bg-red-500'
                      )}
                      style={{ width: `${Math.max(successRate, data.total > 0 ? 5 : 0)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-20 text-sm text-gray-900 dark:text-white text-right">
                  {data.total > 0 ? `${successRate.toFixed(0)}% (${data.completed}/${data.total})` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderParticipantAnalysis = () => (
    <div className="space-y-6">
      {/* Top Call Initiators */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Call Activity by Participant</h3>
        <div className="space-y-4">
          {Object.entries(callStats.callsByInitiator)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 10)
            .map(([initiator, data]) => {
              const successRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
              const avgDuration = data.completed > 0 ? data.duration / data.completed : 0;
              
              return (
                <div key={initiator} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{initiator}</h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{data.total} calls</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
                      <div className="flex items-center mt-1">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className={clsx(
                              'h-2 rounded-full',
                              successRate >= 80 ? 'bg-green-500' :
                              successRate >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            )}
                            style={{ width: `${successRate}%` }}
                          ></div>
                        </div>
                        <span className="font-medium">{successRate.toFixed(0)}%</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Avg Duration</span>
                      <p className="font-medium mt-1">{avgDuration.toFixed(1)}m</p>
                    </div>
                    
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Total Time</span>
                      <p className="font-medium mt-1">{Math.round(data.duration)}m</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex flex-wrap gap-3">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <Tooltip key={view.id} content={`View ${view.name.toLowerCase()} analysis`}>
              <button
                onClick={() => setActiveView(view.id as AnalysisView)}
                className={clsx(
                  'flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 transform hover:scale-105',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md'
                )}
              >
                <Icon className={clsx('w-5 h-5', isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400')} />
                <span className="text-sm font-semibold">{view.name}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Active View Content */}
      <div>
        {activeView === 'overview' && renderOverview()}
        {activeView === 'duration' && renderDurationAnalysis()}
        {activeView === 'patterns' && renderTimePatterns()}
        {activeView === 'success' && renderSuccessAnalysis()}
        {activeView === 'participants' && renderParticipantAnalysis()}
      </div>
    </div>
  );
};