import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedAnalytics } from '../../types';
import { useD3 } from '../../hooks/useD3';
import { useUIStore, ChartSettings } from '../../stores/uiStore';
import { aggregateHourlyActivity } from '../../utils/analyzer';
import { getSenderColor, getChartColors } from '../../utils/chartUtils';

interface RadialActivityClockProps {
  analytics: ProcessedAnalytics;
  settings: ChartSettings;
}

export const RadialActivityClock: React.FC<RadialActivityClockProps> = ({ analytics, settings }) => {
  const { theme } = useUIStore();

  // Transform hourly activity data for D3
  const data = useMemo(() => {
    const hourlyBySender = analytics.timePatterns.hourlyActivity;
    const allSenders = Object.keys(hourlyBySender).sort();
    
    if (settings.separateMessagesBySender) {
      // Create data with separate series for each sender
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const result: { hour: number; count: number; label: string; [key: string]: number | string } = {
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

  const ref = useD3(
    (svg) => {
      // Get the container width from the SVG parent
      const containerElement = svg.node()?.parentElement;
      const availableWidth = containerElement?.clientWidth || 300;
      const isMobile = availableWidth < 640;
      
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

        // Set dimensions
        svg
          .attr('width', containerWidth)
          .attr('height', containerHeight)
          .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
          .attr('class', 'w-full h-auto');

        // Add title
        svg.append('text')
          .attr('x', containerWidth / 2)
          .attr('y', 20)
          .style('text-anchor', 'middle')
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .style('fill', colors.text)
          .text('24-Hour Activity Pattern');

        const g = svg.append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Scales for bar chart
        const xScale = d3.scaleLinear()
          .domain([0, d3.max(data, d => d.normalizedCount) || 1])
          .range([0, chartWidth]);

        const yScale = d3.scaleBand()
          .domain(data.map(d => d.hour.toString()))
          .range([0, chartHeight])
          .padding(0.1);

        // Color scale for activity intensity
        const colorScale = d3.scaleSequential()
          .domain([0, 1])
          .interpolator(d3.interpolateRgb(colors.low, colors.high));

        // Create tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'mobile-activity-tooltip')
          .style('opacity', 0)
          .style('position', 'absolute')
          .style('background', colors.background)
          .style('border', `1px solid ${colors.grid}`)
          .style('border-radius', '6px')
          .style('padding', '8px 10px')
          .style('font-size', '12px')
          .style('color', colors.text)
          .style('pointer-events', 'none')
          .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
          .style('z-index', '1000');

        // Create bars
        if (settings.separateMessagesBySender && allSenders.length > 0) {
          // Stacked horizontal bars
          data.forEach((hourData) => {
            const barGroup = g.append('g')
              .attr('class', 'hour-bar-group')
              .attr('transform', `translate(0, ${yScale(hourData.hour.toString())})`);

            let currentX = 0;
            const totalWidth = xScale(hourData.normalizedCount);

            allSenders.forEach((sender, senderIndex) => {
              const senderCount = (hourData[sender] as number) || 0;
              if (senderCount === 0) return;

              const senderColor = getSenderColor(senderIndex, theme);
              const senderWidth = (senderCount / hourData.count) * totalWidth;

              barGroup.append('rect')
                .attr('x', currentX)
                .attr('y', 0)
                .attr('width', senderWidth)
                .attr('height', yScale.bandwidth())
                .attr('fill', senderColor)
                .attr('stroke', colors.background)
                .attr('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event) {
                  d3.select(this).attr('opacity', 0.8);
                  tooltip.transition().duration(200).style('opacity', 1);
                  tooltip.html(`
                    <div style="font-weight: bold;">${hourData.label}</div>
                    <div style="color: ${senderColor}">${sender}: ${senderCount} messages</div>
                    <div>Total: ${hourData.count} messages</div>
                  `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout', function() {
                  d3.select(this).attr('opacity', 1);
                  tooltip.transition().duration(300).style('opacity', 0);
                });

              currentX += senderWidth;
            });
          });
        } else {
          // Simple horizontal bars
          g.selectAll('.hour-bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'hour-bar')
            .attr('x', 0)
            .attr('y', d => yScale(d.hour.toString()) || 0)
            .attr('width', d => xScale(d.normalizedCount))
            .attr('height', yScale.bandwidth())
            .attr('fill', d => colorScale(d.normalizedCount))
            .attr('stroke', colors.background)
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
              d3.select(this).attr('opacity', 0.8);
              tooltip.transition().duration(200).style('opacity', 1);
              tooltip.html(`
                <div style="font-weight: bold;">${d.label}</div>
                <div>${d.count} messages</div>
                <div style="opacity: 0.7;">${Math.round(d.normalizedCount * 100)}% of peak</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
              d3.select(this).attr('opacity', 1);
              tooltip.transition().duration(300).style('opacity', 0);
            });
        }

        // Y-axis with hour labels
        const yAxis = d3.axisLeft(yScale)
          .tickFormat(d => {
            const hour = parseInt(d);
            return hour === 0 ? '12 AM' :
                   hour < 12 ? `${hour} AM` :
                   hour === 12 ? '12 PM' :
                   `${hour - 12} PM`;
          });

        g.append('g')
          .attr('class', 'y-axis')
          .call(yAxis)
          .selectAll('text')
          .style('fill', colors.axis)
          .style('font-size', '11px');

        // Style axis
        g.select('.y-axis')
          .selectAll('.domain, .tick line')
          .style('stroke', colors.grid)
          .style('opacity', 0.3);

        // Cleanup function
        return () => {
          d3.selectAll('.mobile-activity-tooltip').remove();
        };

      } else {
        // Desktop: Circular clock design
        const containerWidth = Math.min(availableWidth, 400);
        const containerHeight = 280;
        const clockSize = Math.min(containerWidth * 0.7, 220);
        const clockRadius = clockSize / 2;
        const innerRadius = clockRadius * 0.3;
        const outerRadius = clockRadius * 0.9;

        // Set dimensions
        svg
          .attr('width', containerWidth)
          .attr('height', containerHeight)
          .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
          .attr('class', 'w-full h-auto');

        // Clock center position
        const clockCenterX = containerWidth / 2;
        const clockCenterY = containerHeight / 2 + 10;

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
          .style('border-radius', '6px')
          .style('padding', '8px 10px')
          .style('font-size', '12px')
          .style('color', colors.text)
          .style('pointer-events', 'none')
          .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
          .style('z-index', '1000');

        if (settings.separateMessagesBySender && allSenders.length > 0) {
          // Draw stacked segments for each sender
          data.forEach((hourData) => {
            if (hourData.count === 0) return;
            
            let currentRadius = innerRadius;
            const totalRadius = radiusScale(hourData.normalizedCount);
            const radiusStep = (totalRadius - innerRadius) / hourData.count;
            
            allSenders.forEach((sender, senderIndex) => {
              const senderCount = (hourData[sender] as number) || 0;
              if (senderCount === 0) return;
              
              const senderColor = getSenderColor(senderIndex, theme);
              const segmentRadius = radiusStep * senderCount;
              
              const senderArc = d3.arc<SVGPathElement, HourData>()
                .innerRadius(currentRadius)
                .outerRadius(currentRadius + segmentRadius)
                .startAngle(angleScale(hourData.hour) - angleScale(0.5))
                .endAngle(angleScale(hourData.hour) + angleScale(0.5));
              
              g.append('path')
                .datum(hourData)
                .attr('class', `hour-segment sender-${senderIndex}`)
                .attr('d', senderArc)
                .attr('fill', senderColor)
                .attr('stroke', colors.background)
                .attr('stroke-width', 0.5)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                  d3.select(this).transition().duration(150).attr('opacity', 0.8);
                  tooltip.transition().duration(150).style('opacity', 1);
                  tooltip.html(`
                    <div style="font-weight: bold;">${d.label}</div>
                    <div style="color: ${senderColor}">${sender}: ${senderCount} messages</div>
                    <div>Total: ${d.count} messages</div>
                  `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout', function() {
                  d3.select(this).transition().duration(150).attr('opacity', 1);
                  tooltip.transition().duration(300).style('opacity', 0);
                });
              
              currentRadius += segmentRadius;
            });
          });
        } else {
          // Simple circular segments
          g.selectAll('.hour-segment')
            .data(data)
            .enter()
            .append('path')
            .attr('class', 'hour-segment')
            .attr('d', arc)
            .attr('fill', d => colorScale(d.normalizedCount))
            .attr('stroke', colors.background)
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
              d3.select(this).transition().duration(150).attr('opacity', 0.8);
              tooltip.transition().duration(150).style('opacity', 1);
              tooltip.html(`
                <div style="font-weight: bold;">${d.label}</div>
                <div>${d.count} messages</div>
                <div style="opacity: 0.7;">${Math.round(d.normalizedCount * 100)}% of peak</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
              d3.select(this).transition().duration(150).attr('opacity', 1);
              tooltip.transition().duration(300).style('opacity', 0);
            });
        }

        // Hour labels at key positions
        const keyHours = [0, 6, 12, 18];
        const labelRadius = outerRadius + 20;

        g.selectAll('.hour-label')
          .data(keyHours)
          .enter()
          .append('text')
          .attr('class', 'hour-label')
          .attr('x', d => Math.sin(angleScale(d)) * labelRadius)
          .attr('y', d => -Math.cos(angleScale(d)) * labelRadius)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('fill', colors.text)
          .style('font-size', '11px')
          .style('font-weight', '600')
          .text(d => d === 0 ? '12AM' : d === 6 ? '6AM' : d === 12 ? '12PM' : '6PM');

        // Center text with stats
        const totalMessages = data.reduce((sum, d) => sum + d.count, 0);
        const peakHour = data.reduce((peak, current) => current.count > peak.count ? current : peak);

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -8)
          .style('fill', colors.text)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text(totalMessages.toLocaleString());

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 4)
          .style('fill', colors.axis)
          .style('font-size', '10px')
          .text('messages');

        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', 18)
          .style('fill', colors.axis)
          .style('font-size', '9px')
          .text(`Peak: ${peakHour.label}`);

        // Cleanup function
        return () => {
          d3.selectAll('.radial-tooltip').remove();
        };
      }
    },
    [data, theme, settings.separateMessagesBySender, analytics.timePatterns.hourlyActivity]
  );

  const peakHour = data.reduce((peak, current) =>
    current.count > peak.count ? current : peak
  );

  const quietHour = data.reduce((quiet, current) =>
    current.count < quiet.count ? current : quiet
  );

  return (
    <div className="w-full">
      {/* Chart container - always visible, responsive design handled inside SVG */}
      <div className="flex items-center justify-between">
        <div className="flex-1 flex justify-center">
          <svg ref={ref} className="w-full h-auto" />
        </div>

        {/* Desktop Legend - only show on larger screens */}
        <div className="hidden sm:flex ml-6 flex-col space-y-3 flex-shrink-0">
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">Low Activity</span>
          </div>
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">High Activity</span>
          </div>
          
          {/* Desktop stats */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <div className="font-medium">Peak: {peakHour.label}</div>
              <div className="text-gray-500 dark:text-gray-500">{peakHour.count} messages</div>
              <div className="font-medium mt-2">Quiet: {quietHour.label}</div>
              <div className="text-gray-500 dark:text-gray-500">{quietHour.count} messages</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile legend and stats - only show on small screens */}
      <div className="block sm:hidden mt-4 px-2 space-y-3">
        {/* Legend */}
        <div className="flex items-center justify-center space-x-6">
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-900' : 'bg-blue-100'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">Low</span>
          </div>
          <div className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-sm mr-2 ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'}`}></div>
            <span className="text-gray-600 dark:text-gray-400">High</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-center">
            <div className="font-medium">Peak Activity</div>
            <div className="text-gray-500 dark:text-gray-500">{peakHour.label} ({peakHour.count})</div>
          </div>
          <div className="text-center">
            <div className="font-medium">Quiet Time</div>
            <div className="text-gray-500 dark:text-gray-500">{quietHour.label} ({quietHour.count})</div>
          </div>
        </div>
      </div>
    </div>
  );
};