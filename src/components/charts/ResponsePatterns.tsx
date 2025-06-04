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
  Check
} from 'lucide-react';

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

export const ResponsePatterns: React.FC<ResponsePatternsProps> = ({
  messages = []
}) => {
  const { theme } = useTheme();
  const { chartSettings, updateChartSettings } = useUIStore();
  const [viewMode, setViewMode] = useState<'overview' | 'timeline' | 'pairs' | 'flow'>('overview');

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
      mostDoubles: Object.entries(doubleMessages).sort(([,a], [,b]) => b - a)[0]
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
        left: isMobile ? 40 : 60
      };
      const containerWidth = Math.min(availableWidth - 20, isMobile ? 380 : 800);
      const width = containerWidth - margin.left - margin.right;
      const height = isMobile ? 250 : 300;

      svg.selectAll('*').remove();
      const colors = getChartColors(theme);

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
        .padding(0.1);

      const y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, maxCount]);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', colors.axis)
        .style('font-size', isMobile ? '10px' : '12px')
        .style('text-anchor', isMobile ? 'end' : 'middle')
        .attr('dx', isMobile ? '-.8em' : '0')
        .attr('dy', isMobile ? '.15em' : '.71em')
        .attr('transform', isMobile ? 'rotate(-45)' : 'rotate(0)');

      g.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', colors.axis)
        .style('font-size', isMobile ? '10px' : '12px');

      // Y axis label (hide on mobile to save space)
      if (!isMobile) {
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -40)
          .attr('x', -height / 2)
          .attr('text-anchor', 'middle')
          .style('fill', colors.text)
          .style('font-size', '14px')
          .text('Number of Responses');
      }

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'response-histogram-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.grid}`)
        .style('border-radius', '8px')
        .style('padding', '8px 12px')
        .style('font-size', '12px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('z-index', '1000');

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
              .attr('stroke', colors.background)
              .attr('stroke-width', 0.5)
              .style('cursor', 'pointer')
              .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
                  <div style="font-weight: bold;">${binItem.bin}</div>
                  <div style="color: ${senderColor}; margin-top: 4px;">${sender}: ${senderCount} responses</div>
                  <div style="margin-top: 2px;">Total: ${binItem.total} responses</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 10) + 'px');
              })
              .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                tooltip.transition().duration(300).style('opacity', 0);
              })
              .transition()
              .duration(800)
              .delay(senderIndex * 100)
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
            .attr('transform', `translate(0, ${index * 20})`);

          legendItem.append('rect')
            .attr('x', 0)
            .attr('y', -6)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', senderColor);

          legendItem.append('text')
            .attr('x', 18)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .style('fill', colors.text)
            .text(sender.length > 15 ? sender.substring(0, 15) + '...' : sender);
        });
        }
      } else {
        // Simple bars
        g.selectAll('.bar')
          .data(binData)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d.bin) || 0)
          .attr('width', x.bandwidth())
          .attr('y', height)
          .attr('height', 0)
          .attr('fill', colors.line)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
              <div style="font-weight: bold;">${d.bin}</div>
              <div style="margin-top: 4px;">${d.total} responses</div>
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
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
        d3.selectAll('.response-histogram-tooltip').remove();
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
        .padding(0.1);

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
              // Show fewer ticks on mobile
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
        .style('fill', colors.axis)
        .style('font-size', isMobile ? '9px' : '12px')
        .style('text-anchor', isMobile ? 'end' : 'middle')
        .attr('dx', isMobile ? '-.5em' : '0')
        .attr('dy', isMobile ? '.15em' : '.71em')
        .attr('transform', isMobile ? 'rotate(-45)' : 'rotate(0)');

      g.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('fill', colors.axis)
        .style('font-size', isMobile ? '10px' : '12px');

      // Y axis label (hide on mobile to save space)
      if (!isMobile) {
        g.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('y', -40)
          .attr('x', -height / 2)
          .attr('text-anchor', 'middle')
          .style('fill', colors.text)
          .style('font-size', '14px')
          .text('Number of Responses');
      }

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'hourly-response-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.grid}`)
        .style('border-radius', '8px')
        .style('padding', '8px 12px')
        .style('font-size', '12px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('z-index', '1000');

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
              .attr('stroke', colors.background)
              .attr('stroke-width', 0.5)
              .style('cursor', 'pointer')
              .on('mouseover', function(event) {
                d3.select(this).attr('opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', 1);
                const hourLabel = hourItem.hour === 0 ? '12 AM' :
                                 hourItem.hour < 12 ? `${hourItem.hour} AM` :
                                 hourItem.hour === 12 ? '12 PM' :
                                 `${hourItem.hour - 12} PM`;
                tooltip.html(`
                  <div style="font-weight: bold;">${hourLabel}</div>
                  <div style="color: ${senderColor}; margin-top: 4px;">${sender}: ${senderCount} responses</div>
                  <div style="margin-top: 2px;">Total: ${hourItem.total} responses</div>
                  <div style="margin-top: 2px;">Avg time: ${formatResponseTime(hourItem.avgResponseTime)}</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 10) + 'px');
              })
              .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
                tooltip.transition().duration(300).style('opacity', 0);
              })
              .transition()
              .duration(800)
              .delay(senderIndex * 100)
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
            .attr('transform', `translate(0, ${index * 20})`);

          legendItem.append('rect')
            .attr('x', 0)
            .attr('y', -6)
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', senderColor);

          legendItem.append('text')
            .attr('x', 18)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .style('fill', colors.text)
            .text(sender.length > 15 ? sender.substring(0, 15) + '...' : sender);
        });
        }
      } else {
        // Simple bars
        g.selectAll('.bar')
          .data(hourlyData)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', d => x(d.hour.toString()) || 0)
          .attr('width', x.bandwidth())
          .attr('y', height)
          .attr('height', 0)
          .attr('fill', colors.line)
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 1);
            const hourLabel = d.hour === 0 ? '12 AM' :
                             d.hour < 12 ? `${d.hour} AM` :
                             d.hour === 12 ? '12 PM' :
                             `${d.hour - 12} PM`;
            tooltip.html(`
              <div style="font-weight: bold;">${hourLabel}</div>
              <div style="margin-top: 4px;">${d.total} responses</div>
              <div style="margin-top: 2px;">Avg time: ${formatResponseTime(d.avgResponseTime)}</div>
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
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
        d3.selectAll('.hourly-response-tooltip').remove();
      };
    }, [responseData, separateBySender, theme]);

    return <svg ref={ref} className="w-full h-auto" />;
  };

  // Response Pair Matrix Component
  const ResponsePairMatrix: React.FC<{
    responsePairs: ResponsePairStats[];
    theme: Theme;
  }> = ({ responsePairs, theme }) => {
    const ref = useD3((svg) => {
      svg.selectAll('*').remove();
      const colors = getChartColors(theme);

      // Get all unique senders
      const allSenders = Array.from(new Set([
        ...responsePairs.map(p => p.from),
        ...responsePairs.map(p => p.to)
      ])).sort();

      if (allSenders.length === 0) return;

      // Create matrix data
      const matrixData: Array<{
        from: string;
        to: string;
        count: number;
        avgTime: number;
        fromIndex: number;
        toIndex: number;
      }> = [];

      allSenders.forEach((from, fromIndex) => {
        allSenders.forEach((to, toIndex) => {
          const pair = responsePairs.find(p => p.from === from && p.to === to);
          matrixData.push({
            from,
            to,
            count: pair?.count || 0,
            avgTime: pair?.avgResponseTime || 0,
            fromIndex,
            toIndex
          });
        });
      });

      const maxCount = Math.max(...matrixData.map(d => d.count));
      if (maxCount === 0) return; // No data to display

      const cellSize = Math.min(60, Math.max(40, 500 / allSenders.length));
      const margin = { top: 120, right: 100, bottom: 80, left: 120 };
      const width = allSenders.length * cellSize + margin.left + margin.right;
      const height = allSenders.length * cellSize + margin.top + margin.bottom;

      svg
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('class', 'w-full h-auto');

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Color scale for intensity
      const colorScale = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(d3.interpolateRgb(colors.low || '#E5E7EB', colors.high || '#3B82F6'));

      // Create tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'response-matrix-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.grid}`)
        .style('border-radius', '8px')
        .style('padding', '8px 12px')
        .style('font-size', '12px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('z-index', '1000');

      // Draw matrix cells
      g.selectAll('.matrix-cell')
        .data(matrixData)
        .enter().append('rect')
        .attr('class', 'matrix-cell')
        .attr('x', d => d.toIndex * cellSize)
        .attr('y', d => d.fromIndex * cellSize)
        .attr('width', cellSize - 1)
        .attr('height', cellSize - 1)
        .attr('fill', d => d.count > 0 ? colorScale(d.count) : colors.background)
        .attr('stroke', colors.grid)
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          if (d.count > 0) {
            d3.select(this).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`
              <div style="font-weight: bold;">${d.from} → ${d.to}</div>
              <div style="margin-top: 4px;">${d.count} responses</div>
              ${d.avgTime > 0 ? `<div style="margin-top: 2px;">Avg time: ${formatResponseTime(d.avgTime)}</div>` : ''}
            `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          tooltip.transition().duration(300).style('opacity', 0);
        });

      // Add text labels for non-zero values (but limit display to reasonable numbers)
      g.selectAll('.matrix-text')
        .data(matrixData.filter(d => d.count > 0 && d.count <= 9999)) // Limit to reasonable display numbers
        .enter().append('text')
        .attr('class', 'matrix-text')
        .attr('x', d => d.toIndex * cellSize + cellSize / 2)
        .attr('y', d => d.fromIndex * cellSize + cellSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('fill', d => d.count > maxCount * 0.6 ? 'white' : colors.text)
        .style('font-size', `${Math.min(14, cellSize / 4)}px`)
        .style('font-weight', 'bold')
        .style('pointer-events', 'none')
        .text(d => d.count > 999 ? `${Math.round(d.count/1000)}k` : d.count);

      // Add row labels (from - who sends the initial message)
      g.selectAll('.row-label')
        .data(allSenders)
        .enter().append('text')
        .attr('class', 'row-label')
        .attr('x', -10)
        .attr('y', (_, i) => i * cellSize + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.35em')
        .style('fill', colors.text)
        .style('font-size', `${Math.min(14, cellSize / 2.5)}px`)
        .style('font-weight', '500')
        .text(d => d.length > 10 ? d.substring(0, 10) + '...' : d);

      // Add column labels (to - who responds)
      g.selectAll('.col-label')
        .data(allSenders)
        .enter().append('text')
        .attr('class', 'col-label')
        .attr('x', (_, i) => i * cellSize + cellSize / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('fill', colors.text)
        .style('font-size', `${Math.min(14, cellSize / 2.5)}px`)
        .style('font-weight', '500')
        .text(d => d.length > 10 ? d.substring(0, 10) + '...' : d);

      // Add axis titles
      g.append('text')
        .attr('x', (allSenders.length * cellSize) / 2)
        .attr('y', -50)
        .attr('text-anchor', 'middle')
        .style('fill', colors.text)
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('Responds To →');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(allSenders.length * cellSize) / 2)
        .attr('y', -50)
        .attr('text-anchor', 'middle')
        .style('fill', colors.text)
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('← Initiates');

      // Add color legend
      const legendWidth = 200;
      const legendHeight = 10;
      const legend = g.append('g')
        .attr('transform', `translate(${allSenders.length * cellSize - legendWidth}, ${allSenders.length * cellSize + 30})`);

      // Create gradient
      const defs = svg.append('defs');
      const gradient = defs.append('linearGradient')
        .attr('id', 'matrix-gradient')
        .attr('x1', '0%')
        .attr('x2', '100%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colors.low || '#E5E7EB');

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colors.high || '#3B82F6');

      legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .attr('fill', 'url(#matrix-gradient)')
        .attr('stroke', colors.grid)
        .attr('stroke-width', 0.5);

      legend.append('text')
        .attr('x', 0)
        .attr('y', legendHeight + 15)
        .style('fill', colors.text)
        .style('font-size', '12px')
        .text('0');

      legend.append('text')
        .attr('x', legendWidth)
        .attr('y', legendHeight + 15)
        .attr('text-anchor', 'end')
        .style('fill', colors.text)
        .style('font-size', '12px')
        .text(`${maxCount} responses`);

      legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', legendHeight + 30)
        .attr('text-anchor', 'middle')
        .style('fill', colors.text)
        .style('font-size', '11px')
        .style('font-weight', '500')
        .text('Response Frequency');

      // Cleanup function
      return () => {
        d3.selectAll('.response-matrix-tooltip').remove();
      };
    }, [responsePairs, theme]);

    return <svg ref={ref} className="w-full h-auto" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Responses</span>
            <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {responseStats.totalResponses.toLocaleString()}
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            analyzed interactions
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-600 dark:text-green-400 text-sm font-medium">Avg Response Time</span>
            <Timer className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            {formatResponseTime(responseStats.avgResponseTime)}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300 mt-1">
            across all conversations
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">Fastest Responder</span>
            <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-900 dark:text-purple-100 truncate">
            {topStats.fastestResponder?.sender || 'N/A'}
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
            {topStats.fastestResponder ? formatResponseTime(topStats.fastestResponder.avgTime) : 'No data'}
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-600 dark:text-orange-400 text-sm font-medium">Top Starter</span>
            <Target className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-lg font-bold text-orange-900 dark:text-orange-100 truncate">
            {topStats.topStarter?.sender || 'N/A'}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
            {topStats.topStarter ? `${topStats.topStarter.starts} conversations` : 'No data'}
          </div>
        </div>
      </div>

      {/* View Mode Tabs and Settings */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          {(['overview', 'timeline', 'pairs', 'flow'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Separate by Sender Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Separate by Sender</span>
          <label className="cursor-pointer">
            <input
              type="checkbox"
              checked={chartSettings.separateMessagesBySender}
              onChange={(e) => updateChartSettings({ separateMessagesBySender: e.target.checked })}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              chartSettings.separateMessagesBySender
                ? 'bg-blue-500 border-blue-500'
                : 'border-gray-300 dark:border-gray-500'
            }`}>
              {chartSettings.separateMessagesBySender && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {viewMode === 'overview' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Response Patterns Overview
            </h3>

            {responseStats.totalResponses === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Response Data Available
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Not enough conversation data to analyze response patterns. Try loading a chat with more back-and-forth messages.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Response Time Distribution */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Response Speed Champions
                  </h4>
                  <div className="space-y-3">
                    {responseStats.fastestResponders.slice(0, 5).map((responder, index) => (
                      <div key={responder.sender} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                            index === 1 ? 'bg-gray-300 text-gray-700' :
                            index === 2 ? 'bg-amber-600 text-white' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {responder.sender}
                          </span>
                        </div>
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                          {formatResponseTime(responder.avgTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conversation Starters */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Conversation Initiators
                  </h4>
                  <div className="space-y-3">
                    {responseStats.conversationStarters.slice(0, 5).map((starter, index) => (
                      <div key={starter.sender} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {starter.sender}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-gray-900 dark:text-white">
                            {starter.starts}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            conversations
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Responsive Pairs */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Most Interactive Pairs
                  </h4>
                  <div className="space-y-3">
                    {responseStats.responsePairs.slice(0, 5).map((pair) => (
                      <div key={`${pair.from}-${pair.to}`} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {pair.from} → {pair.to}
                          </div>
                          <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            {pair.count} responses
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Avg: {formatResponseTime(pair.avgResponseTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Response Rate Analysis */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Response Rates
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(responseStats.responseRates)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 5)
                      .map(([sender, rate]) => (
                        <div key={sender} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {sender}
                            </span>
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                              {rate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'timeline' && (
          <div>
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
              Response Timeline Analysis
            </h3>

            {responseStats.responseData.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📈</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Timeline Data
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Not enough conversation data to analyze response timelines.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Response Time Distribution Histogram */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">Response Time Distribution</h4>
                  <ResponseTimeHistogram
                    responseData={responseStats.responseData}
                    separateBySender={chartSettings.separateMessagesBySender}
                    theme={theme}
                  />
                </div>

                {/* Response Activity by Hour */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">Response Activity by Hour</h4>
                  <HourlyResponseChart
                    responseData={responseStats.responseData}
                    separateBySender={chartSettings.separateMessagesBySender}
                    theme={theme}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'pairs' && (
          <div>
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
              Response Pair Analysis
            </h3>

            {responseStats.responsePairs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔗</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Pair Data
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Not enough conversation data to analyze response pairs.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Response Matrix */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">Response Interaction Matrix</h4>
                  <ResponsePairMatrix
                    responsePairs={responseStats.responsePairs}
                    theme={theme}
                  />
                </div>

                {/* Top Pairs Details */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">Most Active Response Pairs</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {responseStats.responsePairs.slice(0, 10).map((pair, index) => (
                      <div key={`${pair.from}-${pair.to}`} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index < 3 ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {pair.from} → {pair.to}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {pair.count} responses
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>Avg Response Time:</span>
                          <span className="font-mono">{formatResponseTime(pair.avgResponseTime)}</span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (pair.count / responseStats.responsePairs[0]?.count || 1) * 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'flow' && (
          <div>
            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
              Conversation Flow Analysis
            </h3>

            {responseStats.responseData.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🌊</div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Flow Data
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  Not enough conversation data to analyze flow patterns.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Conversation Momentum */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Conversation Momentum
                  </h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Quick Responses (&lt; 5 min)</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {responseStats.responseData.filter(r => r.responseTimeMinutes < 5).length}
                        </span>
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        {((responseStats.responseData.filter(r => r.responseTimeMinutes < 5).length / responseStats.responseData.length) * 100).toFixed(1)}% of all responses
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">Active Conversations (&lt; 1 hr)</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {responseStats.responseData.filter(r => r.responseTimeMinutes < 60).length}
                        </span>
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300">
                        {((responseStats.responseData.filter(r => r.responseTimeMinutes < 60).length / responseStats.responseData.length) * 100).toFixed(1)}% of all responses
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Delayed Responses (&gt; 4 hr)</span>
                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {responseStats.responseData.filter(r => r.responseTimeMinutes > 240).length}
                        </span>
                      </div>
                      <div className="text-xs text-orange-700 dark:text-orange-300">
                        {((responseStats.responseData.filter(r => r.responseTimeMinutes > 240).length / responseStats.responseData.length) * 100).toFixed(1)}% of all responses
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conversation Flow Patterns */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Flow Patterns
                  </h4>
                  <div className="space-y-4">
                    {/* Double Messages */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">Multiple Message Senders</h5>
                      <div className="space-y-2">
                        {Object.entries(responseStats.doubleMessages)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([sender, count]) => (
                            <div key={sender} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {sender}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div
                                    className="bg-purple-500 h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(100, (count / Math.max(...Object.values(responseStats.doubleMessages))) * 100)}%`
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-8">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* Conversation Enders */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">Conversation Enders</h5>
                      <div className="space-y-2">
                        {Object.entries(responseStats.conversationEnders)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([sender, count]) => (
                            <div key={sender} className="flex items-center justify-between">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {sender}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                  <div
                                    className="bg-red-500 h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(100, (count / Math.max(...Object.values(responseStats.conversationEnders))) * 100)}%`
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-8">
                                  {count}
                                </span>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>

                    {/* Response Rate Summary */}
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                      <h5 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Flow Summary</h5>
                      <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                        <div>• {responseStats.totalResponses} total responses analyzed</div>
                        <div>• {responseStats.responsePairs.length} unique conversation pairs</div>
                        <div>• {responseStats.conversationStarters.length} active participants</div>
                        <div>• {Object.values(responseStats.doubleMessages).reduce((sum, count) => sum + count, 0)} multi-message sequences</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
