import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import * as d3 from 'd3';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { TrendingUp, TrendingDown, Minus, Users, Heart, X } from 'lucide-react';

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

export const EmojiAnalysis: React.FC<EmojiAnalysisProps> = ({ analytics, messages = [] }) => {
  const { theme } = useTheme();
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'frequency' | 'timeline' | 'categories' | 'sentiment'>('frequency');

  const isDark = theme === 'dark';

  // Enhanced emoji analysis
  const enhancedEmojiData = useMemo(() => {
    // Category analysis
    const categories: EmojiCategory[] = Object.entries(EMOJI_CATEGORIES).map(([key, category]) => ({
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
      if (/^[\u200D\u2640\u2642\uFE0F\u20E3]+$/.test(normalized) || normalized.length === 0) {
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
      .padding(0.1);

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(data, d => d.count) || 0]);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('font-size', '20px');

    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', isDark ? '#9CA3AF' : '#4B5563')
      .text('Usage Count');

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.emoji) || 0)
      .attr('width', x.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', '#3B82F6')
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);

        // Tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('padding', '8px')
          .style('background', isDark ? '#1F2937' : '#F9FAFB')
          .style('border', `1px solid ${isDark ? '#374151' : '#E5E7EB'}`)
          .style('border-radius', '4px')
          .style('pointer-events', 'none')
          .style('opacity', 0);

        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip.html(`
          <div style="font-size: 24px; text-align: center;">${d.emoji}</div>
          <div style="color: ${isDark ? '#D1D5DB' : '#6B7280'}">Used ${d.count} times</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        d3.selectAll('.tooltip').remove();
      })
      .on('click', (event, d) => {
        setSelectedEmoji(d.emoji);
      })
      .transition()
      .duration(800)
      .attr('y', d => y(d.count))
      .attr('height', d => height - y(d.count));
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
      .value(d => d.count);

    const arc = d3.arc<d3.PieArcDatum<EmojiCategory>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius);

    const arcs = g.selectAll('.arc')
      .data(pie(enhancedEmojiData.categories))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);

        // Show category emojis
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('padding', '12px')
          .style('background', isDark ? '#1F2937' : '#F9FAFB')
          .style('border', `1px solid ${isDark ? '#374151' : '#E5E7EB'}`)
          .style('border-radius', '4px')
          .style('pointer-events', 'none')
          .style('max-width', '200px')
          .style('opacity', 0);

        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip.html(`
          <div style="font-weight: bold; margin-bottom: 4px;">${d.data.name}</div>
          <div style="color: ${isDark ? '#D1D5DB' : '#6B7280'}">${d.data.count} emojis</div>
          <div style="margin-top: 4px; font-size: 20px;">${d.data.emojis.slice(0, 5).join(' ')}</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.8);
        d3.selectAll('.tooltip').remove();
      });

    // Labels
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => d.data.name);

    // Center text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -10)
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .attr('fill', isDark ? '#F3F4F6' : '#1F2937')
      .text(analytics.emojiAnalysis.totalEmojis);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .style('font-size', '14px')
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
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">Emoji Usage Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {emojiStats.emojiRate.toFixed(1)}%
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            {emojiStats.messagesWithEmoji} of {messages.length} messages
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-600 dark:text-green-400 text-sm font-medium">Emoji Champion</span>
            <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-lg font-bold text-green-900 dark:text-green-100 truncate">
            {emojiStats.maxEmojiSender.name}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300 mt-1">
            {emojiStats.maxEmojiSender.count} emojis used
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-600 dark:text-purple-400 text-sm font-medium">Emoji Diversity</span>
            <Heart className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {analytics.emojiAnalysis.uniqueEmojis}
          </div>
          <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
            unique emojis used
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-orange-600 dark:text-orange-400 text-sm font-medium">Average Sentiment</span>
            {enhancedEmojiData.sentiment.average > 0.2 ? (
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : enhancedEmojiData.sentiment.average < -0.2 ? (
              <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            ) : (
              <Minus className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            )}
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            {enhancedEmojiData.sentiment.average > 0.5 ? '😄 Very Positive' :
             enhancedEmojiData.sentiment.average > 0.2 ? '🙂 Positive' :
             enhancedEmojiData.sentiment.average > -0.2 ? '😐 Neutral' :
             enhancedEmojiData.sentiment.average > -0.5 ? '😔 Negative' :
             '😢 Very Negative'}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
            Score: {enhancedEmojiData.sentiment.average.toFixed(2)}
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {(['frequency', 'categories', 'sentiment', 'timeline'] as const).map((mode) => (
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

      {/* Main Chart Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        {viewMode === 'frequency' && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Top 20 Most Used Emojis
            </h3>
            <div className="overflow-x-auto">
              <svg ref={renderFrequencyChart} />
            </div>
          </div>
        )}

        {viewMode === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Emoji Categories
              </h3>
              <svg ref={renderCategoryChart} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Category Breakdown
              </h3>
              <div className="space-y-3">
                {enhancedEmojiData.categories.map((category) => (
                  <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.emojis[0]}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {category.count} uses
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
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Emoji Sentiment by Participant
            </h3>
            <div className="space-y-4">
              {enhancedEmojiData.sentiment.bySender.map((sender) => {
                const sentimentColor = sender.score > 0.2 ? 'green' :
                                     sender.score < -0.2 ? 'red' : 'gray';
                const sentimentEmoji = sender.score > 0.5 ? '😄' :
                                     sender.score > 0.2 ? '🙂' :
                                     sender.score > -0.2 ? '😐' :
                                     sender.score > -0.5 ? '😔' : '😢';

                return (
                  <div key={sender.sender} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{sentimentEmoji}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {sender.sender}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full bg-${sentimentColor}-500`}
                          style={{
                            width: `${Math.abs(sender.score) * 100}%`,
                            marginLeft: sender.score < 0 ? `${(1 - Math.abs(sender.score)) * 100}%` : '0'
                          }}
                        />
                      </div>
                      <span className={`text-sm font-medium text-${sentimentColor}-600 dark:text-${sentimentColor}-400`}>
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
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Emoji Usage by Hour of Day
            </h3>
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 24 }, (_, hour) => {
                const count = enhancedEmojiData.hourlyDistribution[hour] || 0;
                const maxCount = Math.max(...Object.values(enhancedEmojiData.hourlyDistribution));
                const intensity = maxCount > 0 ? count / maxCount : 0;

                return (
                  <div key={hour} className="col-span-1">
                    <div
                      className="aspect-square rounded flex items-center justify-center text-xs font-medium"
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                        color: intensity > 0.5 ? 'white' : isDark ? '#9CA3AF' : '#6B7280'
                      }}
                      title={`${hour}:00 - ${count} emojis`}
                    >
                      {hour}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Darker blue indicates more emoji usage during that hour
            </div>
          </div>
        )}
      </div>

      {/* Top Emoji Combinations */}
      {enhancedEmojiData.combinations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Popular Emoji Combinations
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {enhancedEmojiData.combinations.map((combo, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className="text-2xl">{combo.combo}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  ×{combo.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Emoji Messages */}
      {selectedEmoji && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Messages with {selectedEmoji}
            </h3>
            <button
              onClick={() => setSelectedEmoji(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages
              .filter(m => m.metadata?.emojis?.includes(selectedEmoji))
              .slice(0, 20)
              .map((message, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
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
        </div>
      )}
    </div>
  );
};
