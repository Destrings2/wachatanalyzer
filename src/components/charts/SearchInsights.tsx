import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics, Message, FilterState } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { useUIStore } from '../../stores/uiStore';
import { useFilterStore } from '../../stores/filterStore';
import { useChatStore } from '../../stores/chatStore';
import { getSenderColor, getChartColors } from '../../utils/chartUtils';
import { format, differenceInDays } from 'date-fns';
import { Search, Users, Clock, MessageSquare, TrendingUp, Target, Zap } from 'lucide-react';

interface SearchInsightsProps {
  analytics: ProcessedAnalytics;
  filteredMessages: Message[];
}

interface InsightCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const InsightCard: React.FC<InsightCardProps> = ({ title, icon, children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      </div>
      {children}
    </div>
  );
};

export const SearchInsights: React.FC<SearchInsightsProps> = ({
  analytics,
  filteredMessages
}) => {
  const { theme } = useUIStore();
  const filterState = useFilterStore();
  const { analytics: originalAnalytics, rawMessages: originalMessages } = useChatStore();

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filterState.searchKeyword.trim() !== '' ||
      filterState.selectedSenders.length > 0 ||
      filterState.dateRange !== null ||
      filterState.messageTypes.length < 3
    );
  }, [filterState]);

  // Calculate filter effectiveness
  const effectiveness = useMemo(() => {
    const originalCount = originalMessages.length;
    const filteredCount = filteredMessages.length;
    const reduction = originalCount > 0 ? ((originalCount - filteredCount) / originalCount) * 100 : 0;

    return {
      originalCount,
      filteredCount,
      reduction: Math.round(reduction * 10) / 10,
      retained: Math.round((100 - reduction) * 10) / 10
    };
  }, [originalMessages.length, filteredMessages.length]);

  // Analyze sender distribution in filtered vs original
  const senderInsights = useMemo(() => {
    const originalSenders = originalAnalytics.messageStats.messagesPerSender;
    const filteredSenders = analytics.messageStats.messagesPerSender;

    const insights = Object.keys(originalSenders).map(sender => {
      const originalCount = originalSenders[sender] || 0;
      const filteredCount = filteredSenders[sender] || 0;
      const percentage = originalCount > 0 ? (filteredCount / originalCount) * 100 : 0;
      const filteredPercentage = filteredMessages.length > 0 ? (filteredCount / filteredMessages.length) * 100 : 0;

      return {
        sender,
        originalCount,
        filteredCount,
        matchPercentage: Math.round(percentage * 10) / 10,
        shareOfFiltered: Math.round(filteredPercentage * 10) / 10
      };
    })
    .filter(s => s.filteredCount > 0)
    .sort((a, b) => b.filteredCount - a.filteredCount);

    return insights;
  }, [analytics.messageStats.messagesPerSender, originalAnalytics.messageStats.messagesPerSender, filteredMessages.length]);

  // Analyze message clustering and distribution patterns
  const distributionInsights = useMemo(() => {
    const sortedMessages = [...filteredMessages].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate clustering (how close together are the matches?)
    const timeGaps = [];
    for (let i = 1; i < sortedMessages.length; i++) {
      const gap = (sortedMessages[i].timestamp - sortedMessages[i-1].timestamp) / (1000 * 60); // minutes
      timeGaps.push(gap);
    }

    const avgGap = timeGaps.length > 0 ? timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length : 0;
    const clustering = timeGaps.filter(gap => gap < 60).length / Math.max(timeGaps.length, 1); // % within 1 hour

    // Analyze message bursts (sequences of matches within short time)
    let burstCount = 0;
    let currentBurstSize = 1;
    let longestBurst = 1;

    timeGaps.forEach(gap => {
      if (gap < 5) { // Within 5 minutes = same burst
        currentBurstSize++;
      } else {
        if (currentBurstSize >= 3) burstCount++; // Count as burst if 3+ messages
        longestBurst = Math.max(longestBurst, currentBurstSize);
        currentBurstSize = 1;
      }
    });

    // Final burst check
    if (currentBurstSize >= 3) burstCount++;
    longestBurst = Math.max(longestBurst, currentBurstSize);

    // Who mentions the search terms most in their messages
    const mentionFrequency = {};
    filteredMessages.forEach(msg => {
      mentionFrequency[msg.sender] = (mentionFrequency[msg.sender] || 0) + 1;
    });

    const topMentioner = Object.entries(mentionFrequency)
      .sort((a, b) => b[1] - a[1])[0];

    // Conversation clustering analysis
    const conversationClusters = [];
    let currentCluster = [sortedMessages[0]];

    for (let i = 1; i < sortedMessages.length; i++) {
      const gap = (sortedMessages[i].timestamp - sortedMessages[i-1].timestamp) / (1000 * 60 * 60); // hours
      if (gap < 2) { // Same conversation if within 2 hours
        currentCluster.push(sortedMessages[i]);
      } else {
        if (currentCluster.length > 0) conversationClusters.push(currentCluster);
        currentCluster = [sortedMessages[i]];
      }
    }
    if (currentCluster.length > 0) conversationClusters.push(currentCluster);

    return {
      clustering: Math.round(clustering * 100),
      avgGap: Math.round(avgGap),
      burstCount,
      longestBurst,
      topMentioner: topMentioner ? { sender: topMentioner[0], count: topMentioner[1] } : null,
      conversationClusters: conversationClusters.length,
      avgClusterSize: conversationClusters.length > 0 ?
        Math.round(conversationClusters.reduce((sum, cluster) => sum + cluster.length, 0) / conversationClusters.length) : 0
    };
  }, [filteredMessages]);

  // Analyze temporal patterns (normalized)
  const temporalInsights = useMemo(() => {
    const originalHourly = Object.values(originalAnalytics.timePatterns.hourlyActivity)
      .reduce((acc, senderData) => {
        Object.entries(senderData).forEach(([hour, count]) => {
          acc[parseInt(hour)] = (acc[parseInt(hour)] || 0) + count;
        });
        return acc;
      }, {} as Record<number, number>);

    const filteredHourly = Object.values(analytics.timePatterns.hourlyActivity)
      .reduce((acc, senderData) => {
        Object.entries(senderData).forEach(([hour, count]) => {
          acc[parseInt(hour)] = (acc[parseInt(hour)] || 0) + count;
        });
        return acc;
      }, {} as Record<number, number>);

    // Normalize to percentages for better comparison
    const originalTotal = Object.values(originalHourly).reduce((sum, count) => sum + count, 0);
    const filteredTotal = Object.values(filteredHourly).reduce((sum, count) => sum + count, 0);

    const normalizedOriginal = {};
    const normalizedFiltered = {};

    Object.entries(originalHourly).forEach(([hour, count]) => {
      normalizedOriginal[hour] = originalTotal > 0 ? (count / originalTotal) * 100 : 0;
    });

    Object.entries(filteredHourly).forEach(([hour, count]) => {
      normalizedFiltered[hour] = filteredTotal > 0 ? (count / filteredTotal) * 100 : 0;
    });

    // Find peak hours
    const originalPeak = Object.entries(normalizedOriginal)
      .reduce((peak, [hour, pct]) => pct > peak.pct ? { hour: parseInt(hour), pct, count: originalHourly[hour] } : peak,
        { hour: 0, pct: 0, count: 0 });

    const filteredPeak = Object.entries(normalizedFiltered)
      .reduce((peak, [hour, pct]) => pct > peak.pct ? { hour: parseInt(hour), pct, count: filteredHourly[hour] } : peak,
        { hour: 0, pct: 0, count: 0 });

    // Calculate pattern similarity (how similar are the distributions?)
    const similarity = Array.from({ length: 24 }, (_, hour) => {
      const origPct = normalizedOriginal[hour] || 0;
      const filtPct = normalizedFiltered[hour] || 0;
      return Math.abs(origPct - filtPct);
    }).reduce((sum, diff) => sum + diff, 0);

    const patternSimilarity = Math.max(0, 100 - similarity);

    return {
      originalPeak,
      filteredPeak,
      patternSimilarity: Math.round(patternSimilarity),
      hourlyData: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        originalPct: normalizedOriginal[hour] || 0,
        filteredPct: normalizedFiltered[hour] || 0,
        originalCount: originalHourly[hour] || 0,
        filteredCount: filteredHourly[hour] || 0,
        intensity: originalHourly[hour] > 0 ? (filteredHourly[hour] || 0) / originalHourly[hour] : 0
      }))
    };
  }, [analytics.timePatterns.hourlyActivity, originalAnalytics.timePatterns.hourlyActivity]);

  // Analyze content characteristics and linguistic patterns
  const contentInsights = useMemo(() => {
    const originalTypes = { text: 0, media: 0, call: 0 };
    const filteredTypes = { text: 0, media: 0, call: 0 };

    originalMessages.forEach(msg => {
      if (msg.type === 'call') originalTypes.call++;
      else if (msg.type === 'media') originalTypes.media++;
      else originalTypes.text++;
    });

    filteredMessages.forEach(msg => {
      if (msg.type === 'call') filteredTypes.call++;
      else if (msg.type === 'media') filteredTypes.media++;
      else filteredTypes.text++;
    });

    // Analyze message characteristics
    const textMessages = filteredMessages.filter(msg => msg.type === 'text');
    const originalTextMessages = originalMessages.filter(msg => msg.type === 'text');

    // Length analysis
    const avgLength = textMessages.length > 0 ?
      textMessages.reduce((sum, msg) => sum + msg.metadata.charCount, 0) / textMessages.length : 0;
    const originalAvgLength = originalTextMessages.length > 0 ?
      originalTextMessages.reduce((sum, msg) => sum + msg.metadata.charCount, 0) / originalTextMessages.length : 0;

    // Word density analysis
    const avgWords = textMessages.length > 0 ?
      textMessages.reduce((sum, msg) => sum + msg.metadata.wordCount, 0) / textMessages.length : 0;
    const originalAvgWords = originalTextMessages.length > 0 ?
      originalTextMessages.reduce((sum, msg) => sum + msg.metadata.wordCount, 0) / originalTextMessages.length : 0;

    // Emoji analysis
    const originalEmojis = originalMessages.reduce((count, msg) => count + (msg.metadata.emojis?.length || 0), 0);
    const filteredEmojis = filteredMessages.reduce((count, msg) => count + (msg.metadata.emojis?.length || 0), 0);
    const originalEmojiDensity = originalMessages.length > 0 ? originalEmojis / originalMessages.length : 0;
    const filteredEmojiDensity = filteredMessages.length > 0 ? filteredEmojis / filteredMessages.length : 0;

    // URL analysis
    const urlMessages = filteredMessages.filter(msg => msg.metadata.hasUrl);
    const originalUrlMessages = originalMessages.filter(msg => msg.metadata.hasUrl);
    const urlRate = filteredMessages.length > 0 ? (urlMessages.length / filteredMessages.length) * 100 : 0;
    const originalUrlRate = originalMessages.length > 0 ? (originalUrlMessages.length / originalMessages.length) * 100 : 0;

    // Message complexity analysis
    const shortMessages = textMessages.filter(msg => msg.metadata.wordCount <= 3).length;
    const longMessages = textMessages.filter(msg => msg.metadata.wordCount >= 20).length;
    const complexityScore = textMessages.length > 0 ?
      (longMessages - shortMessages) / textMessages.length * 100 : 0;

    return {
      types: {
        original: originalTypes,
        filtered: filteredTypes
      },
      messageCharacteristics: {
        avgLength: Math.round(avgLength),
        avgWords: Math.round(avgWords * 10) / 10,
        lengthChange: Math.round((avgLength - originalAvgLength) * 10) / 10,
        wordChange: Math.round((avgWords - originalAvgWords) * 10) / 10,
        complexityScore: Math.round(complexityScore)
      },
      emojiDensity: {
        original: Math.round(originalEmojiDensity * 100) / 100,
        filtered: Math.round(filteredEmojiDensity * 100) / 100,
        change: Math.round((filteredEmojiDensity - originalEmojiDensity) * 100) / 100
      },
      urlAnalysis: {
        rate: Math.round(urlRate * 10) / 10,
        change: Math.round((urlRate - originalUrlRate) * 10) / 10,
        count: urlMessages.length
      },
      messageDistribution: {
        short: shortMessages,
        long: longMessages,
        shortRate: textMessages.length > 0 ? Math.round((shortMessages / textMessages.length) * 100) : 0,
        longRate: textMessages.length > 0 ? Math.round((longMessages / textMessages.length) * 100) : 0
      }
    };
  }, [originalMessages, filteredMessages]);

  // Show empty state when no filters are active
  if (!hasActiveFilters || !originalAnalytics || !originalMessages) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Search className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Start Exploring Your Data
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Use the search bar and filters above to discover insights about your conversations.
            Search for keywords, select specific participants, or filter by date ranges to see detailed analytics.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-500">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium mb-1">💬 Search Content</div>
              <div>Find specific words or phrases</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium mb-1">👥 Filter Participants</div>
              <div>Focus on specific people</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium mb-1">📅 Date Ranges</div>
              <div>Analyze specific time periods</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="font-medium mb-1">📊 Message Types</div>
              <div>Text, media, or calls only</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show no results state when filters are active but no messages match
  if (filteredMessages.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Results Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your current filters didn't match any messages. Try adjusting your search criteria or expanding your date range.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500">
            Active filters: {filterState.searchKeyword && `"${filterState.searchKeyword}"`}
            {filterState.selectedSenders.length > 0 && `, ${filterState.selectedSenders.length} participants`}
            {filterState.dateRange && `, custom date range`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
          <Search className="w-5 h-5" />
          Search Insights
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Deep dive into your filtered results
        </p>
      </div>

      {/* Grid of insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Filter Effectiveness Card */}
        <InsightCard
          title="Filter Effectiveness"
          icon={<Target className="w-5 h-5 text-blue-500" />}
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Messages Found</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {effectiveness.filteredCount.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000 shadow-sm"
                  style={{ width: `${effectiveness.retained}%` }}
                  title={`${effectiveness.retained}% of messages match your filters`}
                />
              </div>

              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                  {effectiveness.reduction}% filtered out
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  {effectiveness.retained}% retained
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
              📊 From {effectiveness.originalCount.toLocaleString()} total messages
            </div>
          </div>
        </InsightCard>

        {/* Active Filters Card */}
        <InsightCard
          title="Active Filters"
          icon={<Search className="w-5 h-5 text-green-500" />}
        >
          <div className="space-y-3">
            {filterState.searchKeyword && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">🔍 Search:</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">
                    {filterState.searchKeyword}
                  </span>
                </div>
              </div>
            )}

            {filterState.selectedSenders.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-300">👥 Participants:</span>
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    {filterState.selectedSenders.length} selected
                  </span>
                </div>
                {filterState.selectedSenders.length <= 3 && (
                  <div className="mt-1 text-xs text-purple-500 dark:text-purple-400">
                    {filterState.selectedSenders.join(', ')}
                  </div>
                )}
              </div>
            )}

            {filterState.dateRange && (
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2 border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-300">📅 Date Range:</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {differenceInDays(filterState.dateRange[1], filterState.dateRange[0]) + 1} days
                  </span>
                </div>
              </div>
            )}

            {filterState.messageTypes.length < 3 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">📊 Types:</span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {filterState.messageTypes.join(', ')}
                  </span>
                </div>
              </div>
            )}

            {!filterState.searchKeyword && filterState.selectedSenders.length === 0 &&
             !filterState.dateRange && filterState.messageTypes.length === 3 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <div className="text-2xl mb-2">🎯</div>
                <div className="text-xs">No filters active</div>
              </div>
            )}
          </div>
        </InsightCard>

        {/* Top Contributors Card */}
        <InsightCard
          title="Top Contributors"
          icon={<Users className="w-5 h-5 text-purple-500" />}
        >
          <div className="space-y-3">
            {senderInsights.slice(0, 4).map((sender, index) => (
              <div key={sender.sender} className="group">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-4">#{index + 1}</span>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-800"
                        style={{ backgroundColor: getSenderColor(index, theme) }}
                        title={sender.sender}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {sender.sender.length > 12 ? sender.sender.substring(0, 12) + '...' : sender.sender}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {sender.filteredCount}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {sender.shareOfFiltered.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-1000 shadow-sm"
                          style={{
                            backgroundColor: getSenderColor(index, theme),
                            width: `${sender.shareOfFiltered}%`
                          }}
                          title={`${sender.matchPercentage}% of their messages match filters`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {senderInsights.length > 4 && (
              <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  +{senderInsights.length - 4} more participants
                </span>
              </div>
            )}
          </div>
        </InsightCard>

        {/* Message Distribution Card */}
        <InsightCard
          title="Message Distribution"
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {distributionInsights.clustering}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Messages clustered together</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ⏱️ Avg gap: {distributionInsights.avgGap < 60 ?
                  `${distributionInsights.avgGap} min` :
                  distributionInsights.avgGap < 1440 ?
                  `${Math.round(distributionInsights.avgGap / 60)} hrs` :
                  `${Math.round(distributionInsights.avgGap / 1440)} days`}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">💥 Message Bursts</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {distributionInsights.burstCount}
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">🔥 Longest Burst</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {distributionInsights.longestBurst} messages
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">📊 Conversation Threads</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {distributionInsights.conversationClusters}
                </span>
              </div>
            </div>

            {distributionInsights.topMentioner && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800">
                <div className="text-xs text-emerald-700 dark:text-emerald-300">
                  🗣️ Top mentioner: {distributionInsights.topMentioner.sender} ({distributionInsights.topMentioner.count} times)
                </div>
              </div>
            )}
          </div>
        </InsightCard>

        {/* Temporal Pattern Card - spans 2 columns */}
        <TemporalPatternChart
          data={temporalInsights.hourlyData}
          originalPeak={temporalInsights.originalPeak}
          filteredPeak={temporalInsights.filteredPeak}
          patternSimilarity={temporalInsights.patternSimilarity}
          theme={theme}
        />

        {/* Content Analysis Card */}
        <InsightCard
          title="Content Characteristics"
          icon={<MessageSquare className="w-5 h-5 text-orange-500" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                <div className="font-bold text-blue-600 dark:text-blue-400">
                  {contentInsights.types.filtered.text}
                </div>
                <div className="text-blue-500 dark:text-blue-500">Text</div>
              </div>
              <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
                <div className="font-bold text-green-600 dark:text-green-400">
                  {contentInsights.types.filtered.media}
                </div>
                <div className="text-green-500 dark:text-green-500">Media</div>
              </div>
              <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
                <div className="font-bold text-purple-600 dark:text-purple-400">
                  {contentInsights.types.filtered.call}
                </div>
                <div className="text-purple-500 dark:text-purple-500">Calls</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">📝 Avg Length</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {contentInsights.messageCharacteristics.avgLength} chars
                  {contentInsights.messageCharacteristics.lengthChange !== 0 && (
                    <span className={`ml-1 ${
                      contentInsights.messageCharacteristics.lengthChange > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      ({contentInsights.messageCharacteristics.lengthChange > 0 ? '+' : ''}{contentInsights.messageCharacteristics.lengthChange})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">🎯 Complexity</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {contentInsights.messageCharacteristics.complexityScore > 0 ? 'High' :
                   contentInsights.messageCharacteristics.complexityScore < 0 ? 'Low' : 'Medium'}
                  <span className="text-gray-500 dark:text-gray-500 ml-1">
                    ({contentInsights.messageDistribution.longRate}% long)
                  </span>
                </span>
              </div>

              {contentInsights.urlAnalysis.count > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">🔗 URLs</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {contentInsights.urlAnalysis.rate}% of messages
                    {contentInsights.urlAnalysis.change !== 0 && (
                      <span className={`ml-1 ${
                        contentInsights.urlAnalysis.change > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        ({contentInsights.urlAnalysis.change > 0 ? '+' : ''}{contentInsights.urlAnalysis.change}%)
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">😊 Emoji Density</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {contentInsights.emojiDensity.filtered} per message
                  {contentInsights.emojiDensity.change !== 0 && (
                    <span className={`ml-1 ${
                      contentInsights.emojiDensity.change > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      ({contentInsights.emojiDensity.change > 0 ? '+' : ''}{contentInsights.emojiDensity.change})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </InsightCard>

        {/* Discovery Insights Card */}
        <InsightCard
          title="Discovery Insights"
          icon={<Target className="w-5 h-5 text-rose-500" />}
        >
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {effectiveness.retained}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Data coverage</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center border border-rose-200 dark:border-rose-800">
                <div className="font-bold text-rose-600 dark:text-rose-400">
                  {senderInsights.length}
                </div>
                <div className="text-rose-500 dark:text-rose-500">Active users</div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center border border-blue-200 dark:border-blue-800">
                <div className="font-bold text-blue-600 dark:text-blue-400">
                  {distributionInsights.conversationClusters}
                </div>
                <div className="text-blue-500 dark:text-blue-500">Conversations</div>
              </div>
            </div>

            {senderInsights.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">🎯 Best Match Rate</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {senderInsights[0].matchPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">📈 Pattern Match</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {temporalInsights.patternSimilarity}%
                  </span>
                </div>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {effectiveness.reduction < 50 ? '🎯 Broad search' :
                 effectiveness.reduction < 80 ? '🔍 Focused search' :
                 '🎱 Highly specific search'}
              </div>
            </div>
          </div>
        </InsightCard>
      </div>
    </div>
  );
};

// Temporal Pattern Mini Chart Component
interface TemporalPatternChartProps {
  data: Array<{
    hour: number;
    originalPct: number;
    filteredPct: number;
    originalCount: number;
    filteredCount: number;
    intensity: number
  }>;
  originalPeak: { hour: number; pct: number; count: number };
  filteredPeak: { hour: number; pct: number; count: number };
  patternSimilarity: number;
  theme: string;
}

const TemporalPatternChart: React.FC<TemporalPatternChartProps> = ({
  data,
  originalPeak,
  filteredPeak,
  patternSimilarity,
  theme
}) => {
  const ref = useD3(
    (svg) => {
      const colors = getChartColors(theme);
      const width = 280;
      const height = 120;
      const margin = { top: 10, right: 10, bottom: 20, left: 10 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      svg.selectAll('*').remove();

      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('class', 'w-full h-auto');

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

      // Scales
      const xScale = d3.scaleLinear()
        .domain([0, 23])
        .range([0, chartWidth]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => Math.max(d.originalPct, d.filteredPct)) || 10])
        .range([chartHeight, 0]);

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'temporal-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.grid}`)
        .style('border-radius', '6px')
        .style('padding', '6px 8px')
        .style('font-size', '11px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('z-index', '1000');

      const barWidth = chartWidth / 24 * 0.8;

      // Create grouped bars for comparison
      data.forEach((d, i) => {
        const x = xScale(d.hour);
        const halfBarWidth = barWidth / 2;

        // Original data bar (background)
        g.append('rect')
          .attr('class', 'original-bar')
          .attr('x', x - halfBarWidth)
          .attr('y', yScale(d.originalPct))
          .attr('width', barWidth)
          .attr('height', chartHeight - yScale(d.originalPct))
          .attr('fill', colors.grid)
          .attr('opacity', 0.4);

        // Filtered data bar (foreground)
        g.append('rect')
          .attr('class', 'filtered-bar')
          .attr('x', x - halfBarWidth * 0.6)
          .attr('y', yScale(d.filteredPct))
          .attr('width', barWidth * 0.6)
          .attr('height', chartHeight - yScale(d.filteredPct))
          .attr('fill', d.filteredPct > 0 ? colors.high : colors.grid)
          .attr('opacity', 0.9)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this).attr('opacity', 1);
            tooltip.transition().duration(150).style('opacity', 1);
            const formatHour = (hour: number) => {
              if (hour === 0) return '12 AM';
              if (hour < 12) return `${hour} AM`;
              if (hour === 12) return '12 PM';
              return `${hour - 12} PM`;
            };
            tooltip.html(`
              <div style="font-weight: bold;">${formatHour(d.hour)}</div>
              <div style="color: ${colors.high};">Filtered: ${d.filteredPct.toFixed(1)}% (${d.filteredCount} msgs)</div>
              <div style="color: ${colors.grid};">Overall: ${d.originalPct.toFixed(1)}% (${d.originalCount} msgs)</div>
              <div>Match rate: ${Math.round(d.intensity * 100)}%</div>
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('opacity', 0.9);
            tooltip.transition().duration(300).style('opacity', 0);
          });
      });

      // Add peak indicators
      if (filteredPeak.pct > 0) {
        g.append('polygon')
          .attr('points', () => {
            const x = xScale(filteredPeak.hour);
            const y = yScale(filteredPeak.pct) - 3;
            return `${x-3},${y} ${x+3},${y} ${x},${y-4}`;
          })
          .attr('fill', colors.high)
          .attr('stroke', colors.background)
          .attr('stroke-width', 1);
      }

      // Simple x-axis with key hours
      const keyHours = [0, 6, 12, 18];
      g.selectAll('.hour-label')
        .data(keyHours)
        .enter()
        .append('text')
        .attr('class', 'hour-label')
        .attr('x', d => xScale(d))
        .attr('y', chartHeight + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', colors.axis)
        .text(d => d === 0 ? '12AM' : d === 12 ? '12PM' : `${d > 12 ? d - 12 : d}${d >= 12 ? 'PM' : 'AM'}`);

      return () => {
        d3.selectAll('.temporal-tooltip').remove();
      };
    },
    [data, theme]
  );

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  return (
    <InsightCard
      title="Activity Patterns"
      icon={<Clock className="w-5 h-5 text-indigo-500" />}
      className="md:col-span-2"
    >
      <div className="space-y-3">
        <svg ref={ref} className="w-full" />

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Filtered Peak:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                {formatHour(filteredPeak.hour)}
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-500">
                ({filteredPeak.pct.toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Original Peak:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                {formatHour(originalPeak.hour)}
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-500">
                ({originalPeak.pct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-2 border border-indigo-200 dark:border-indigo-800">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">📊 Pattern Similarity:</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {patternSimilarity}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400 opacity-40"></div>
              <span className="text-gray-500 dark:text-gray-500">Overall activity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getChartColors(theme).high }}></div>
              <span className="text-gray-500 dark:text-gray-500">Filtered results</span>
            </div>
          </div>
        </div>
      </div>
    </InsightCard>
  );
};
