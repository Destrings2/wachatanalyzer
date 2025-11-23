import React, { useMemo, useState, useRef } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { format } from 'date-fns';
import { useUIStore, ChartSettings } from '../../stores/uiStore';
import { aggregateDailyActivity } from '../../utils/analyzer';
import { getSenderColor, getChartColors } from '../../utils/chartUtils';
import { GlassContainer } from '../common/GlassContainer';
import { ChartControls } from '../common/ChartControls';

interface ActivityTimelineProps {
  analytics: ProcessedAnalytics;
  settings: ChartSettings;
}

interface DataPoint {
  date: Date;
  count: number;
  [key: string]: Date | number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ analytics, settings }) => {
  const { theme, updateChartSettings } = useUIStore();
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Store brush selection (not domain) to maintain zoom state
  const brushSelectionRef = useRef<[number, number] | null>(null);

  // Transform daily activity data for D3
  const data = useMemo(() => {
    const dailyBySender = analytics.timePatterns.dailyActivity;
    const allSenders = Object.keys(dailyBySender).sort();

    if (settings.separateMessagesBySender) {
      // Create data with separate series for each sender
      const allDates = new Set<string>();
      Object.values(dailyBySender).forEach(senderData => {
        Object.keys(senderData).forEach(date => allDates.add(date));
      });

      const dates = Array.from(allDates).sort();
      return dates.map(date => {
        const result: { date: Date; count: number;[key: string]: Date | number } = {
          date: new Date(date),
          count: 0
        };

        // Add count for each sender and calculate total
        allSenders.forEach(sender => {
          const senderCount = dailyBySender[sender]?.[date] || 0;
          result[sender] = senderCount;
          result.count += senderCount;
        });

        return result;
      });
    } else {
      // Aggregate all senders
      const aggregated = aggregateDailyActivity(dailyBySender);
      return Object.entries(aggregated).map(([date, count]) => ({
        date: new Date(date),
        count,
      })).sort((a, b) => a.date.getTime() - b.date.getTime());
    }
  }, [analytics.timePatterns.dailyActivity, settings.separateMessagesBySender]);

  const ref = useD3(
    (svg) => {
      // Get the container width from the SVG parent
      const containerWidth = svg.node()?.parentElement?.clientWidth || 1000;
      const isMobile = containerWidth < 768;

      const margin = {
        top: 20,
        right: isMobile ? 20 : 150,
        bottom: isMobile ? 60 : 80,
        left: isMobile ? 40 : 60
      };
      const width = Math.max(300, containerWidth - margin.left - margin.right);
      const height = isMobile ? 300 : 400;
      const contextHeight = isMobile ? 40 : 50;
      const contextMargin = { top: height + margin.top + 40, bottom: 0 };

      // Color scheme based on theme
      const colors = getChartColors(theme);

      // Get unique senders from analytics data
      const allSenders = settings.separateMessagesBySender
        ? Object.keys(analytics.timePatterns.dailyActivity).sort()
        : [];

      // Clear previous content
      svg.selectAll('*').remove();

      // Set dimensions
      svg
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom + contextHeight + 40)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + contextHeight + 40}`)
        .attr('class', 'w-full h-auto');

      // Create clip path for main chart
      svg.append('defs').append('clipPath')
        .attr('id', 'clip')
        .append('rect')
        .attr('width', width)
        .attr('height', height);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales
      const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date) as [Date, Date])
        .range([0, width]);

      // Calculate max value considering sender separation
      const maxValue = settings.separateMessagesBySender && allSenders.length > 0
        ? d3.max(data, d => Math.max(...allSenders.map(sender => (d[sender] as number) || 0))) as number
        : d3.max(data, d => d.count) as number;

      const y = d3.scaleLinear()
        .domain([0, maxValue])
        .nice()
        .range([height, 0]);

      // Create scales for context (minimap)
      const x2 = d3.scaleTime()
        .domain(x.domain())
        .range([0, width]);

      const y2 = d3.scaleLinear()
        .domain(y.domain())
        .range([contextHeight, 0]);

      // Grid lines
      g.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
          .tickSize(-width)
          .tickFormat(() => '')
        )
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3)
        .selectAll('line')
        .style('stroke', colors.grid);

      // Area generator
      const area = d3.area<typeof data[0]>()
        .x(d => x(d.date))
        .y0(height)
        .y1(d => y(d.count))
        .curve(d3.curveMonotoneX);

      // Line generator
      const line = d3.line<typeof data[0]>()
        .x(d => x(d.date))
        .y(d => y(d.count))
        .curve(d3.curveMonotoneX);

      // Context area (for minimap)
      const area2 = d3.area<typeof data[0]>()
        .x(d => x2(d.date))
        .y0(contextHeight)
        .y1(d => y2(d.count))
        .curve(d3.curveMonotoneX);

      // Create a group for elements that will be zoomed/panned
      const focus = g.append('g')
        .attr('class', 'focus');

      // Store references for update function
      let areaPath: d3.Selection<SVGPathElement, unknown, null, undefined> | null = null;
      let linePath: d3.Selection<SVGPathElement, unknown, null, undefined> | null = null;
      let dots: d3.Selection<SVGCircleElement, typeof data[0], SVGGElement, unknown> | null = null;
      const senderPaths: d3.Selection<SVGPathElement, unknown, null, undefined>[] = [];
      const senderDots: d3.Selection<SVGCircleElement, typeof data[0], SVGGElement, unknown>[] = [];

      if (chartType === 'bar') {
        // Bar chart implementation
        // Calculate dynamic bar width based on visible data points
        const visibleDomain = x.domain();
        const visibleData = data.filter(d => d.date >= visibleDomain[0] && d.date <= visibleDomain[1]);
        const barGroupWidth = Math.min(width / Math.max(visibleData.length, 1) * 0.8, 80); // Cap max width at 80px

        if (settings.separateMessagesBySender && allSenders.length > 0) {
          // Side-by-side bars for multiple senders
          const barWidth = barGroupWidth / allSenders.length;

          allSenders.forEach((sender, index) => {
            const senderColor = getSenderColor(index, theme);

            focus.selectAll(`.bar-${index}`)
              .data(data)
              .enter().append('rect')
              .attr('class', `bar bar-${index}`)
              .attr('x', d => x(d.date) - barGroupWidth / 2 + index * barWidth)
              .attr('y', d => y((d[sender] as number) || 0))
              .attr('width', barWidth * 0.9) // Small gap between bars
              .attr('height', d => height - y((d[sender] as number) || 0))
              .attr('fill', senderColor)
              .attr('clip-path', 'url(#clip)')
              .style('cursor', 'pointer')
              .on('mouseover', function (event, d) {
                d3.select(this).style('opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
                  <div style="font-weight: bold">${format(d.date, 'MMM d, yyyy')}</div>
                  <div style="margin-top: 4px; color: ${senderColor}">${sender}: ${d[sender]} messages</div>
                  <div style="margin-top: 2px">Total: ${d.count} messages</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 28) + 'px');
              })
              .on('mouseout', function () {
                d3.select(this).style('opacity', 1);
                tooltip.transition().duration(500).style('opacity', 0);
              });
          });
        } else {
          // Simple bar chart
          const barWidth = barGroupWidth;
          focus.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.date) - barWidth / 2)
            .attr('y', d => y(d.count))
            .attr('width', barWidth)
            .attr('height', d => height - y(d.count))
            .attr('fill', colors.line)
            .attr('clip-path', 'url(#clip)')
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
              d3.select(this).style('opacity', 0.8);
              tooltip.transition().duration(200).style('opacity', 1);
              tooltip.html(`
                <div style="font-weight: bold">${format(d.date, 'MMM d, yyyy')}</div>
                <div style="margin-top: 4px">${d.count} messages</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function () {
              d3.select(this).style('opacity', 1);
              tooltip.transition().duration(500).style('opacity', 0);
            });
        }
      } else {
        // Line chart implementation (existing code)
        if (settings.separateMessagesBySender && allSenders.length > 0) {
          // Multiple lines for each sender
          allSenders.forEach((sender, index) => {
            const senderColor = getSenderColor(index, theme);

            // Line generator for this sender
            const senderLine = d3.line<typeof data[0]>()
              .x(d => x(d.date))
              .y(d => y((d[sender] as number) || 0))
              .curve(d3.curveMonotoneX);

            // Add line for this sender
            const senderPath = focus.append('path')
              .datum(data)
              .attr('fill', 'none')
              .attr('stroke', senderColor)
              .attr('stroke-width', 2)
              .attr('d', senderLine)
              .attr('clip-path', 'url(#clip)')
              .attr('class', `sender-line-${index}`);

            senderPaths[index] = senderPath;

            // Add dots for this sender
            const senderDotsSelection = focus.selectAll(`.dot-${index}`)
              .data(data)
              .enter().append('circle')
              .attr('class', `dot dot-${index}`)
              .attr('cx', d => x(d.date))
              .attr('cy', d => y((d[sender] as number) || 0))
              .attr('r', 3)
              .attr('fill', senderColor)
              .attr('clip-path', 'url(#clip)')
              .style('cursor', 'pointer')
              .on('mouseover', function (event, d) {
                d3.select(this).transition().duration(100).attr('r', 5);
                tooltip.transition().duration(200).style('opacity', 1);
                tooltip.html(`
                  <div style="font-weight: bold">${format(d.date, 'MMM d, yyyy')}</div>
                  <div style="margin-top: 4px; color: ${senderColor}">${sender}: ${d[sender]} messages</div>
                  <div style="margin-top: 2px">Total: ${d.count} messages</div>
                `)
                  .style('left', (event.pageX + 10) + 'px')
                  .style('top', (event.pageY - 28) + 'px');
              })
              .on('mouseout', function () {
                d3.select(this).transition().duration(100).attr('r', 3);
                tooltip.transition().duration(500).style('opacity', 0);
              });

            senderDots[index] = senderDotsSelection;
          });
        } else {
          // Single line/area (default behavior)
          areaPath = focus.append('path')
            .datum(data)
            .attr('fill', colors.area)
            .attr('fill-opacity', 0.1)
            .attr('d', area)
            .attr('clip-path', 'url(#clip)');

          linePath = focus.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', colors.line)
            .attr('stroke-width', 2)
            .attr('d', line)
            .attr('clip-path', 'url(#clip)');

          // Interactive dots with clipping
          dots = focus.selectAll('.dot')
            .data(data)
            .enter().append('circle')
            .attr('class', 'dot')
            .attr('cx', d => x(d.date))
            .attr('cy', d => y(d.count))
            .attr('r', 4)
            .attr('fill', colors.line)
            .attr('clip-path', 'url(#clip)')
            .style('cursor', 'pointer')
            .on('mouseover', function (event, d) {
              d3.select(this).transition().duration(100).attr('r', 6);
              tooltip.transition().duration(200).style('opacity', 1);
              tooltip.html(`
                <div style="font-weight: bold">${format(d.date, 'MMM d, yyyy')}</div>
                <div style="margin-top: 4px">${d.count} messages</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function () {
              d3.select(this).transition().duration(100).attr('r', 4);
              tooltip.transition().duration(500).style('opacity', 0);
            });
        }
      }

      // X Axis
      const xAxis = g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
          .tickFormat(d => format(d as Date, 'MMM d'))
          .ticks(d3.timeWeek.every(1))
        );

      xAxis.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('fill', colors.axis);

      // Y Axis
      const yAxis = g.append('g')
        .call(d3.axisLeft(y));

      yAxis.selectAll('text')
        .style('fill', colors.axis);

      // Axis lines
      g.selectAll('.domain')
        .style('stroke', colors.axis);
      g.selectAll('.tick line')
        .style('stroke', colors.axis);

      // Labels
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', colors.text)
        .style('font-size', '14px')
        .text('Messages');

      g.append('text')
        .attr('transform', `translate(${width / 2}, ${height + margin.bottom + 50})`)
        .style('text-anchor', 'middle')
        .style('fill', colors.text)
        .style('font-size', '14px')
        .text('Date');

      // Tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', theme === 'dark' ? '#1f2937' : 'white')
        .style('border', `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`)
        .style('border-radius', '6px')
        .style('padding', '8px 12px')
        .style('font-size', '12px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('z-index', '1000');

      // Add legend for sender separation
      if (settings.separateMessagesBySender && allSenders.length > 0) {
        const legend = g.append('g')
          .attr('class', 'legend')
          .attr('transform', `translate(${width + 20}, 20)`);

        allSenders.forEach((sender, index) => {
          const senderColor = getSenderColor(index, theme);
          const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${index * 20})`);

          legendItem.append('line')
            .attr('x1', 0)
            .attr('x2', 15)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', senderColor)
            .attr('stroke-width', 2);

          legendItem.append('text')
            .attr('x', 20)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .style('fill', colors.text)
            .text(sender.length > 15 ? sender.substring(0, 15) + '...' : sender);
        });
      }

      // Context (minimap)
      const context = svg.append('g')
        .attr('class', 'context')
        .attr('transform', `translate(${margin.left},${contextMargin.top})`);

      context.append('path')
        .datum(data)
        .attr('fill', colors.area)
        .attr('fill-opacity', 0.1)
        .attr('d', area2);

      context.append('g')
        .attr('transform', `translate(0,${contextHeight})`)
        .call(d3.axisBottom(x2)
          .tickFormat(d => format(d as Date, 'MMM'))
          .ticks(d3.timeMonth.every(1))
        )
        .selectAll('text')
        .style('fill', colors.axis);

      // Brush for context
      const brush = d3.brushX()
        .extent([[0, 0], [width, contextHeight]])
        .on('brush end', brushed);

      const brushGroup = context.append('g')
        .attr('class', 'brush')
        .call(brush);

      // Style the brush
      brushGroup.selectAll('.selection')
        .style('fill', colors.brush)
        .style('stroke', colors.brushHandle)
        .style('stroke-width', 1.5);

      brushGroup.selectAll('.handle')
        .style('fill', colors.brushHandle);

      // Add double-click to reset
      brushGroup.on('dblclick', function () {
        // Reset the brush
        brushGroup.call(brush.move, null);
        // Reset the main chart domain to original
        x.domain(x2.domain());
        updateChart();
        // Clear stored brush selection
        brushSelectionRef.current = null;
      });

      // Apply stored brush selection if it exists
      if (brushSelectionRef.current) {
        // Validate that the selection is within bounds
        const [start, end] = brushSelectionRef.current;
        if (start >= 0 && end <= width && start < end) {
          brushGroup.call(brush.move, brushSelectionRef.current);
        }
      }


      // Add instruction text
      g.append('text')
        .attr('x', width / 2)
        .attr('y', -5)
        .style('text-anchor', 'middle')
        .style('font-size', isMobile ? '10px' : '12px')
        .style('fill', colors.text)
        .style('opacity', 0.6)
        .text('Use the timeline below to zoom and navigate');

      function brushed(event: d3.D3BrushEvent<unknown>) {
        if (event.sourceEvent && event.sourceEvent.type === 'zoom') return;
        const s = event.selection || x2.range();
        const sArray = Array.isArray(s) ? s as [number, number] : x2.range() as [number, number];
        x.domain([x2.invert(sArray[0]), x2.invert(sArray[1])]);
        updateChart();

        // Store brush selection (pixel positions)
        if (event.selection) {
          brushSelectionRef.current = sArray;
        } else {
          brushSelectionRef.current = null;
        }
      }

      function updateChart() {
        if (chartType === 'bar') {
          // Update bar positions with dynamic width
          const visibleDomain = x.domain();
          const visibleData = data.filter(d => d.date >= visibleDomain[0] && d.date <= visibleDomain[1]);
          const barGroupWidth = Math.min(width / Math.max(visibleData.length, 1) * 0.8, 80); // Cap max width at 80px

          if (settings.separateMessagesBySender && allSenders.length > 0) {
            // Update side-by-side bars
            const barWidth = barGroupWidth / allSenders.length;
            allSenders.forEach((_, index) => {
              focus.selectAll(`.bar-${index}`)
                .attr('x', (d: unknown) => x((d as DataPoint).date) - barGroupWidth / 2 + index * barWidth)
                .attr('width', barWidth * 0.9);
            });
          } else {
            // Update simple bars
            focus.selectAll('.bar')
              .attr('x', (d: unknown) => x((d as DataPoint).date) - barGroupWidth / 2)
              .attr('width', barGroupWidth);
          }
        } else {
          // Update line chart
          if (settings.separateMessagesBySender && allSenders.length > 0) {
            // Update sender lines and dots
            allSenders.forEach((sender, index) => {
              const senderLine = d3.line<typeof data[0]>()
                .x(d => x(d.date))
                .y(d => y((d[sender] as number) || 0))
                .curve(d3.curveMonotoneX);

              if (senderPaths[index]) {
                senderPaths[index].datum(data).attr('d', senderLine);
              }

              if (senderDots[index]) {
                senderDots[index]
                  .attr('cx', d => x(d.date))
                  .attr('cy', d => y((d[sender] as number) || 0));
              }
            });
          } else {
            // Update single line/area
            if (areaPath) {
              areaPath.datum(data).attr('d', area);
            }
            if (linePath) {
              linePath.datum(data).attr('d', line);
            }
            if (dots) {
              dots
                .attr('cx', d => x(d.date))
                .attr('cy', d => y(d.count));
            }
          }
        }

        // Update axes
        xAxis.call(d3.axisBottom(x)
          .tickFormat(d => format(d as Date, 'MMM d'))
          .ticks(d3.timeWeek.every(1))
        );

        xAxis.selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-.8em')
          .attr('dy', '.15em')
          .attr('transform', 'rotate(-45)')
          .style('fill', colors.axis);
      }

      // Cleanup on unmount
      return () => {
        d3.selectAll('.tooltip').remove();
      };
    },
    [data, theme, settings.separateMessagesBySender, analytics.timePatterns.dailyActivity, chartType]
  );

  const totalMessages = data.reduce((sum, d) => sum + d.count, 0);
  const avgPerDay = Math.round(totalMessages / data.length);

  return (
    <GlassContainer>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
          Message Activity Timeline
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Daily message count over time • Average: <span className="font-semibold text-primary-600 dark:text-primary-400">{avgPerDay}</span> messages/day
        </p>
      </div>

      {/* Chart controls */}
      <ChartControls
        separateBySender={settings.separateMessagesBySender}
        onSeparateBySenderChange={(checked) => updateChartSettings({ separateMessagesBySender: checked })}
      >
        {/* Chart type toggle */}
        <div className="inline-flex bg-white dark:bg-gray-900 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700" role="group">
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2
              ${chartType === 'line'
                ? 'bg-primary-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />
            </svg>
            Line
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`
              px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2
              ${chartType === 'bar'
                ? 'bg-primary-500 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Bar
          </button>
        </div>
      </ChartControls>

      <div className="overflow-x-auto custom-scrollbar pb-2">
        <svg ref={ref} />
      </div>
    </GlassContainer>
  );
};
