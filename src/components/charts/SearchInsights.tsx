import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics, Message, Theme } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { useUIStore } from '../../stores/uiStore';
import { useFilterStore } from '../../stores/filterStore';
import { useChatStore } from '../../stores/chatStore';
import { getSenderColor } from '../../utils/chartUtils';
import { differenceInDays } from 'date-fns';
import { Search, Users, Clock, MessageSquare, TrendingUp, Target, Zap } from 'lucide-react';

interface SearchInsightsProps {
  analytics: ProcessedAnalytics;
  filteredMessages: Message[];
}

import { InsightCard } from '../common/InsightCard';

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
      const gap = (sortedMessages[i].timestamp - sortedMessages[i - 1].timestamp) / (1000 * 60); // minutes
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
    const mentionFrequency: Record<string, number> = {};
    filteredMessages.forEach(msg => {
      mentionFrequency[msg.sender] = (mentionFrequency[msg.sender] || 0) + 1;
    });

    const topMentioner = Object.entries(mentionFrequency)
      .sort((a, b) => b[1] - a[1])[0];

    // Conversation clustering analysis
    const conversationClusters = [];
    let currentCluster = [sortedMessages[0]];

    for (let i = 1; i < sortedMessages.length; i++) {
      const gap = (sortedMessages[i].timestamp - sortedMessages[i - 1].timestamp) / (1000 * 60 * 60); // hours
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

    const normalizedOriginal: Record<string, number> = {};
    const normalizedFiltered: Record<string, number> = {};

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
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-8 animate-in fade-in duration-500">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Search className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Start Exploring Your Data
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Use the search bar and filters above to discover insights about your conversations.
            Search for keywords, select specific participants, or filter by date ranges to see detailed analytics.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3 border border-white/10">
              <div className="font-bold mb-1 text-gray-900 dark:text-white">💬 Search Content</div>
              <div>Find specific words or phrases</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3 border border-white/10">
              <div className="font-bold mb-1 text-gray-900 dark:text-white">👥 Filter Participants</div>
              <div>Focus on specific people</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3 border border-white/10">
              <div className="font-bold mb-1 text-gray-900 dark:text-white">📅 Date Ranges</div>
              <div>Analyze specific time periods</div>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-3 border border-white/10">
              <div className="font-bold mb-1 text-gray-900 dark:text-white">📊 Message Types</div>
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
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-8 animate-in fade-in duration-500">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Zap className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Results Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your current filters didn't match any messages. Try adjusting your search criteria or expanding your date range.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            Active filters: {filterState.searchKeyword && `"${filterState.searchKeyword}"`}
            {filterState.selectedSenders.length > 0 && `, ${filterState.selectedSenders.length} participants`}
            {filterState.dateRange && `, custom date range`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2">
          <Search className="w-5 h-5 text-primary-600 dark:text-primary-400" />
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
          icon={<Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Messages Found</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {effectiveness.filteredCount.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
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

            <div className="text-xs text-gray-500 dark:text-gray-500 bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 border border-white/10">
              📊 From {effectiveness.originalCount.toLocaleString()} total messages
            </div>
          </div>
        </InsightCard>

        {/* Active Filters Card */}
        <InsightCard
          title="Active Filters"
          icon={<Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
        >
          <div className="space-y-3">
            {filterState.searchKeyword && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">🔍 Search:</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-100 dark:bg-blue-800/50 px-1.5 py-0.5 rounded">
                    {filterState.searchKeyword}
                  </span>
                </div>
              </div>
            )}

            {filterState.selectedSenders.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 border border-purple-200 dark:border-purple-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">👥 Participants:</span>
                  <span className="text-xs text-purple-600 dark:text-purple-400">
                    {filterState.selectedSenders.length} selected
                  </span>
                </div>
                {filterState.selectedSenders.length <= 3 && (
                  <div className="mt-1 text-xs text-purple-500 dark:text-purple-400 pl-4">
                    {filterState.selectedSenders.join(', ')}
                  </div>
                )}
              </div>
            )}

            {filterState.dateRange && (
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2 border border-orange-200 dark:border-orange-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300">📅 Date Range:</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {differenceInDays(filterState.dateRange[1], filterState.dateRange[0]) + 1} days
                  </span>
                </div>
              </div>
            )}

            {filterState.messageTypes.length < 3 && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">📊 Types:</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
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
          icon={<Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
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
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {sender.filteredCount}
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
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
          icon={<TrendingUp className="w-5 h-5 text-pink-600 dark:text-pink-400" />}
        >
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
                {distributionInsights.clustering}%
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Messages clustered</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ⏱️ Avg gap: {distributionInsights.avgGap < 60 ?
                  `${distributionInsights.avgGap} min` :
                  distributionInsights.avgGap < 1440 ?
                    `${Math.round(distributionInsights.avgGap / 60)} hrs` :
                    `${Math.round(distributionInsights.avgGap / 1440)} days`}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/10">
                <span className="text-gray-600 dark:text-gray-400 font-medium">💥 Message Bursts</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {distributionInsights.burstCount}
                </span>
              </div>

              <div className="flex justify-between text-xs p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/10">
                <span className="text-gray-600 dark:text-gray-400 font-medium">🔥 Longest Burst</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {distributionInsights.longestBurst} messages
                </span>
              </div>

              <div className="flex justify-between text-xs p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-white/10">
                <span className="text-gray-600 dark:text-gray-400 font-medium">📊 Threads</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {distributionInsights.conversationClusters}
                </span>
              </div>
            </div>

            {distributionInsights.topMentioner && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800/30">
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium text-center">
                  🗣️ Top mentioner: <span className="font-bold">{distributionInsights.topMentioner.sender}</span> ({distributionInsights.topMentioner.count})
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
          icon={<MessageSquare className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 border border-blue-200 dark:border-blue-800/30">
                <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                  {contentInsights.types.filtered.text}
                </div>
                <div className="text-blue-500 dark:text-blue-500 font-medium">Text</div>
              </div>
              <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800/30">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                  {contentInsights.types.filtered.media}
                </div>
                <div className="text-emerald-500 dark:text-emerald-500 font-medium">Media</div>
              </div>
              <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-800/30">
                <div className="font-bold text-purple-600 dark:text-purple-400 text-lg">
                  {contentInsights.types.filtered.call}
                </div>
                <div className="text-purple-500 dark:text-purple-500 font-medium">Calls</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">📝 Avg Length</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {contentInsights.messageCharacteristics.avgLength} chars
                  {contentInsights.messageCharacteristics.lengthChange !== 0 && (
                    <span className={`ml-1 ${contentInsights.messageCharacteristics.lengthChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                      }`}>
                      ({contentInsights.messageCharacteristics.lengthChange > 0 ? '+' : ''}{contentInsights.messageCharacteristics.lengthChange})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 Complexity</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {contentInsights.messageCharacteristics.complexityScore > 0 ? 'High' :
                    contentInsights.messageCharacteristics.complexityScore < 0 ? 'Low' : 'Medium'}
                  <span className="text-gray-500 dark:text-gray-500 ml-1 font-normal">
                    ({contentInsights.messageDistribution.longRate}% long)
                  </span>
                </span>
              </div>

              {contentInsights.urlAnalysis.count > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🔗 URLs</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {contentInsights.urlAnalysis.rate}%
                    {contentInsights.urlAnalysis.change !== 0 && (
                      <span className={`ml-1 ${contentInsights.urlAnalysis.change > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                        }`}>
                        ({contentInsights.urlAnalysis.change > 0 ? '+' : ''}{contentInsights.urlAnalysis.change}%)
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 font-medium">😊 Emoji Density</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {contentInsights.emojiDensity.filtered} / msg
                  {contentInsights.emojiDensity.change !== 0 && (
                    <span className={`ml-1 ${contentInsights.emojiDensity.change > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
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
          icon={<Target className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
        >
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {effectiveness.retained}%
              </div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Data coverage</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-center border border-rose-200 dark:border-rose-800/30">
                <div className="font-bold text-rose-600 dark:text-rose-400 text-lg">
                  {senderInsights.length}
                </div>
                <div className="text-rose-500 dark:text-rose-500 font-medium">Active users</div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center border border-blue-200 dark:border-blue-800/30">
                <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                  {distributionInsights.conversationClusters}
                </div>
                <div className="text-blue-500 dark:text-blue-500 font-medium">Conversations</div>
              </div>
            </div>

            {senderInsights.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">🎯 Best Match Rate</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {senderInsights[0].matchPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">📈 Pattern Match</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {temporalInsights.patternSimilarity}%
                  </span>
                </div>
              </div>
            )}

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
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
  theme: Theme;
}

const TemporalPatternChart: React.FC<TemporalPatternChartProps> = ({
  data,
  filteredPeak,
  patternSimilarity,
  theme,
}) => {
  const ref = useD3(
    (svg) => {
      const width = 280;
      const height = 120;
      const margin = { top: 10, right: 10, bottom: 20, left: 10 };
      const chartWidth = width - margin.left - margin.right;
      const chartHeight = height - margin.top - margin.bottom;

      svg.selectAll('*').remove();

      const g = svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear()
        .domain([0, 23])
        .range([0, chartWidth]);

      const y = d3.scaleLinear()
        .domain([0, Math.max(
          d3.max(data, d => d.originalPct) || 0,
          d3.max(data, d => d.filteredPct) || 0
        )])
        .range([chartHeight, 0]);

      // Area generators
      const originalArea = d3.area<typeof data[0]>()
        .x(d => x(d.hour))
        .y0(chartHeight)
        .y1(d => y(d.originalPct))
        .curve(d3.curveMonotoneX);

      const filteredArea = d3.area<typeof data[0]>()
        .x(d => x(d.hour))
        .y0(chartHeight)
        .y1(d => y(d.filteredPct))
        .curve(d3.curveMonotoneX);

      // Draw original pattern (background)
      g.append('path')
        .datum(data)
        .attr('fill', theme === 'dark' ? 'rgba(75, 85, 99, 0.2)' : 'rgba(209, 213, 219, 0.3)')
        .attr('d', originalArea);

      // Draw filtered pattern (foreground)
      g.append('path')
        .datum(data)
        .attr('fill', 'url(#filteredGradient)')
        .attr('d', filteredArea);

      // Add gradient
      const defs = svg.append('defs');
      const gradient = defs.append('linearGradient')
        .attr('id', 'filteredGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#8B5CF6') // Violet
        .attr('stop-opacity', 0.6);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#EC4899') // Pink
        .attr('stop-opacity', 0.2);

      // Add X axis
      const xAxis = d3.axisBottom(x)
        .tickValues([0, 6, 12, 18, 23])
        .tickFormat(d => {
          const h = d.valueOf();
          return h === 0 ? '12A' : h === 12 ? '12P' : h > 12 ? `${h - 12}P` : `${h}A`;
        })
        .tickSize(0);

      g.append('g')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(xAxis)
        .select('.domain').remove();

      g.selectAll('.tick text')
        .attr('fill', theme === 'dark' ? '#9CA3AF' : '#6B7280')
        .attr('font-size', '10px')
        .attr('font-family', '"Plus Jakarta Sans", sans-serif');

    },
    [data, theme]
  );

  return (
    <InsightCard
      title="Temporal Patterns"
      icon={<Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />}
      className="md:col-span-2 lg:col-span-1"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Peak Activity</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {filteredPeak.hour === 0 ? '12 AM' :
                filteredPeak.hour < 12 ? `${filteredPeak.hour} AM` :
                  filteredPeak.hour === 12 ? '12 PM' :
                    `${filteredPeak.hour - 12} PM`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pattern Match</div>
            <div className={`font-bold ${patternSimilarity > 80 ? 'text-emerald-600 dark:text-emerald-400' :
              patternSimilarity > 50 ? 'text-blue-600 dark:text-blue-400' :
                'text-orange-600 dark:text-orange-400'
              }`}>
              {patternSimilarity}%
            </div>
          </div>
        </div>

        <div className="h-32 w-full">
          <svg ref={ref} className="w-full h-full" />
        </div>

        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            <span className="text-gray-500 dark:text-gray-400">Typical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-violet-500"></div>
            <span className="text-gray-900 dark:text-white font-medium">Filtered</span>
          </div>
        </div>
      </div>
    </InsightCard>
  );
};
