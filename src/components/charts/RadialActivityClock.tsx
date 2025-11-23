import React, { useMemo, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics } from '../../types';
import { GlassContainer } from '../common/GlassContainer';
import { ChartControls } from '../common/ChartControls';
import { useD3 } from '../../hooks/useD3';
import { useUIStore, ChartSettings } from '../../stores/uiStore';
import { aggregateHourlyActivity } from '../../utils/analyzer';
import { getSenderColor, getChartColors } from '../../utils/chartUtils';

interface RadialActivityClockProps {
  analytics: ProcessedAnalytics;
  settings: ChartSettings;
}

export const RadialActivityClock: React.FC<RadialActivityClockProps> = ({ analytics, settings }) => {
  const { theme, updateChartSettings } = useUIStore();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Track window resize to force re-render
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Transform hourly activity data for D3
  const data = useMemo(() => {
    const hourlyBySender = analytics.timePatterns.hourlyActivity;
    const allSenders = Object.keys(hourlyBySender).sort();

    if (settings.separateMessagesBySender) {
      // Create data with separate series for each sender
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const result: { hour: number; count: number; label: string;[key: string]: number | string } = {
          hour,
          count: 0,
          label: hour === 0 ? '12 AM' :
            hour < 12 ? `${hour} AM` :
              hour === 12 ? '12 PM' :
                `${hour - 12} PM`
        };

        // Add count for each sender and calculate total
        allSenders.forEach(sender => {
          const senderCount = hourlyBySender[sender]?.[hour] || 0;
          result[sender] = senderCount;
          result.count += senderCount;
        });

        return result;
      });

      const maxCount = Math.max(...hourlyData.map(d => d.count));
      return hourlyData.map(d => ({
        ...d,
        normalizedCount: maxCount > 0 ? d.count / maxCount : 0,
        // Normalize each sender's count
        ...Object.fromEntries(allSenders.map(sender => [
          `${sender}_normalized`,
          maxCount > 0 ? ((d[sender] as number) || 0) / maxCount : 0
        ]))
      }));
    } else {
      // Aggregate all senders
      const aggregated = aggregateHourlyActivity(hourlyBySender);
      const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: aggregated[hour] || 0,
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
    }
  }, [analytics.timePatterns.hourlyActivity, settings.separateMessagesBySender]);

  // Calculate stats
  const stats = useMemo(() => {
    let maxCount = -1;
    let maxHour = 0;
    let minCount = Infinity;
    let minHour = 0;

    data.forEach(d => {
      if (d.count > maxCount) {
        maxCount = d.count;
        maxHour = d.hour;
      }
      if (d.count > 0 && d.count < minCount) {
        minCount = d.count;
        minHour = d.hour;
      }
    });

    if (minCount === Infinity) minCount = 0;

    const formatHour = (h: number) => {
      if (h === 0) return '12 AM';
      if (h === 12) return '12 PM';
      return h < 12 ? `${h} AM` : `${h - 12} PM`;
    };

    return {
      peak: { hour: formatHour(maxHour), count: maxCount },
      quiet: { hour: formatHour(minHour), count: minCount }
    };
  }, [data]);

  const ref = useD3(
    (svg) => {
      // Get the container width from the SVG parent
      const containerElement = svg.node()?.parentElement;
      const availableWidth = containerElement?.clientWidth || 800;

      // Use window width as primary check for mobile layout to avoid container constraints forcing mobile view
      // But also check availableWidth to be safe if it's really small
      const isMobile = window.innerWidth < 768 || availableWidth < 400;

      // Color scheme based on theme
      const colors = getChartColors(theme);

      // Get unique senders from analytics data
      const allSenders = settings.separateMessagesBySender
        ? Object.keys(analytics.timePatterns.hourlyActivity).sort()
        : [];

      // Clear previous content
      svg.selectAll('*').remove();

      if (isMobile) {
        // Mobile: Horizontal bar chart layout
        const margin = { top: 30, right: 20, bottom: 20, left: 50 };
        const containerWidth = Math.min(availableWidth - 10, 380);
        const containerHeight = 350;
        const chartWidth = containerWidth - margin.left - margin.right;
        const chartHeight = containerHeight - margin.top - margin.bottom;

        svg
          .attr('width', containerWidth)
          .attr('height', containerHeight)
          .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
          .style('overflow', 'visible');

        const g = svg.append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.count) || 0])
          .range([0, chartWidth]);

        const y = d3.scaleBand()
          .domain(data.map(d => d.label))
          .range([0, chartHeight])
          .padding(0.2);

        // Axes
        g.append('g')
          .call(d3.axisLeft(y).tickSize(0))
          .selectAll('text')
          .style('fill', colors.text)
          .style('font-size', '10px');

        g.select('.domain').remove();

        // Bars
        if (settings.separateMessagesBySender) {
          // Stacked bars for separate senders
          const stack = d3.stack()
            .keys(allSenders)
            .value((d: any, key) => d[key] || 0);

          const stackedData = stack(data as any);

          g.selectAll('.layer')
            .data(stackedData)
            .enter().append('g')
            .attr('class', 'layer')
            .attr('fill', (_, i) => getSenderColor(i, theme))
            .selectAll('rect')
            .data(d => d)
            .enter().append('rect')
            .attr('y', d => y(String(d.data.hour)) || 0)
            .attr('x', d => x(d[0]))
            .attr('width', d => x(d[1]) - x(d[0]))
            .attr('height', y.bandwidth())
            .attr('rx', 2);
        } else {
          // Single bars
          g.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('y', d => y(d.label) || 0)
            .attr('height', y.bandwidth())
            .attr('x', 0)
            .attr('width', d => x(d.count))
            .attr('fill', colors.area)
            .attr('rx', 2);
        }

      } else {
        // Desktop: Radial layout
        const containerWidth = Math.min(availableWidth, 500);
        const containerHeight = containerWidth;
        const margin = { top: 40, right: 40, bottom: 40, left: 40 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;
        const innerRadius = 60;
        const outerRadius = Math.min(width, height) / 2;

        svg
          .attr('width', containerWidth)
          .attr('height', containerHeight)
          .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
          .style('overflow', 'visible');

        const g = svg.append('g')
          .attr('transform', `translate(${containerWidth / 2},${containerHeight / 2})`);

        // Scales
        const angleScale = d3.scaleBand()
          .domain(d3.range(24).map(String))
          .range([0, 2 * Math.PI])
          .align(0);

        const radiusScale = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.count) || 0])
          .range([innerRadius, outerRadius]);

        // Draw circular grid lines
        const ticks = radiusScale.ticks(4).slice(1);
        g.selectAll('.grid-circle')
          .data(ticks)
          .enter().append('circle')
          .attr('class', 'grid-circle')
          .attr('r', d => radiusScale(d))
          .style('fill', 'none')
          .style('stroke', colors.grid)
          .style('stroke-dasharray', '3,3');

        // Draw radial lines (hours)
        g.selectAll('.grid-line')
          .data(d3.range(24))
          .enter().append('line')
          .attr('class', 'grid-line')
          .attr('x1', d => Math.sin(angleScale(String(d)) || 0) * innerRadius)
          .attr('y1', d => -Math.cos(angleScale(String(d)) || 0) * innerRadius)
          .attr('x2', d => Math.sin(angleScale(String(d)) || 0) * outerRadius)
          .attr('y2', d => -Math.cos(angleScale(String(d)) || 0) * outerRadius)
          .style('stroke', colors.grid)
          .style('stroke-width', 1)
          .style('opacity', 0.3);

        // Draw data
        if (settings.separateMessagesBySender) {
          // Stacked radial bars
          const stack = d3.stack()
            .keys(allSenders)
            .value((d: any, key) => d[key] || 0);

          const stackedData = stack(data as any);

          const arc = d3.arc<any>()
            .innerRadius(d => radiusScale(d[0]))
            .outerRadius(d => radiusScale(d[1]))
            .startAngle(d => (angleScale(String(d.data.hour)) || 0))
            .endAngle(d => (angleScale(String(d.data.hour)) || 0) + angleScale.bandwidth())
            .padAngle(0.01)
            .padRadius(innerRadius);

          g.selectAll('.layer')
            .data(stackedData)
            .enter().append('g')
            .attr('class', 'layer')
            .attr('fill', (_, i) => getSenderColor(i, theme))
            .selectAll('path')
            .data(d => d)
            .enter().append('path')
            .attr('d', arc)
            .style('opacity', 0.9);

        } else {
          // Simple radial bars
          const arc = d3.arc<any>()
            .innerRadius(innerRadius)
            .outerRadius(d => radiusScale(d.count))
            .startAngle(d => (angleScale(String(d.hour)) || 0))
            .endAngle(d => (angleScale(String(d.hour)) || 0) + angleScale.bandwidth())
            .padAngle(0.01)
            .padRadius(innerRadius);

          g.selectAll('.bar')
            .data(data)
            .enter().append('path')
            .attr('class', 'bar')
            .attr('d', arc)
            .attr('fill', colors.area)
            .attr('fill-opacity', 0.8)
            .attr('stroke', colors.line)
            .attr('stroke-width', 1);
        }

        // Tooltip interaction overlay
        // Create invisible segments for hover detection
        const tooltipId = `radial-tooltip-${Math.random().toString(36).substr(2, 9)}`;
        const tooltip = d3.select('body').append('div')
          .attr('id', tooltipId)
          .attr('class', 'radial-tooltip')
          .style('position', 'absolute')
          .style('visibility', 'hidden')
          .style('background', theme === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)')
          .style('color', theme === 'dark' ? '#fff' : '#000')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '9999')
          .style('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)')
          .style('border', `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`)
          .style('backdrop-filter', 'blur(4px)');

        const arcGenerator = d3.arc<any>()
          .innerRadius(innerRadius)
          .outerRadius(outerRadius)
          .startAngle(d => (angleScale(String(d.hour)) || 0))
          .endAngle(d => (angleScale(String(d.hour)) || 0) + angleScale.bandwidth());

        g.selectAll('.hover-segment')
          .data(data)
          .enter().append('path')
          .attr('class', 'hover-segment')
          .attr('d', arcGenerator)
          .attr('fill', 'transparent')
          .on('mouseover', function () {
            d3.select(this).attr('fill', 'rgba(255,255,255,0.1)');
            tooltip.style('visibility', 'visible');
          })
          .on('mousemove', function (event, d) {
            let content = `<strong>${d.label}</strong><br/>${d.count} messages`;

            if (settings.separateMessagesBySender) {
              content += '<br/><br/>';
              allSenders.forEach(sender => {
                const count = d[sender] as number || 0;
                if (count > 0) {
                  content += `${sender}: ${count}<br/>`;
                }
              });
            }

            tooltip.html(content)
              .style('top', (event.pageY - 10) + 'px')
              .style('left', (event.pageX + 10) + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).attr('fill', 'transparent');
            tooltip.style('visibility', 'hidden');
          });

        // Add hour labels
        g.selectAll('.label')
          .data(d3.range(24))
          .enter().append('text')
          .attr('class', 'label')
          .attr('x', d => {
            const angle = (angleScale(String(d)) || 0) + angleScale.bandwidth() / 2 - Math.PI / 2;
            return Math.cos(angle) * (outerRadius + 20);
          })
          .attr('y', d => {
            const angle = (angleScale(String(d)) || 0) + angleScale.bandwidth() / 2 - Math.PI / 2;
            return Math.sin(angle) * (outerRadius + 20);
          })
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('fill', colors.text)
          .text(d => d === 0 ? '12A' : d === 12 ? '12P' : d % 6 === 0 ? (d > 12 ? d - 12 : d) : '');

        // Cleanup function
        return () => {
          d3.select(`#${tooltipId}`).remove();
        };
      }
    },
    [data, theme, settings.separateMessagesBySender, windowWidth] // Add windowWidth to dependencies
  );

  return (
    <GlassContainer className="flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Activity Clock</h3>
        <ChartControls
          separateBySender={settings.separateMessagesBySender}
          onSeparateBySenderChange={(checked) => updateChartSettings({ separateMessagesBySender: checked })}
        />
      </div>

      <div className="w-full flex justify-center overflow-hidden relative">
        <svg ref={ref} className="w-full h-auto max-w-[500px]" />

        {/* Desktop Stats Overlay - Only show on larger screens when not mobile layout */}
        <div className="hidden md:flex absolute top-0 left-0 w-full h-full pointer-events-none justify-between items-start px-4 py-8">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Peak Activity</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.peak.hour}</div>
            <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">{stats.peak.count.toLocaleString()} messages</div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Quiet Time</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.quiet.hour}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{stats.quiet.count.toLocaleString()} messages</div>
          </div>
        </div>
      </div>

      {/* Mobile Stats - Show below chart on mobile */}
      <div className="md:hidden w-full grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-white/10 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Peak</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.peak.hour}</div>
          <div className="text-xs text-primary-600 dark:text-primary-400">{stats.peak.count.toLocaleString()} msgs</div>
        </div>
        <div className="bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl border border-white/10 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Quiet</div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.quiet.hour}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{stats.quiet.count.toLocaleString()} msgs</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {settings.separateMessagesBySender ? (
          Object.keys(analytics.timePatterns.hourlyActivity).sort().map((sender, i) => (
            <div key={sender} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getSenderColor(i, theme) }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">{sender}</span>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Radial view shows activity volume by hour of day
          </div>
        )}
      </div>
    </GlassContainer>
  );
};