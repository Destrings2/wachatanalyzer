import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics, Message, Theme } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { useUIStore } from '../../stores/uiStore';
import { getSenderColor, getChartColors } from '../../utils/chartUtils';
import { differenceInMinutes, differenceInHours, isSameDay } from 'date-fns';
import {
  Clock,
  MessageCircle,
  Users,
  TrendingUp,
  Zap,
  Target,
  Network,
  Timer,
  Check,
  Info,
  ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import { GlassContainer } from '../common/GlassContainer';
import { ChartControls } from '../common/ChartControls';
import { Tooltip } from '../common/Tooltip';
import { InsightCard } from '../common/InsightCard';

interface ResponsePatternsProps {
  analytics: ProcessedAnalytics;
  messages?: Message[];
  isLoading?: boolean;
}

interface ResponseData {
  responseTimeMinutes: number;
  responder: string;
  originalSender: string;
  timestamp: Date;
  conversationGap: boolean;
  messageLength: number;
  responseLength: number;
}

interface ConversationStarter {
  sender: string;
  starts: number;
  totalMessages: number;
}

interface ResponsePairStats {
  from: string;
  to: string;
  count: number;
  avgResponseTime: number;
  totalTime: number;
}

interface ResponseStats {
  responseData: ResponseData[];
  conversationStarters: ConversationStarter[];
  responsePairs: ResponsePairStats[];
  doubleMessages: Record<string, number>;
  avgResponseTimes: Record<string, number>;
  responseRates: Record<string, number>;
  fastestResponders: Array<{ sender: string; avgTime: number }>;
  conversationEnders: Record<string, number>;
  totalResponses: number;
  avgResponseTime: number;
}

// Animated metric card
const MetricCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  description?: string;
  trend?: string;
}> = ({ icon: Icon, label, value, color, description, trend }) => (
  <Tooltip content={description || label}>
    <div className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
        </div>
        {trend && (
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded-lg">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      </div>
    </div>
  </Tooltip>
);

export const ResponsePatterns: React.FC<ResponsePatternsProps> = ({
  messages = []
}) => {
  const { theme } = useTheme();
  const { chartSettings, updateChartSettings } = useUIStore();
  const [viewMode, setViewMode] = useState<'overview' | 'timeline' | 'pairs'>('overview');

  // Process response data
  const responseStats = useMemo((): ResponseStats => {
    if (!messages || messages.length < 2) {
      return {
        responseData: [],
        conversationStarters: [],
        responsePairs: [],
        doubleMessages: {},
        avgResponseTimes: {},
        responseRates: {},
        fastestResponders: [],
        conversationEnders: {},
        totalResponses: 0,
        avgResponseTime: 0
      };
    }

    const textMessages = messages
      .filter(m => m.type === 'text' && m.content && m.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (textMessages.length < 2) {
      return {
        responseData: [],
        conversationStarters: [],
        responsePairs: [],
        doubleMessages: {},
        avgResponseTimes: {},
        responseRates: {},
        fastestResponders: [],
        conversationEnders: {},
        totalResponses: 0,
        avgResponseTime: 0
      };
    }

    const responseData: ResponseData[] = [];
    const senderStats: Record<string, { responses: number; totalResponseTime: number; messages: number; starts: number; doubles: number; ends: number }> = {};
    const pairStats: Record<string, ResponsePairStats> = {};

    // Initialize sender stats
    const allSenders = Array.from(new Set(textMessages.map(m => m.sender)));
    allSenders.forEach(sender => {
      senderStats[sender] = { responses: 0, totalResponseTime: 0, messages: 0, starts: 0, doubles: 0, ends: 0 };
    });

    // Analyze message sequences
    for (let i = 1; i < textMessages.length; i++) {
      const currentMsg = textMessages[i];
      const prevMsg = textMessages[i - 1];
      const currentTime = new Date(currentMsg.timestamp);
      const prevTime = new Date(prevMsg.timestamp);

      // Count total messages per sender
      senderStats[currentMsg.sender].messages++;

      // Different sender = potential response
      if (currentMsg.sender !== prevMsg.sender) {
        const responseTimeMinutes = differenceInMinutes(currentTime, prevTime);

        // Consider responses within 24 hours (1440 minutes)
        if (responseTimeMinutes <= 1440) {
          const conversationGap = responseTimeMinutes > 60; // More than 1 hour is considered a gap

          responseData.push({
            responseTimeMinutes,
            responder: currentMsg.sender,
            originalSender: prevMsg.sender,
            timestamp: currentTime,
            conversationGap,
            messageLength: prevMsg.content?.length || 0,
            responseLength: currentMsg.content?.length || 0
          });

          // Update sender response stats
          senderStats[currentMsg.sender].responses++;
          senderStats[currentMsg.sender].totalResponseTime += responseTimeMinutes;

          // Update pair stats
          const pairKey = `${prevMsg.sender}->${currentMsg.sender}`;
          if (!pairStats[pairKey]) {
            pairStats[pairKey] = {
              from: prevMsg.sender,
              to: currentMsg.sender,
              count: 0,
              avgResponseTime: 0,
              totalTime: 0
            };
          }
          pairStats[pairKey].count++;
          pairStats[pairKey].totalTime += responseTimeMinutes;
          pairStats[pairKey].avgResponseTime = pairStats[pairKey].totalTime / pairStats[pairKey].count;
        }
      } else {
        // Same sender = double/multiple messages
        senderStats[currentMsg.sender].doubles++;
      }

      // Check for conversation starters (first message of the day or after long gaps)
      if (i === 0 || !isSameDay(currentTime, prevTime) || differenceInHours(currentTime, prevTime) > 4) {
        senderStats[currentMsg.sender].starts++;
      }

      // Check for conversation enders (last message before long gaps or end of day)
      const nextMsg = textMessages[i + 1];
      if (!nextMsg || !isSameDay(currentTime, new Date(nextMsg.timestamp)) || differenceInHours(new Date(nextMsg.timestamp), currentTime) > 4) {
        senderStats[currentMsg.sender].ends++;
      }
    }

    // Calculate derived stats
    const conversationStarters: ConversationStarter[] = allSenders.map(sender => ({
      sender,
      starts: senderStats[sender].starts,
      totalMessages: senderStats[sender].messages
    })).sort((a, b) => b.starts - a.starts);

    const responsePairs: ResponsePairStats[] = Object.values(pairStats)
      .sort((a, b) => b.count - a.count);

    const doubleMessages: Record<string, number> = {};
    const avgResponseTimes: Record<string, number> = {};
    const responseRates: Record<string, number> = {};
    const conversationEnders: Record<string, number> = {};

    allSenders.forEach(sender => {
      doubleMessages[sender] = senderStats[sender].doubles;
      avgResponseTimes[sender] = senderStats[sender].responses > 0
        ? senderStats[sender].totalResponseTime / senderStats[sender].responses
        : 0;
      responseRates[sender] = senderStats[sender].messages > 0
        ? (senderStats[sender].responses / senderStats[sender].messages) * 100
        : 0;
      conversationEnders[sender] = senderStats[sender].ends;
    });

    const fastestResponders = allSenders
      .map(sender => ({ sender, avgTime: avgResponseTimes[sender] }))
      .filter(item => item.avgTime > 0)
      .sort((a, b) => a.avgTime - b.avgTime);

    const totalResponses = responseData.length;
    const avgResponseTime = responseData.length > 0
      ? responseData.reduce((sum, r) => sum + r.responseTimeMinutes, 0) / responseData.length
      : 0;

    return {
      responseData,
      conversationStarters,
      responsePairs,
      doubleMessages,
      avgResponseTimes,
      responseRates,
      fastestResponders,
      conversationEnders,
      totalResponses,
      avgResponseTime
    };
  }, [messages]);

  // Format time duration for display
  const formatResponseTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
    return `${Math.round(minutes / 1440)} day`;
  };

  // Get top stats for overview
  const topStats = useMemo(() => {
    const { fastestResponders, conversationStarters, responsePairs, doubleMessages } = responseStats;

    return {
      fastestResponder: fastestResponders[0],
      topStarter: conversationStarters[0],
      topPair: responsePairs[0],
      mostDoubles: Object.entries(doubleMessages).sort(([, a], [, b]) => b - a)[0]
    };
  }, [responseStats]);

  // Response Time Histogram Component
  const ResponseTimeHistogram: React.FC<{
    responseData: ResponseData[];
    separateBySender: boolean;
    theme: Theme;
  }> = ({ responseData, separateBySender, theme }) => {
    const ref = useD3((svg) => {
      // Get responsive dimensions
      const containerElement = svg.node()?.parentElement;
      const availableWidth = containerElement?.clientWidth || 800;
      const isMobile = availableWidth < 768;

      const margin = {
        top: 20,
        right: separateBySender ? (isMobile ? 20 : 150) : (isMobile ? 10 : 30),
        bottom: isMobile ? 80 : 60,
        left: isMobile ? 40 : 100
      };
      const containerWidth = Math.min(availableWidth - 20, isMobile ? 380 : 800);
      const width = containerWidth - margin.left - margin.right;
      const height = isMobile ? 250 : 300;

      svg.selectAll('*').remove();
      const colors = getChartColors(theme);
      const isDark = theme === 'dark';

      const g = svg
        .attr('width', containerWidth)
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
        .attr('class', 'w-full h-auto')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Create time bins (logarithmic scale for better distribution)
      const bins = [0, 1, 5, 15, 60, 240, 1440]; // minutes: <1min, 1-5min, 5-15min, 15min-1hr, 1-4hr, 4hr+
      const binLabels = ['< 1min', '1-5min', '5-15min', '15min-1hr', '1-4hr', '4hr+'];

      const binData = bins.slice(0, -1).map((minTime, i) => {
        const maxTime = bins[i + 1];
        const responsesInBin = responseData.filter(r => r.responseTimeMinutes >= minTime && r.responseTimeMinutes < maxTime);

        if (separateBySender) {
          const senderCounts: Record<string, number> = {};
          responsesInBin.forEach(r => {
            senderCounts[r.responder] = (senderCounts[r.responder] || 0) + 1;
          });
          return {
            bin: binLabels[i],
            total: responsesInBin.length,
            senderCounts
          };
        } else {
          return {
            bin: binLabels[i],
            total: responsesInBin.length,
            senderCounts: {}
          };
        }
      });

      const allSenders = Array.from(new Set(responseData.map(r => r.responder))).sort();
      const maxCount = Math.max(...binData.map(d => d.total));

      // Scales
      const x = d3.scaleBand()
        .range([0, width])
        .domain(binLabels)
        .padding(0.2);

      const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, maxCount]);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', isDark ? '#9CA3AF' : '#6B7280')
        .style('font-family', '"Plus Jakarta Sans", sans-serif')
        .style('font-size', isMobile ? '10px' : '12px')
        .style('text-anchor', isMobile ? 'end' : 'middle')
        .attr('dx', isMobile ? '-.8em' : '0')
        .attr('dy', isMobile ? '.15em' : '.71em')
        .attr('transform', isMobile ? 'rotate(-45)' : 'rotate(0)');

      g.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', isDark ? '#9CA3AF' : '#6B7280')
        .style('font-family', '"Plus Jakarta Sans", sans-serif')
        .style('font-size', isMobile ? '10px' : '12px');

      // Style axis lines
      g.selectAll('.domain, .tick line')
        .attr('stroke', isDark ? '#374151' : '#E5E7EB');

      // Y axis label (hide on mobile to save space)
      if (!isMobile) {
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -80)
          .attr('x', -height / 2)
          .attr('text-anchor', 'middle')
          .style('fill', isDark ? '#9CA3AF' : '#6B7280')
          .style('font-family', '"Plus Jakarta Sans", sans-serif')
          .style('font-size', '13px')
          .style('font-weight', '500')
          .text('Number of Responses');
      }

      // Create tooltip
      const tooltipId = `hist-tooltip-${Math.random().toString(36).substr(2, 9)}`;
      const tooltip = d3.select('body').append('div')
        .attr('id', tooltipId)
        .attr('class', 'response-histogram-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)')
        .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`)
        .style('border-radius', '12px')
        .style('backdrop-filter', 'blur(12px)')
        .style('box-shadow', '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)')
        .style('padding', '12px')
        .style('font-size', '13px')
        .style('color', isDark ? '#F3F4F6' : '#1F2937')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('font-family', '"Plus Jakarta Sans", sans-serif');

      if (separateBySender && allSenders.length > 0) {
        // Stacked bars by sender
        binData.forEach(binItem => {
          let currentY = height;

          allSenders.forEach((sender, senderIndex) => {
            const senderCount = binItem.senderCounts[sender] || 0;
            if (senderCount === 0) return;

            const senderColor = getSenderColor(senderIndex, theme);
            const barHeight = height - y(senderCount);

            g.append('rect')
              .attr('x', x(binItem.bin) || 0)
              .attr('width', x.bandwidth())
              .attr('y', currentY)
              .attr('height', 0)
              .attr('fill', senderColor)
              .attr('rx', 2)
              .style('cursor', 'pointer')
              .on('mouseover', function (event) {
                d3.select(this).attr('opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
                  <div style="font-weight: 700; margin-bottom: 4px;">${binItem.bin}</div>
                  <div style="color: ${senderColor}; font-weight: 600;">${sender}: ${senderCount} responses</div>
                  <div style="margin-top: 4px; font-size: 12px; opacity: 0.8;">Total: ${binItem.total} responses</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 10) + 'px');
              })
              .on('mouseout', function () {
                d3.select(this).attr('opacity', 1);
                tooltip.transition().duration(300).style('opacity', 0);
              })
              .transition()
              .duration(800)
              .delay(senderIndex * 50)
              .attr('y', currentY - barHeight)
              .attr('height', barHeight);

            currentY -= barHeight;
          });
        });

        // Add legend (hide on mobile to save space)
        if (!isMobile) {
          const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 20}, 20)`);

          allSenders.forEach((sender, index) => {
            const senderColor = getSenderColor(index, theme);
            const legendItem = legend.append('g')
              .attr('transform', `translate(0, ${index * 24})`);

            legendItem.append('rect')
              .attr('x', 0)
              .attr('y', -6)
              .attr('width', 12)
              .attr('height', 12)
              .attr('rx', 3)
              .attr('fill', senderColor);

            legendItem.append('text')
              .attr('x', 18)
              .attr('y', 0)
              .attr('dy', '0.35em')
              .style('font-size', '12px')
              .style('font-family', '"Plus Jakarta Sans", sans-serif')
              .style('fill', isDark ? '#9CA3AF' : '#4B5563')
              .text(sender.length > 15 ? sender.substring(0, 15) + '...' : sender);
          });
        }
      } else {
        // Simple bars with gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
          .attr('id', 'responseBarGradient')
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', '#8B5CF6'); // Violet

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#EC4899'); // Pink

        g.selectAll('.bar')
          .data(binData)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d.bin) || 0)
          .attr('width', x.bandwidth())
          .attr('y', height)
          .attr('height', 0)
          .attr('fill', 'url(#responseBarGradient)')
          .attr('rx', 4)
          .style('cursor', 'pointer')
          .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
              <div style="font-weight: 700; margin-bottom: 4px;">${d.bin}</div>
              <div style="font-weight: 600; color: #8B5CF6;">${d.total} responses</div>
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 1);
            tooltip.transition().duration(300).style('opacity', 0);
          })
          .transition()
          .duration(800)
          .attr('y', d => y(d.total))
          .attr('height', d => height - y(d.total));
      }

      // Cleanup function
      return () => {
        d3.select(`#${tooltipId}`).remove();
      };
    }, [responseData, separateBySender, theme]);

    return <svg ref={ref} className="w-full h-auto" />;
  };

  // Hourly Response Chart Component
  const HourlyResponseChart: React.FC<{
    responseData: ResponseData[];
    separateBySender: boolean;
    theme: Theme;
  }> = ({ responseData, separateBySender, theme }) => {
    const ref = useD3((svg) => {
      // Get responsive dimensions
      const containerElement = svg.node()?.parentElement;
      const availableWidth = containerElement?.clientWidth || 800;
      const isMobile = availableWidth < 768;

      const margin = {
        top: 20,
        right: separateBySender ? (isMobile ? 20 : 150) : (isMobile ? 10 : 30),
        bottom: isMobile ? 80 : 60,
        left: isMobile ? 40 : 60
      };
      const containerWidth = Math.min(availableWidth - 20, isMobile ? 380 : 800);
      const width = containerWidth - margin.left - margin.right;
      const height = isMobile ? 250 : 300;

      svg.selectAll('*').remove();
      const colors = getChartColors(theme);
      const isDark = theme === 'dark';

      const g = svg
        .attr('width', containerWidth)
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${containerWidth} ${height + margin.top + margin.bottom}`)
        .attr('class', 'w-full h-auto')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Group responses by hour
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const responsesInHour = responseData.filter(r => r.timestamp.getHours() === hour);

        if (separateBySender) {
          const senderCounts: Record<string, number> = {};
          responsesInHour.forEach(r => {
            senderCounts[r.responder] = (senderCounts[r.responder] || 0) + 1;
          });
          return {
            hour,
            total: responsesInHour.length,
            senderCounts,
            avgResponseTime: responsesInHour.length > 0
              ? responsesInHour.reduce((sum, r) => sum + r.responseTimeMinutes, 0) / responsesInHour.length
              : 0
          };
        } else {
          return {
            hour,
            total: responsesInHour.length,
            senderCounts: {},
            avgResponseTime: responsesInHour.length > 0
              ? responsesInHour.reduce((sum, r) => sum + r.responseTimeMinutes, 0) / responsesInHour.length
              : 0
          };
        }
      });

      const allSenders = Array.from(new Set(responseData.map(r => r.responder))).sort();
      const maxCount = Math.max(...hourlyData.map(d => d.total));

      // Scales
      const x = d3.scaleBand()
        .range([0, width])
        .domain(hourlyData.map(d => d.hour.toString()))
        .padding(0.2);

      const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, maxCount]);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
          .tickFormat(d => {
            const hour = parseInt(d);
            if (isMobile) {
              return hour % 4 === 0 ? (
                hour === 0 ? '12A' :
                  hour < 12 ? `${hour}A` :
                    hour === 12 ? '12P' :
                      `${hour - 12}P`
              ) : '';
            } else {
              return hour === 0 ? '12 AM' :
                hour < 12 ? `${hour} AM` :
                  hour === 12 ? '12 PM' :
                    `${hour - 12} PM`;
            }
          })
        )
        .selectAll('text')
        .style('fill', isDark ? '#9CA3AF' : '#6B7280')
        .style('font-family', '"Plus Jakarta Sans", sans-serif')
        .style('font-size', isMobile ? '9px' : '11px')
        .style('text-anchor', isMobile ? 'end' : 'middle')
        .attr('dx', isMobile ? '-.5em' : '0')
        .attr('dy', isMobile ? '.15em' : '.71em')
        .attr('transform', isMobile ? 'rotate(-45)' : 'rotate(0)');

      g.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', isDark ? '#9CA3AF' : '#6B7280')
        .style('font-family', '"Plus Jakarta Sans", sans-serif')
        .style('font-size', isMobile ? '10px' : '12px');

      // Style axis lines
      g.selectAll('.domain, .tick line')
        .attr('stroke', isDark ? '#374151' : '#E5E7EB');

      // Y axis label (hide on mobile to save space)
      if (!isMobile) {
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -40)
          .attr('x', -height / 2)
          .attr('text-anchor', 'middle')
          .style('fill', isDark ? '#9CA3AF' : '#6B7280')
          .style('font-family', '"Plus Jakarta Sans", sans-serif')
          .style('font-size', '13px')
          .style('font-weight', '500')
          .text('Number of Responses');
      }

      // Create tooltip
      const tooltipId = `hourly-tooltip-${Math.random().toString(36).substr(2, 9)}`;
      const tooltip = d3.select('body').append('div')
        .attr('id', tooltipId)
        .attr('class', 'hourly-response-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)')
        .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`)
        .style('border-radius', '12px')
        .style('backdrop-filter', 'blur(12px)')
        .style('box-shadow', '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)')
        .style('padding', '12px')
        .style('font-size', '13px')
        .style('color', isDark ? '#F3F4F6' : '#1F2937')
        .style('pointer-events', 'none')
        .style('z-index', '1000')
        .style('font-family', '"Plus Jakarta Sans", sans-serif');

      if (separateBySender && allSenders.length > 0) {
        // Stacked bars by sender
        hourlyData.forEach(hourItem => {
          let currentY = height;

          allSenders.forEach((sender, senderIndex) => {
            const senderCount = hourItem.senderCounts[sender] || 0;
            if (senderCount === 0) return;

            const senderColor = getSenderColor(senderIndex, theme);
            const barHeight = height - y(senderCount);

            g.append('rect')
              .attr('x', x(hourItem.hour.toString()) || 0)
              .attr('width', x.bandwidth())
              .attr('y', currentY)
              .attr('height', 0)
              .attr('fill', senderColor)
              .attr('rx', 2)
              .style('cursor', 'pointer')
              .on('mouseover', function (event) {
                d3.select(this).attr('opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', 1);
                const hourLabel = hourItem.hour === 0 ? '12 AM' :
                  hourItem.hour < 12 ? `${hourItem.hour} AM` :
                    hourItem.hour === 12 ? '12 PM' :
                      `${hourItem.hour - 12} PM`;
                tooltip.html(`
                  <div style="font-weight: 700; margin-bottom: 4px;">${hourLabel}</div>
                  <div style="color: ${senderColor}; font-weight: 600;">${sender}: ${senderCount} responses</div>
                  <div style="margin-top: 4px; font-size: 12px; opacity: 0.8;">Total: ${hourItem.total} responses</div>
                  <div style="margin-top: 2px; font-size: 12px; opacity: 0.8;">Avg time: ${formatResponseTime(hourItem.avgResponseTime)}</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 10) + 'px');
              })
              .on('mouseout', function () {
                d3.select(this).attr('opacity', 1);
                tooltip.transition().duration(300).style('opacity', 0);
              })
              .transition()
              .duration(800)
              .delay(senderIndex * 50)
              .attr('y', currentY - barHeight)
              .attr('height', barHeight);

            currentY -= barHeight;
          });
        });

        // Add legend (hide on mobile to save space)
        if (!isMobile) {
          const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 20}, 20)`);

          allSenders.forEach((sender, index) => {
            const senderColor = getSenderColor(index, theme);
            const legendItem = legend.append('g')
              .attr('transform', `translate(0, ${index * 24})`);

            legendItem.append('rect')
              .attr('x', 0)
              .attr('y', -6)
              .attr('width', 12)
              .attr('height', 12)
              .attr('rx', 3)
              .attr('fill', senderColor);

            legendItem.append('text')
              .attr('x', 18)
              .attr('y', 0)
              .attr('dy', '0.35em')
              .style('font-size', '12px')
              .style('font-family', '"Plus Jakarta Sans", sans-serif')
              .style('fill', isDark ? '#9CA3AF' : '#4B5563')
              .text(sender.length > 15 ? sender.substring(0, 15) + '...' : sender);
          });
        }
      } else {
        // Simple bars with gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
          .attr('id', 'hourlyResponseGradient')
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', '#06B6D4'); // Cyan

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', '#3B82F6'); // Blue

        g.selectAll('.bar')
          .data(hourlyData)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d.hour.toString()) || 0)
          .attr('width', x.bandwidth())
          .attr('y', height)
          .attr('height', 0)
          .attr('fill', 'url(#hourlyResponseGradient)')
          .attr('rx', 4)
          .style('cursor', 'pointer')
          .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 1);
            const hourLabel = d.hour === 0 ? '12 AM' :
              d.hour < 12 ? `${d.hour} AM` :
                d.hour === 12 ? '12 PM' :
                  `${d.hour - 12} PM`;
            tooltip.html(`
              <div style="font-weight: 700; margin-bottom: 4px;">${hourLabel}</div>
              <div style="font-weight: 600; color: #06B6D4;">${d.total} responses</div>
              <div style="margin-top: 2px; font-size: 12px; opacity: 0.8;">Avg time: ${formatResponseTime(d.avgResponseTime)}</div>
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 1);
            tooltip.transition().duration(300).style('opacity', 0);
          })
          .transition()
          .duration(800)
          .attr('y', d => y(d.total))
          .attr('height', d => height - y(d.total));
      }

      // Cleanup function
      return () => {
        d3.select(`#${tooltipId}`).remove();
      };
    }, [responseData, separateBySender, theme]);

    return <svg ref={ref} className="w-full h-auto" />;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Timer}
          label="Avg Response Time"
          value={formatResponseTime(responseStats.avgResponseTime)}
          color="violet"
          description="Average time taken to respond to a message"
        />
        <MetricCard
          icon={Zap}
          label="Fastest Responder"
          value={topStats.fastestResponder?.sender || 'N/A'}
          color="amber"
          description={`Average response time: ${formatResponseTime(topStats.fastestResponder?.avgTime || 0)}`}
          trend="Top Speed"
        />
        <MetricCard
          icon={MessageCircle}
          label="Conversation Starter"
          value={topStats.topStarter?.sender || 'N/A'}
          color="emerald"
          description={`Started ${topStats.topStarter?.starts || 0} conversations`}
          trend="Most Initiative"
        />
        <MetricCard
          icon={Network}
          label="Top Interaction"
          value={topStats.topPair ? `${topStats.topPair.from} → ${topStats.topPair.to}` : 'N/A'}
          color="blue"
          description={`${topStats.topPair?.count || 0} responses exchanged`}
        />
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 bg-white/50 dark:bg-gray-900/50 rounded-xl backdrop-blur-sm border border-white/10 overflow-x-auto">
        {(['overview', 'timeline', 'pairs'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${viewMode === mode
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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              {viewMode === 'overview' ? 'Response Time Distribution' :
                viewMode === 'timeline' ? 'Hourly Response Patterns' :
                  'Interaction Pairs'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {viewMode === 'overview' ? 'How quickly do people respond?' :
                viewMode === 'timeline' ? 'When are people most likely to respond?' :
                  'Who responds to whom the most?'}
            </p>
          </div>

          {viewMode !== 'pairs' && (
            <ChartControls
              separateBySender={chartSettings.separateMessagesBySender}
              onSeparateBySenderChange={(checked) => updateChartSettings({ separateMessagesBySender: checked })}
            />
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px]">
            {viewMode === 'overview' && (
              <ResponseTimeHistogram
                responseData={responseStats.responseData}
                separateBySender={chartSettings.separateMessagesBySender}
                theme={theme}
              />
            )}
            {viewMode === 'timeline' && (
              <HourlyResponseChart
                responseData={responseStats.responseData}
                separateBySender={chartSettings.separateMessagesBySender}
                theme={theme}
              />
            )}
            {viewMode === 'pairs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {responseStats.responsePairs.slice(0, 10).map((pair, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-800 bg-primary-500">
                          {pair.from.substring(0, 1)}
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-800 bg-secondary-500">
                          {pair.to.substring(0, 1)}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          {pair.from} <ArrowRight className="w-3 h-3 text-gray-400" /> {pair.to}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Avg: {formatResponseTime(pair.avgResponseTime)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary-600 dark:text-primary-400">{pair.count}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">responses</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassContainer>

      {/* Additional Stats (Starters/Enders) - Always visible or only in overview? Let's keep them visible but in a grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassContainer>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            Conversation Starters
          </h3>
          <div className="space-y-4">
            {responseStats.conversationStarters.slice(0, 5).map((starter, idx) => (
              <div key={starter.sender} className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm" style={{ backgroundColor: getSenderColor(idx, theme) }}>
                    {starter.sender.substring(0, 1)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{starter.sender}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{starter.totalMessages} total messages</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{starter.starts}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">starts</div>
                </div>
              </div>
            ))}
          </div>
        </GlassContainer>

        <GlassContainer>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-blue-500" />
            Conversation Enders
          </h3>
          <div className="space-y-4">
            {Object.entries(responseStats.conversationEnders)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([sender, ends], idx) => (
                <div key={sender} className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm" style={{ backgroundColor: getSenderColor(idx, theme) }}>
                      {sender.substring(0, 1)}
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">{sender}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600 dark:text-blue-400">{ends}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ends</div>
                  </div>
                </div>
              ))}
          </div>
        </GlassContainer>
      </div>
    </div>
  );
};
