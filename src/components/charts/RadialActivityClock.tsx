import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { useUIStore } from '../../stores/uiStore';

interface RadialActivityClockProps {
  analytics: ProcessedAnalytics;
}

export const RadialActivityClock: React.FC<RadialActivityClockProps> = ({ analytics }) => {
  const { theme } = useUIStore();

  // Transform hourly activity data for D3
  const data = useMemo(() => {
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: analytics.timePatterns.hourlyActivity[hour] || 0,
      label: hour === 0 ? '12 AM' :
             hour < 12 ? `${hour} AM` :
             hour === 12 ? '12 PM' :
             `${hour - 12} PM`
    }));

    const maxCount = Math.max(...hourlyData.map(d => d.count));
    return hourlyData.map(d => ({
      ...d,
      normalizedCount: maxCount > 0 ? d.count / maxCount : 0
    }));
  }, [analytics.timePatterns.hourlyActivity]);

  const ref = useD3(
    (svg) => {
      const containerWidth = 280;
      const containerHeight = 160;
      const clockSize = 150;
      const clockRadius = clockSize / 2;
      const innerRadius = clockRadius * 0.4;
      const outerRadius = clockRadius * 0.85;

      // Color scheme based on theme
      const colors = {
        low: theme === 'dark' ? '#1e3a8a' : '#dbeafe',
        high: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
        text: theme === 'dark' ? '#f3f4f6' : '#111827',
        axis: theme === 'dark' ? '#9ca3af' : '#6b7280',
        background: theme === 'dark' ? '#1f2937' : '#ffffff',
        grid: theme === 'dark' ? '#374151' : '#e5e7eb',
      };

      // Clear previous content
      svg.selectAll('*').remove();

      // Set dimensions
      svg
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
        .attr('class', 'w-full h-auto');

      // Clock center position - shift up to use title space
      const clockCenterX = containerWidth / 2;
      const clockCenterY = containerHeight / 2;

      const g = svg.append('g')
        .attr('transform', `translate(${clockCenterX}, ${clockCenterY})`);

      // Color scale for activity intensity
      const colorScale = d3.scaleSequential()
        .domain([0, 1])
        .interpolator(d3.interpolateRgb(colors.low, colors.high));

      // Angle scale for hours (starting from top, clockwise)
      const angleScale = d3.scaleLinear()
        .domain([0, 24])
        .range([0, 2 * Math.PI]);

      // Radius scale for activity level
      const radiusScale = d3.scaleLinear()
        .domain([0, 1])
        .range([innerRadius, outerRadius]);

      // Create circular grid lines
      const gridLevels = [0.25, 0.5, 0.75, 1];
      g.selectAll('.grid-circle')
        .data(gridLevels)
        .enter()
        .append('circle')
        .attr('class', 'grid-circle')
        .attr('r', d => radiusScale(d))
        .attr('fill', 'none')
        .attr('stroke', colors.grid)
        .attr('stroke-width', 0.5)
        .attr('opacity', 0.3);

      // Create hour segments
      type HourData = typeof data[0];
      const arc = d3.arc<SVGPathElement, HourData>()
        .innerRadius(innerRadius)
        .outerRadius(d => radiusScale(d.normalizedCount))
        .startAngle(d => angleScale(d.hour) - angleScale(0.5))
        .endAngle(d => angleScale(d.hour) + angleScale(0.5));

      // Tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'radial-tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', colors.background)
        .style('border', `1px solid ${colors.grid}`)
        .style('border-radius', '4px')
        .style('padding', '6px 8px')
        .style('font-size', '11px')
        .style('color', colors.text)
        .style('pointer-events', 'none')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
        .style('z-index', '1000');

      // Draw segments
      g.selectAll('.hour-segment')
        .data(data)
        .enter()
        .append('path')
        .attr('class', 'hour-segment')
        .attr('d', arc)
        .attr('fill', d => colorScale(d.normalizedCount))
        .attr('stroke', colors.background)
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 0.8)
            .attr('stroke-width', 2);

          tooltip.transition()
            .duration(150)
            .style('opacity', 1);
          tooltip.html(`
            <div style="font-weight: bold;">${d.label}</div>
            <div>${d.count} messages</div>
            <div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">
              ${Math.round(d.normalizedCount * 100)}% of peak activity
            </div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this)
            .transition()
            .duration(150)
            .attr('opacity', 1)
            .attr('stroke-width', 1);

          tooltip.transition()
            .duration(300)
            .style('opacity', 0);
        });

      // Add hour labels at key positions only
      const keyHours = [0, 6, 12, 18];
      const labelRadius = outerRadius + 8;

      g.selectAll('.hour-label')
        .data(keyHours)
        .enter()
        .append('text')
        .attr('class', 'hour-label')
        .attr('x', d => labelRadius * 1.05*Math.sin(angleScale(d)))
        .attr('y', d => -labelRadius * 1.05*Math.cos(angleScale(d)))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('fill', colors.text)
        .style('font-size', '9px')
        .style('font-weight', '500')
        .text(d => d === 0 ? '12AM' :
                   d === 6 ? '6AM' :
                   d === 12 ? '12PM' :
                   '6PM');

      // Add center text with total messages
      const totalMessages = data.reduce((sum, d) => sum + d.count, 0);
      const centerGroup = g.append('g').attr('class', 'center-text');

      centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -3)
        .style('fill', colors.text)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(totalMessages.toLocaleString());

      centerGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 8)
        .style('fill', colors.axis)
        .style('font-size', '8px')
        .text('messages');

      // Cleanup on unmount
      return () => {
        d3.selectAll('.radial-tooltip').remove();
      };
    },
    [data, theme]
  );

  const peakHour = data.reduce((peak, current) =>
    current.count > peak.count ? current : peak
  );

  const quietHour = data.reduce((quiet, current) =>
    current.count < quiet.count ? current : quiet
  );

  return (
    <div className="relative">
      {/* Title and stats overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          24-Hour Activity Clock
        </h3>
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div>Peak: {peakHour.label} ({peakHour.count} messages)</div>
          <div>Quietest: {quietHour.label} ({quietHour.count} messages)</div>
        </div>
      </div>

      {/* Chart with legend */}
      <div className="flex items-center justify-between">
        <div className="flex-1 flex justify-center">
          <svg ref={ref} />
        </div>

        {/* Compact legend */}
        <div className="ml-4 flex flex-col space-y-1">
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">Low</span>
          </div>
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">High</span>
          </div>
        </div>
      </div>
    </div>
  );
};
