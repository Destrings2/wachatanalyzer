import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { format } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';

interface ActivityTimelineProps {
  analytics: ProcessedAnalytics;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ analytics }) => {
  const { theme } = useUIStore();

  // Transform daily activity data for D3
  const data = useMemo(() => {
    return Object.entries(analytics.timePatterns.dailyActivity).map(([date, count]) => ({
      date: new Date(date),
      count,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [analytics.timePatterns.dailyActivity]);

  const ref = useD3(
    (svg) => {
      const margin = { top: 20, right: 30, bottom: 80, left: 60 };
      const width = 1000 - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;
      const contextHeight = 50;
      const contextMargin = { top: height + margin.top + 40, bottom: 0 };

      // Color scheme based on theme
      const colors = {
        line: theme === 'dark' ? '#60a5fa' : '#3b82f6',
        area: theme === 'dark' ? '#60a5fa' : '#3b82f6',
        axis: theme === 'dark' ? '#9ca3af' : '#6b7280',
        grid: theme === 'dark' ? '#374151' : '#e5e7eb',
        text: theme === 'dark' ? '#f3f4f6' : '#111827',
        brush: theme === 'dark' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.2)',
        brushHandle: theme === 'dark' ? '#60a5fa' : '#3b82f6',
      };

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

      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) as number])
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

      // Add the area with clipping
      const areaPath = focus.append('path')
        .datum(data)
        .attr('fill', colors.area)
        .attr('fill-opacity', 0.1)
        .attr('d', area)
        .attr('clip-path', 'url(#clip)');

      // Add the line with clipping
      const linePath = focus.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', colors.line)
        .attr('stroke-width', 2)
        .attr('d', line)
        .attr('clip-path', 'url(#clip)');

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

      // Interactive dots
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

      // Interactive dots with clipping
      const dots = focus.selectAll('.dot')
        .data(data)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.count))
        .attr('r', 4)
        .attr('fill', colors.line)
        .attr('clip-path', 'url(#clip)')
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this).transition().duration(100).attr('r', 6);
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`
            <div style="font-weight: bold">${format(d.date, 'MMM d, yyyy')}</div>
            <div style="margin-top: 4px">${d.count} messages</div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).transition().duration(100).attr('r', 4);
          tooltip.transition().duration(500).style('opacity', 0);
        });

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
      brushGroup.on('dblclick', function() {
        // Reset the brush
        brushGroup.call(brush.move, null);
        // Reset the main chart domain to original
        x.domain(x2.domain());
        updateChart();
      });

      // Add instruction text
      g.append('text')
        .attr('x', width / 2)
        .attr('y', -5)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', colors.text)
        .style('opacity', 0.6)
        .text('Use the timeline below to zoom in');

      function brushed(event: d3.D3BrushEvent<unknown>) {
        if (event.sourceEvent && event.sourceEvent.type === 'zoom') return;
        const s = event.selection || x2.range();
        const sArray = Array.isArray(s) ? s as [number, number] : x2.range() as [number, number];
        x.domain([x2.invert(sArray[0]), x2.invert(sArray[1])]);
        updateChart();
      }

      function updateChart() {
        // Update area and line
        areaPath.attr('d', area);
        linePath.attr('d', line);

        // Update dots
        dots
          .attr('cx', d => x(d.date))
          .attr('cy', d => y(d.count));

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
    [data, theme]
  );

  const totalMessages = Object.values(analytics.timePatterns.dailyActivity).reduce((sum, count) => sum + count, 0);
  const avgPerDay = Math.round(totalMessages / data.length);

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Message Activity Timeline
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Daily message count over time • Average: {avgPerDay} messages/day
        </p>
      </div>
      <div className="overflow-x-auto">
        <svg ref={ref} />
      </div>
    </div>
  );
};
