import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import * as d3 from 'd3';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { TrendingUp, TrendingDown, Minus, Users, Heart, X } from 'lucide-react';
import { GlassContainer } from '../common/GlassContainer';
import { MetricCard } from './ResponsePatterns'; // We should probably move MetricCard to common if used here too
// Actually, let's duplicate MetricCard locally or move it to common. 
// The user instruction was to extract reusable components. 
// I'll assume I should have moved MetricCard to common. 
// For now, I will define it locally or use InsightCard if appropriate, 
// but MetricCard has specific styling. 
// Let's use the shared InsightCard for the container style but keep the content specific?
// No, MetricCard is distinct. I'll define it locally to be safe and consistent with the previous file, 
// or better yet, I'll create a common MetricCard in the next step if I see it's needed.
// For this file, I'll define it locally to match the style exactly.

interface EmojiAnalysisProps {
  analytics: ProcessedAnalytics;
  messages?: Message[];
}

interface EmojiCategory {
  name: string;
  emojis: string[];
  count: number;
  color: string;
}

const EMOJI_CATEGORIES = {
  emotions: {
    name: 'Emotions',
    regex: /[\u{1F600}-\u{1F64F}]/gu,
    color: '#FFD93D',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
  },
  hearts: {
    name: 'Hearts & Love',
    regex: /[\u{2764}\u{1F493}-\u{1F49F}\u{1F5A4}]/gu,
    color: '#FF6B6B',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  gestures: {
    name: 'Gestures',
    regex: /[\u{1F44D}-\u{1F44F}\u{1F595}\u{1F64C}-\u{1F64F}\u{1F90F}\u{1F918}-\u{1F91F}]/gu,
    color: '#4ECDC4',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤙', '💪', '🖕', '✍️', '🙏', '🤝', '👏', '🙌', '🤲', '🤗', '🤜', '🤛']
  },
  activities: {
    name: 'Activities',
    regex: /[\u{1F3C0}-\u{1F3FF}\u{26BD}\u{26BE}\u{1F94A}-\u{1F94F}]/gu,
    color: '#95E1D3',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🏐', '🏉', '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸', '🎣', '🤿', '🎿', '🛷', '🥌']
  },
  objects: {
    name: 'Objects',
    regex: /[\u{1F4A1}-\u{1F4FF}\u{1F680}-\u{1F6FF}]/gu,
    color: '#A8E6CF',
    emojis: ['💰', '💳', '💎', '⚖️', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '⛓', '🔫', '💣', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '💈', '⚗️', '🔭', '🔬', '🕳', '💊', '💉', '🌡', '🚽', '🚰', '🚿', '🛁', '🛀', '🛎', '🔑', '🗝', '🚪', '🛋', '🛏', '🛌', '🖼', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '📊', '📈', '📉', '🗒', '🗓', '📆', '📅', '📇', '🗃', '🗳', '🗄', '📋', '📁', '📂', '🗂', '🗞', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🔗', '📎', '🖇', '📐', '📏', '📌', '📍', '✂️', '🖊', '🖋', '✒️', '🖌', '🖍', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
  }
};

// Sentiment mapping for emojis
const EMOJI_SENTIMENT: Record<string, number> = {
  // Positive (1.0 to 0.5)
  '😀': 0.9, '😃': 0.9, '😄': 1.0, '😁': 0.9, '😆': 1.0, '😂': 1.0, '🤣': 1.0,
  '😊': 0.8, '😇': 0.9, '🙂': 0.6, '😉': 0.7, '😍': 1.0, '🥰': 1.0, '😘': 0.9,
  '❤️': 1.0, '💕': 1.0, '💖': 1.0, '👍': 0.8, '👏': 0.8, '🎉': 0.9, '🎊': 0.9,
  '✨': 0.8, '💪': 0.7, '🙏': 0.7, '🤝': 0.7, '💯': 0.9, '🔥': 0.8, '⭐': 0.8,

  // Neutral (0.5 to -0.5)
  '😐': 0.0, '😑': 0.0, '😶': 0.0, '🤔': 0.0, '🤷': 0.0, '🙄': -0.2,

  // Negative (-0.5 to -1.0)
  '😢': -0.7, '😭': -0.9, '😔': -0.6, '😞': -0.6, '😟': -0.5, '🙁': -0.5,
  '😣': -0.6, '😖': -0.7, '😫': -0.8, '😩': -0.7, '😤': -0.6, '😠': -0.8,
  '😡': -0.9, '🤬': -1.0, '💔': -0.9, '👎': -0.7, '😱': -0.7, '😨': -0.6,
};

// Tooltip component (Local definition to avoid circular dependency if I don't move it)
const Tooltip: React.FC<{ content: string; children: React.ReactNode; className?: string }> = ({
  content,
  children,
  className = ''
}) => (
  <div className={`group relative inline-block ${className}`}>
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900/90 dark:bg-gray-700/90 backdrop-blur-md text-white text-sm rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-white/10 shadow-xl">
      {content}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/90 dark:border-t-gray-700/90"></div>
    </div>
  </div>
);

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

export const EmojiAnalysis: React.FC<EmojiAnalysisProps> = ({ analytics, messages = [] }) => {
  const { theme } = useTheme();
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'frequency' | 'timeline' | 'categories' | 'sentiment'>('frequency');

  const isDark = theme === 'dark';

  // Enhanced emoji analysis
  const enhancedEmojiData = useMemo(() => {
    // Category analysis
    const categories: EmojiCategory[] = Object.entries(EMOJI_CATEGORIES).map(([, category]) => ({
      name: category.name,
      color: category.color,
      emojis: [],
      count: 0
    }));

    // Helper function to normalize emojis for categorization
    const normalizeEmoji = (emoji: string): string => {
      // Remove skin tone modifiers but preserve the structure of ZWJ sequences
      let normalized = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');

      // Clean up any double ZWJ sequences that might result from modifier removal
      normalized = normalized.replace(/\u200D\u200D+/g, '\u200D');

      // Remove any trailing or leading ZWJ sequences
      normalized = normalized.replace(/^\u200D+|\u200D+$/g, '');

      // If we ended up with just modifier characters, gender symbols, or ZWJ, filter it out
      if (/^(\u200D|\u2640|\u2642|\uFE0F|\u20E3)+$/.test(normalized) || normalized.length === 0) {
        return emoji; // Return original if normalization breaks it
      }

      return normalized;
    };

    // Analyze emojis by category
    Object.entries(analytics.emojiAnalysis.emojiFrequency).forEach(([emoji, count]) => {
      const normalizedEmoji = normalizeEmoji(emoji);
      for (const category of categories) {
        const categoryData = EMOJI_CATEGORIES[category.name.toLowerCase().replace(/[^a-z]/g, '') as keyof typeof EMOJI_CATEGORIES];
        if (categoryData && categoryData.emojis.includes(normalizedEmoji)) {
          if (!category.emojis.includes(emoji)) {
            category.emojis.push(emoji);
          }
          category.count += count;
          break;
        }
      }
    });

    // Emoji combinations (emojis that appear together)
    const combinations = new Map<string, number>();
    messages.forEach(msg => {
      if (msg.metadata?.emojis && msg.metadata.emojis.length > 1) {
        const emojis = msg.metadata.emojis;
        for (let i = 0; i < emojis.length - 1; i++) {
          const combo = `${emojis[i]}${emojis[i + 1]}`;
          combinations.set(combo, (combinations.get(combo) || 0) + 1);
        }
      }
    });

    // Sentiment analysis
    let totalSentiment = 0;
    let sentimentCount = 0;
    const senderSentiment: Record<string, { total: number; count: number }> = {};

    messages.forEach(msg => {
      if (msg.metadata?.emojis) {
        msg.metadata.emojis.forEach(emoji => {
          const sentiment = EMOJI_SENTIMENT[emoji] || 0;
          totalSentiment += sentiment;
          sentimentCount++;

          if (!senderSentiment[msg.sender]) {
            senderSentiment[msg.sender] = { total: 0, count: 0 };
          }
          senderSentiment[msg.sender].total += sentiment;
          senderSentiment[msg.sender].count++;
        });
      }
    });

    const averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    const senderSentimentScores = Object.entries(senderSentiment).map(([sender, data]) => ({
      sender,
      score: data.count > 0 ? data.total / data.count : 0
    })).sort((a, b) => b.score - a.score);

    // Emoji timeline (hourly distribution)
    const hourlyEmojis: Record<number, number> = {};
    messages.forEach(msg => {
      if (msg.metadata?.hasEmoji) {
        const hour = new Date(msg.timestamp).getHours();
        hourlyEmojis[hour] = (hourlyEmojis[hour] || 0) + (msg.metadata.emojis?.length || 0);
      }
    });

    // Top emoji combinations
    const topCombinations = Array.from(combinations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([combo, count]) => ({ combo, count }));

    return {
      categories: categories.filter(c => c.count > 0),
      combinations: topCombinations,
      sentiment: {
        average: averageSentiment,
        bySender: senderSentimentScores
      },
      hourlyDistribution: hourlyEmojis
    };
  }, [analytics, messages]);

  // Render frequency chart
  const renderFrequencyChart = useD3((svg) => {
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = analytics.emojiAnalysis.topEmojis.slice(0, 20);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.emoji))
      .padding(0.2);

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d.count) || 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('font-size', '20px')
      .style('font-family', '"Not Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", Times, Symbola, Aegyptus, Code2000, Code2001, Code2002, Musica, serif, LastResort');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', isDark ? '#9CA3AF' : '#6B7280')
      .style('font-family', '"Plus Jakarta Sans", sans-serif')
      .text('Usage Count');

    // Style axis lines
    g.selectAll('.domain, .tick line')
      .attr('stroke', isDark ? '#374151' : '#E5E7EB');

    g.selectAll('.tick text')
      .attr('fill', isDark ? '#9CA3AF' : '#6B7280');

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.emoji) || 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', 'url(#emojiBarGradient)')
      .attr('rx', 4)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);

        // Tooltip
        const tooltipId = `emoji-tooltip-${Math.random().toString(36).substr(2, 9)}`;
        const tooltip = d3.select('body').append('div')
          .attr('id', tooltipId)
          .attr('class', 'emoji-tooltip')
          .style('position', 'absolute')
          .style('padding', '12px')
          .style('background', isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)')
          .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`)
          .style('border-radius', '12px')
          .style('backdrop-filter', 'blur(12px)')
          .style('box-shadow', '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('z-index', '1000')
          .style('font-family', '"Plus Jakarta Sans", sans-serif');

        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <div style="font-size: 32px; text-align: center; margin-bottom: 4px;">${d.emoji}</div>
          <div style="color: ${isDark ? '#D1D5DB' : '#4B5563'}; font-weight: 500;">Used ${d.count} times</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        d3.selectAll('.emoji-tooltip').remove();
      })
      .on('click', (_, d) => {
        setSelectedEmoji(d.emoji);
      })
      .transition()
      .duration(800)
      .attr('y', d => y(d.count))
      .attr('height', d => height - y(d.count));

    // Add gradient definition
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'emojiBarGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#F472B6'); // Pink

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#DB2777'); // Darker pink

  }, [analytics, isDark]);

  // Render category donut chart
  const renderCategoryChart = useD3((svg) => {
    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2 - 40;

    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<EmojiCategory>()
      .value(d => d.count)
      .padAngle(0.03);

    const arc = d3.arc<d3.PieArcDatum<EmojiCategory>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .cornerRadius(6);

    const arcHover = d3.arc<d3.PieArcDatum<EmojiCategory>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius + 10)
      .cornerRadius(6);

    const arcs = g.selectAll('.arc')
      .data(pie(enhancedEmojiData.categories))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', isDark ? '#111827' : '#FFFFFF')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.3s')
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arcHover)
          .attr('opacity', 0.9);

        // Show category emojis
        const tooltipId = `category-tooltip-${Math.random().toString(36).substr(2, 9)}`;
        const tooltip = d3.select('body').append('div')
          .attr('id', tooltipId)
          .attr('class', 'category-tooltip')
          .style('position', 'absolute')
          .style('padding', '12px')
          .style('background', isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)')
          .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`)
          .style('border-radius', '12px')
          .style('backdrop-filter', 'blur(12px)')
          .style('box-shadow', '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)')
          .style('pointer-events', 'none')
          .style('max-width', '220px')
          .style('opacity', 0)
          .style('z-index', '1000')
          .style('font-family', '"Plus Jakarta Sans", sans-serif');

        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <div style="font-weight: 700; margin-bottom: 4px; color: ${d.data.color};">${d.data.name}</div>
          <div style="color: ${isDark ? '#D1D5DB' : '#4B5563'}; font-size: 13px; margin-bottom: 8px;">${d.data.count} emojis</div>
          <div style="font-size: 24px; letter-spacing: 2px;">${d.data.emojis.slice(0, 5).join(' ')}</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('d', arc);
        d3.selectAll('.category-tooltip').remove();
      });

    // Labels
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('fill', isDark ? '#F3F4F6' : '#FFFFFF')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('font-family', '"Plus Jakarta Sans", sans-serif')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)')
      .text(d => d.endAngle - d.startAngle > 0.2 ? d.data.name.split(' ')[0] : '');

    // Center text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -10)
      .style('font-size', '28px')
      .style('font-weight', '800')
      .style('font-family', '"Plus Jakarta Sans", sans-serif')
      .attr('fill', isDark ? '#F3F4F6' : '#1F2937')
      .text(analytics.emojiAnalysis.totalEmojis.toLocaleString());

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .style('font-size', '14px')
      .style('font-family', '"Plus Jakarta Sans", sans-serif')
      .attr('fill', isDark ? '#9CA3AF' : '#6B7280')
      .text('Total Emojis');
  }, [enhancedEmojiData, isDark]);

  // Calculate emoji stats
  const emojiStats = useMemo(() => {
    const totalMessages = messages.length;
    const messagesWithEmoji = messages.filter(m => m.metadata?.hasEmoji).length;
    const emojiRate = totalMessages > 0 ? (messagesWithEmoji / totalMessages) * 100 : 0;

    // Find most emoji-loving sender
    let maxEmojiSender = { name: '', count: 0 };
    Object.entries(analytics.emojiAnalysis.emojisPerSender).forEach(([sender, emojis]) => {
      const count = Object.values(emojis).reduce((sum, c) => sum + c, 0);
      if (count > maxEmojiSender.count) {
        maxEmojiSender = { name: sender, count };
      }
    });

    return {
      emojiRate,
      messagesWithEmoji,
      maxEmojiSender,
      uniqueRatio: analytics.emojiAnalysis.totalEmojis > 0
        ? analytics.emojiAnalysis.uniqueEmojis / analytics.emojiAnalysis.totalEmojis
        : 0
    };
  }, [analytics, messages]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="Emoji Usage Rate"
          value={`${emojiStats.emojiRate.toFixed(1)}%`}
          color="blue"
          description={`${emojiStats.messagesWithEmoji.toLocaleString()} of ${messages.length.toLocaleString()} messages`}
        />
        <MetricCard
          icon={Users}
          label="Emoji Champion"
          value={emojiStats.maxEmojiSender.name}
          color="emerald"
          description={`${emojiStats.maxEmojiSender.count.toLocaleString()} emojis used`}
        />
        <MetricCard
          icon={Heart}
          label="Emoji Diversity"
          value={analytics.emojiAnalysis.uniqueEmojis.toLocaleString()}
          color="purple"
          description="unique emojis used"
        />
        <MetricCard
          icon={enhancedEmojiData.sentiment.average > 0.2 ? TrendingUp : enhancedEmojiData.sentiment.average < -0.2 ? TrendingDown : Minus}
          label="Average Sentiment"
          value={enhancedEmojiData.sentiment.average > 0.5 ? '😄 Very Positive' :
            enhancedEmojiData.sentiment.average > 0.2 ? '🙂 Positive' :
              enhancedEmojiData.sentiment.average > -0.2 ? '😐 Neutral' :
                enhancedEmojiData.sentiment.average > -0.5 ? '😔 Negative' :
                  '😢 Very Negative'}
          color={enhancedEmojiData.sentiment.average > 0.2 ? 'green' : enhancedEmojiData.sentiment.average < -0.2 ? 'red' : 'orange'}
          description={`Score: ${enhancedEmojiData.sentiment.average.toFixed(2)}`}
        />
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 bg-white/50 dark:bg-gray-900/50 rounded-xl backdrop-blur-sm border border-white/10 overflow-x-auto">
        {(['frequency', 'categories', 'sentiment', 'timeline'] as const).map((mode) => (
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

      {/* Main Chart Area */}
      <GlassContainer>
        {viewMode === 'frequency' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
              Top 20 Most Used Emojis
            </h3>
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <svg ref={renderFrequencyChart} />
            </div>
          </div>
        )}

        {viewMode === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight self-start">
                Emoji Categories
              </h3>
              <svg ref={renderCategoryChart} />
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
                Category Breakdown
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {enhancedEmojiData.categories.map((category) => (
                  <div key={category.name} className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{category.emojis[0]}</span>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {category.count.toLocaleString()} uses
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'sentiment' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
              Emoji Sentiment by Participant
            </h3>
            <div className="space-y-4">
              {enhancedEmojiData.sentiment.bySender.map((sender) => {
                const sentimentColor = sender.score > 0.2 ? 'emerald' :
                  sender.score < -0.2 ? 'rose' : 'gray';
                const sentimentEmoji = sender.score > 0.5 ? '😄' :
                  sender.score > 0.2 ? '🙂' :
                    sender.score > -0.2 ? '😐' :
                      sender.score > -0.5 ? '😔' : '😢';

                return (
                  <div key={sender.sender} className="flex items-center justify-between p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl filter drop-shadow-sm">{sentimentEmoji}</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {sender.sender}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${sentimentColor === 'emerald' ? 'bg-emerald-500' :
                            sentimentColor === 'rose' ? 'bg-rose-500' : 'bg-gray-500'
                            }`}
                          style={{
                            width: `${Math.abs(sender.score) * 100}%`,
                            marginLeft: sender.score < 0 ? `${(1 - Math.abs(sender.score)) * 100}%` : '0'
                          }}
                        />
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${sentimentColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
                        sentimentColor === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'
                        }`}>
                        {sender.score.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
              Emoji Usage by Hour of Day
            </h3>
            <div className="grid grid-cols-12 gap-2">
              {Array.from({ length: 24 }, (_, hour) => {
                const count = enhancedEmojiData.hourlyDistribution[hour] || 0;
                const maxCount = Math.max(...Object.values(enhancedEmojiData.hourlyDistribution));
                const intensity = maxCount > 0 ? count / maxCount : 0;

                return (
                  <div key={hour} className="col-span-1 group relative">
                    <div
                      className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-300 hover:scale-110 hover:shadow-md cursor-help"
                      style={{
                        backgroundColor: intensity > 0
                          ? `rgba(236, 72, 153, ${Math.max(intensity, 0.1)})` // Pink base
                          : 'rgba(156, 163, 175, 0.1)',
                        color: intensity > 0.5 ? 'white' : isDark ? '#9CA3AF' : '#6B7280'
                      }}
                    >
                      {hour}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {hour}:00 - {count} emojis
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-pink-500"></div>
              <span>Darker pink indicates more emoji usage during that hour</span>
            </div>
          </div>
        )}
      </GlassContainer>

      {/* Top Emoji Combinations */}
      {enhancedEmojiData.combinations.length > 0 && (
        <GlassContainer>
          <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
            Popular Emoji Combinations
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {enhancedEmojiData.combinations.map((combo, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all hover:-translate-y-1 hover:shadow-sm"
              >
                <span className="text-2xl filter drop-shadow-sm">{combo.combo}</span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  ×{combo.count}
                </span>
              </div>
            ))}
          </div>
        </GlassContainer>
      )}

      {/* Selected Emoji Messages */}
      {selectedEmoji && (
        <GlassContainer className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Messages with <span className="text-2xl">{selectedEmoji}</span>
            </h3>
            <button
              onClick={() => setSelectedEmoji(null)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
            {messages
              .filter(m => m.metadata?.emojis?.includes(selectedEmoji))
              .slice(0, 20)
              .map((message, index) => (
                <div key={index} className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-primary-600 dark:text-primary-400">
                      {message.sender}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(message.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {message.type === 'text' && message.content}
                  </div>
                </div>
              ))}
          </div>
        </GlassContainer>
      )}
    </div>
  );
};
