import React, { useMemo, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import * as d3 from 'd3';
import { useD3 } from '../../hooks/useD3';
import { useTheme } from '../../hooks/useTheme';
import { useUIStore } from '../../stores/uiStore';
import { getSenderColor } from '../../utils/chartUtils';
import { BookOpen, Award, Brain, MessageCircle, TrendingUp } from 'lucide-react';
import Sentiment from 'sentiment';
import { GlassContainer } from '../common/GlassContainer';

interface WordCloudProps {
  analytics: ProcessedAnalytics;
  messages?: Message[];
}

interface WordStats {
  word: string;
  count: number;
  senders: Record<string, number>;
  sentiment?: number;
  category?: string;
}

interface SenderVocabulary {
  sender: string;
  uniqueWords: number;
  totalWords: number;
  averageWordLength: number;
  vocabularyRichness: number;
  topWords: Array<{ word: string; count: number }>;
  distinctiveWords: Array<{ word: string; distinctiveness: number }>;
}

interface WordCloudNode extends d3.SimulationNodeDatum {
  word: string;
  count: number;
  senders: Record<string, number>;
  sentiment?: number;
  category?: string;
  fontSize: number;
  color: string;
  radius: number;
  textWidth: number;
  textHeight: number;
}

export const WordCloud: React.FC<WordCloudProps> = ({ analytics, messages = [] }) => {
  const { theme } = useTheme();
  const { chartSettings, updateChartSettings } = useUIStore();
  const [viewMode, setViewMode] = useState<'cloud' | 'frequency' | 'senders' | 'trends' | 'sentiment' | 'insights'>('cloud');

  const isDark = theme === 'dark';

  // Enhanced word analysis

  // Enhanced word analysis
  const enhancedWordData = useMemo(() => {
    // Filter out system messages and WhatsApp metadata
    const textMessages = messages.filter(m =>
      m.type === 'text' &&
      m.content &&
      !m.content.includes('This message was deleted') &&
      !m.content.includes('message was edited') &&
      !m.content.includes('<Media omitted>') &&
      !m.content.includes('missed voice call') &&
      !m.content.includes('missed video call') &&
      !m.content.includes('You created group') &&
      !m.content.includes('created group') &&
      !m.content.includes('added you') &&
      !m.content.includes('removed you') &&
      !m.content.includes('left') &&
      !m.content.includes('joined using') &&
      !m.content.includes('changed their phone number') &&
      !m.content.includes('security code changed') &&
      !m.content.includes('end-to-end encrypted')
    );

    const wordStats: Record<string, WordStats> = {};
    const senderWords: Record<string, Record<string, number>> = {};
    const senderTotalWords: Record<string, number> = {};

    // Process messages for detailed analysis
    textMessages.forEach(msg => {
      if (!msg.content) return;

      const words = msg.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3 && word.length <= 20);

      if (!senderWords[msg.sender]) {
        senderWords[msg.sender] = {};
        senderTotalWords[msg.sender] = 0;
      }

      words.forEach(word => {
        // Overall word stats
        if (!wordStats[word]) {
          wordStats[word] = {
            word,
            count: 0,
            senders: {},
            sentiment: undefined // Will be calculated later if language supports it
          };
        }
        wordStats[word].count++;
        wordStats[word].senders[msg.sender] = (wordStats[word].senders[msg.sender] || 0) + 1;

        // Sender-specific stats
        senderWords[msg.sender][word] = (senderWords[msg.sender][word] || 0) + 1;
        senderTotalWords[msg.sender]++;
      });
    });

    // Calculate sender vocabularies
    const senderVocabularies: SenderVocabulary[] = Object.entries(senderWords).map(([sender, words]) => {
      const uniqueWords = Object.keys(words).length;
      const totalWords = senderTotalWords[sender] || 0;
      const averageWordLength = Object.keys(words).reduce((sum, word) => sum + word.length, 0) / uniqueWords;
      const vocabularyRichness = totalWords > 0 ? uniqueWords / totalWords : 0;

      // Find distinctive words (words this sender uses more than others)
      const distinctiveWords = Object.entries(words)
        .map(([word, count]) => {
          const totalUsage = wordStats[word]?.count || 0;
          const senderUsage = count;
          const distinctiveness = totalUsage > 1 ? senderUsage / totalUsage : 0;
          return { word, distinctiveness };
        })
        .filter(item => item.distinctiveness > 0.3) // At least 30% usage by this sender
        .sort((a, b) => b.distinctiveness - a.distinctiveness)
        .slice(0, 10);

      const topWords = Object.entries(words)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

      return {
        sender,
        uniqueWords,
        totalWords,
        averageWordLength,
        vocabularyRichness,
        topWords,
        distinctiveWords
      };
    }).sort((a, b) => b.vocabularyRichness - a.vocabularyRichness);

    // Dynamic word categorization based on patterns (language-agnostic)
    const categorizedWords: Record<string, string[]> = {
      short: [], // 3-4 letter words
      medium: [], // 5-7 letter words
      long: [], // 8+ letter words
      numbers: [], // words containing numbers
      repeated: [] // words with repeated letters
    };

    Object.keys(wordStats).forEach(word => {
      // Categorize by length
      if (word.length <= 4) {
        categorizedWords.short.push(word);
      } else if (word.length <= 7) {
        categorizedWords.medium.push(word);
      } else {
        categorizedWords.long.push(word);
      }

      // Check for numbers
      if (/\d/.test(word)) {
        categorizedWords.numbers.push(word);
      }

      // Check for repeated letters (pattern-based, not language-specific)
      if (/(.)\1{1,}/.test(word)) {
        categorizedWords.repeated.push(word);
      }
    });

    // Sort each category by frequency
    Object.keys(categorizedWords).forEach(category => {
      categorizedWords[category] = categorizedWords[category]
        .sort((a, b) => (wordStats[b]?.count || 0) - (wordStats[a]?.count || 0))
        .slice(0, 10); // Top 10 per category
    });

    // Calculate reading level (simplified Flesch formula approximation)
    const averageWordsPerMessage = textMessages.length > 0
      ? textMessages.reduce((sum, msg) => sum + (msg.content?.split(/\s+/).length || 0), 0) / textMessages.length
      : 0;

    const averageWordLength = Object.entries(wordStats)
      .reduce((sum, [word, stats]) => sum + (word.length * stats.count), 0) /
      Object.values(wordStats).reduce((sum, stats) => sum + stats.count, 0);

    // Rough reading level calculation
    const readingLevel = Math.max(1, Math.min(20,
      0.39 * averageWordsPerMessage + 11.8 * (averageWordLength / 6) - 15.59
    ));

    // N-grams (common phrases)
    const bigrams: Record<string, number> = {};
    textMessages.forEach(msg => {
      if (!msg.content) return;
      const words = msg.content.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length >= 3 && words[i + 1].length >= 3) {
          const bigram = `${words[i]} ${words[i + 1]} `;
          bigrams[bigram] = (bigrams[bigram] || 0) + 1;
        }
      }
    });

    const topBigrams = Object.entries(bigrams)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([phrase, count]) => ({ phrase, count }));

    // Check if sentiment analysis is supported for the detected language
    const isEnglish = analytics.wordFrequency.languageDetected === 'eng';
    const supportsSentiment = isEnglish; // Currently only support English

    let sentimentStats = {
      positive: [] as typeof wordStats[keyof typeof wordStats][],
      negative: [] as typeof wordStats[keyof typeof wordStats][],
      neutral: [] as typeof wordStats[keyof typeof wordStats][]
    };

    const senderSentiment: Record<string, { total: number; count: number; average: number }> = {};

    if (supportsSentiment) {
      // Create sentiment analyzer inside useMemo to avoid re-creation
      const sentiment = new Sentiment();

      // Calculate sentiment for individual words only for English
      Object.values(wordStats).forEach(wordStat => {
        wordStat.sentiment = sentiment.analyze(wordStat.word).score;
      });

      // Calculate overall sentiment statistics only for English
      sentimentStats = {
        positive: Object.values(wordStats).filter(w => w.sentiment && w.sentiment > 0),
        negative: Object.values(wordStats).filter(w => w.sentiment && w.sentiment < 0),
        neutral: Object.values(wordStats).filter(w => !w.sentiment || w.sentiment === 0)
      };

      // Calculate average sentiment per sender only for English
      textMessages.forEach(msg => {
        if (!msg.content) return;
        const msgSentiment = sentiment.analyze(msg.content);

        if (!senderSentiment[msg.sender]) {
          senderSentiment[msg.sender] = { total: 0, count: 0, average: 0 };
        }

        senderSentiment[msg.sender].total += msgSentiment.score;
        senderSentiment[msg.sender].count += 1;
      });

      // Calculate averages
      Object.values(senderSentiment).forEach(stats => {
        stats.average = stats.count > 0 ? stats.total / stats.count : 0;
      });
    }

    return {
      wordStats,
      senderVocabularies,
      categorizedWords,
      readingLevel,
      topBigrams,
      sentimentStats,
      senderSentiment,
      supportsSentiment,
      detectedLanguage: analytics.wordFrequency.languageDetected,
      totalUniqueWords: Object.keys(wordStats).length,
      averageWordsPerMessage,
      averageWordLength
    };
  }, [messages, analytics.wordFrequency.languageDetected]);

  // Use direct ref instead of useD3 to avoid re-renders
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Track if we need to render (for tab switching)
  const [shouldRender, setShouldRender] = React.useState(viewMode === 'cloud');

  // Update render flag when switching TO cloud view
  React.useEffect(() => {
    if (viewMode === 'cloud') {
      setShouldRender(true);
    }
  }, [viewMode]);

  // Render word cloud
  React.useEffect(() => {
    // Only render when on cloud view and when we should render
    if (viewMode !== 'cloud' || !shouldRender) return;

    // Reset the render flag to prevent unnecessary re-renders
    setShouldRender(false);

    const svg = d3.select(svgRef.current);
    if (!svg.node()) return;

    // Responsive dimensions
    const containerWidth = svg.node()?.parentElement?.clientWidth || 800;
    const isMobile = containerWidth < 768;
    const isTablet = containerWidth < 1024;

    const width = Math.min(containerWidth - 32, isMobile ? 360 : isTablet ? 600 : 800);
    const height = isMobile ? 400 : isTablet ? 500 : 600;
    const wordLimit = isMobile ? 25 : isTablet ? 35 : 50;

    // Use enhanced word data from filtered messages instead of analytics
    const words = Object.values(enhancedWordData.wordStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, wordLimit);

    svg.selectAll('*').remove();

    if (words.length === 0) return;

    // Calculate font sizes based on screen size
    const maxCount = d3.max(words, d => d.count) || 1;
    const minCount = d3.min(words, d => d.count) || 1;

    // Better font scaling with more dramatic size differences
    const fontScale = d3.scalePow()
      .exponent(0.7) // Slightly compress the range for better visual hierarchy
      .domain([minCount, maxCount])
      .range(isMobile ? [14, 36] : isTablet ? [16, 42] : [18, 50]);

    // Better color scheme that works in both light and dark modes
    const colorScale = d3.scaleOrdinal([
      '#8B5CF6', '#D946EF', '#F43F5E', '#EC4899', '#6366F1',
      '#06B6D4', '#10B981', '#F59E0B', '#F97316', '#3B82F6'
    ]);

    // Create tighter layout with better collision detection
    const nodes: WordCloudNode[] = words.map((word, i) => {
      const fontSize = fontScale(word.count);
      // More accurate text dimensions
      const textWidth = word.word.length * fontSize * (isMobile ? 0.55 : 0.58);
      const textHeight = fontSize * 1.2; // Account for descenders

      return {
        ...word,
        fontSize,
        color: colorScale(i.toString()),
        radius: Math.max(textWidth, textHeight) / 2 + (isMobile ? 2 : 3), // Tighter padding
        textWidth,
        textHeight,
        x: Math.random() * (width * 0.8) + (width * 0.1), // Random across 80% of width
        y: Math.random() * (height * 0.8) + (height * 0.1), // Random across 80% of height
        vx: 0,
        vy: 0
      };
    });

    // Force simulation that fills the container
    const simulation = d3.forceSimulation<WordCloudNode>(nodes)
      .force('charge', d3.forceManyBody().strength(isMobile ? -150 : -200)) // Moderate repulsion to spread out
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<WordCloudNode>().radius(d => d.radius).strength(0.8))
      .force('x', d3.forceX<WordCloudNode>().x(d => {
        // Important words toward center, less important spread out
        const index = words.findIndex(w => w.word === d.word);
        if (index < 5) {
          // Top 5 words stay near center
          return width / 2 + (Math.random() - 0.5) * width * 0.3;
        } else {
          // Other words distributed across width
          return width * 0.1 + Math.random() * width * 0.8;
        }
      }).strength(0.05))
      .force('y', d3.forceY<WordCloudNode>().y(d => {
        const index = words.findIndex(w => w.word === d.word);
        if (index < 5) {
          // Top 5 words stay near center
          return height / 2 + (Math.random() - 0.5) * height * 0.3;
        } else {
          // Other words distributed across height
          return height * 0.1 + Math.random() * height * 0.8;
        }
      }).strength(0.05))
      .force('bounds', () => {
        // Keep words within bounds
        nodes.forEach(node => {
          node.x = Math.max(node.radius, Math.min(width - node.radius, node.x || 0));
          node.y = Math.max(node.radius, Math.min(height - node.radius, node.y || 0));
        });
      })
      .stop();

    // Run simulation with more iterations for tighter packing
    const iterations = isMobile ? 250 : 400;
    for (let i = 0; i < iterations; ++i) simulation.tick();

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g');

    // Render words with better spacing
    g.selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', d => `${d.fontSize} px`)
      .attr('font-weight', 'bold')
      .attr('font-family', '"Plus Jakarta Sans", system-ui, sans-serif')
      .attr('fill', d => d.color)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .style('user-select', 'none')
      .text(d => d.word)
      .on('mouseover', function (event, d) {
        // Subtle hover effects
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 1)
          .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))')
          .attr('font-size', `${d.fontSize * (isMobile ? 1.05 : 1.1)} px`);

        // Enhanced tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'word-cloud-tooltip')
          .style('position', 'absolute')
          .style('padding', isMobile ? '8px 12px' : '12px 16px')
          .style('background', isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)')
          .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'} `)
          .style('border-radius', '12px')
          .style('backdrop-filter', 'blur(12px)')
          .style('box-shadow', '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('z-index', '1000')
          .style('font-size', isMobile ? '13px' : '14px')
          .style('font-family', '"Plus Jakarta Sans", system-ui, sans-serif');

        tooltip.transition().duration(150).style('opacity', 1);

        // Calculate frequency percentage
        const totalWords = analytics.wordFrequency.topWords.reduce((sum, w) => sum + w.count, 0);
        const percentage = ((d.count / totalWords) * 100).toFixed(1);

        tooltip.html(`
  < div style = "font-weight: 700; color: ${isDark ? '#F3F4F6' : '#111827'}; margin-bottom: 4px; font-size: ${isMobile ? '14px' : '16px'};" > ${d.word}</div >
    <div style="color: ${isDark ? '#D1D5DB' : '#4B5563'}; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between; gap: 12px;">
        <span>Count:</span>
        <span style="font-weight: 600; color: ${d.color};">${d.count.toLocaleString()}</span>
      </div>
      <div style="font-size: ${isMobile ? '11px' : '12px'}; margin-top: 4px; opacity: 0.8;">${percentage}% of top words</div>
    </div>
`);

        // Smart tooltip positioning
        const tooltipNode = tooltip.node();
        if (tooltipNode) {
          const tooltipRect = tooltipNode.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;

          let left = event.pageX + (isMobile ? 8 : 12);
          let top = event.pageY - tooltipRect.height - (isMobile ? 8 : 12);

          // Horizontal adjustment
          if (left + tooltipRect.width > viewportWidth - 16) {
            left = event.pageX - tooltipRect.width - (isMobile ? 8 : 12);
          }

          // Vertical adjustment
          if (top < 16) {
            top = event.pageY + (isMobile ? 8 : 12);
          }
          if (top + tooltipRect.height > viewportHeight - 16) {
            top = viewportHeight - tooltipRect.height - 16;
          }

          tooltip
            .style('left', Math.max(8, left) + 'px')
            .style('top', Math.max(8, top) + 'px');
        }
      })
      .on('mouseout', function (_, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 0.9)
          .style('filter', 'none')
          .attr('font-size', `${d.fontSize} px`);
        d3.selectAll('.word-cloud-tooltip').remove();
      })
      .on('click', (_, d) => {
        // Handle click if needed
      });

    // Add animation on load
    g.selectAll('text')
      .style('opacity', 0)
      .transition()
      .duration(1000)
      .delay((_, i) => i * 30)
      .style('opacity', 0.9);

  }, [enhancedWordData.wordStats, isDark, shouldRender, analytics.wordFrequency.topWords, viewMode]); // Re-render when filtered data changes or switching to cloud view

  // Render frequency bar chart
  const renderFrequencyChart = useD3((svg) => {
    const margin = { top: 20, right: chartSettings.separateMessagesBySender ? 150 : 30, bottom: 60, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Get top 20 words from enhanced data
    const topWords = Object.values(enhancedWordData.wordStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Get all senders for color mapping
    const allSenders = Object.keys(messages.reduce((acc, msg) => ({ ...acc, [msg.sender]: true }), {})).sort();

    const x = d3.scaleBand()
      .range([0, width])
      .domain(topWords.map(d => d.word))
      .padding(0.2);

    let y: d3.ScaleLinear<number, number>;

    if (chartSettings.separateMessagesBySender && allSenders.length > 0) {
      // For stacked bars, calculate max height considering all senders
      const maxCount = Math.max(...topWords.map(word =>
        allSenders.reduce((sum, sender) => sum + (word.senders[sender] || 0), 0)
      ));
      y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, maxCount]);
    } else {
      // For simple bars, use total count
      y = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(topWords, d => d.count) || 0]);
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .attr('fill', isDark ? '#9CA3AF' : '#6B7280')
      .style('font-family', '"Plus Jakarta Sans", sans-serif')
      .style('font-weight', '500');

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
      .text('Frequency');

    // Style axis lines
    g.selectAll('.domain, .tick line')
      .attr('stroke', isDark ? '#374151' : '#E5E7EB');

    g.selectAll('.tick text')
      .attr('fill', isDark ? '#9CA3AF' : '#6B7280')
      .style('font-family', '"Plus Jakarta Sans", sans-serif');

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'word-frequency-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)')
      .style('border', `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'} `)
      .style('border-radius', '8px')
      .style('backdrop-filter', 'blur(8px)')
      .style('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('color', isDark ? '#F3F4F6' : '#1F2937')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('font-family', '"Plus Jakarta Sans", sans-serif');

    if (chartSettings.separateMessagesBySender && allSenders.length > 0) {
      // Render stacked bars by sender
      topWords.forEach(word => {
        let currentY = height;

        allSenders.forEach((sender, senderIndex) => {
          const senderCount = word.senders[sender] || 0;
          if (senderCount === 0) return;

          const senderColor = getSenderColor(senderIndex, theme);
          const barHeight = height - y(senderCount);

          g.append('rect')
            .attr('class', `bar sender - ${senderIndex} `)
            .attr('x', x(word.word) || 0)
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
  < div style = "font-weight: bold;" > ${word.word}</div >
                <div style="color: ${senderColor}; margin-top: 4px;">${sender}: ${senderCount} times</div>
                <div style="margin-top: 2px;">Total: ${word.count} times</div>
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

      // Add legend for senders
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
    } else {
      // Render simple bars (total count)
      g.selectAll('.bar')
        .data(topWords)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.word) || 0)
        .attr('width', x.bandwidth())
        .attr('y', height)
        .attr('height', 0)
        .attr('fill', 'url(#barGradient)') // We'll add a gradient def
        .attr('rx', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
          d3.select(this).attr('opacity', 0.8);
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`
  < div style = "font-weight: bold;" > ${d.word}</div >
    <div style="margin-top: 4px;">${d.count} times</div>
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
        .attr('y', d => y(d.count))
        .attr('height', d => height - y(d.count));

      // Add gradient definition
      const defs = svg.append('defs');
      const gradient = defs.append('linearGradient')
        .attr('id', 'barGradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#8B5CF6'); // Primary violet

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#6366F1'); // Indigo
    }

    // Cleanup function
    return () => {
      d3.selectAll('.word-frequency-tooltip').remove();
    };
  }, [enhancedWordData.wordStats, isDark, chartSettings.separateMessagesBySender, theme, messages]);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Vocabulary Size</span>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {enhancedWordData.totalUniqueWords.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            unique words used
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Vocab Champion</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {enhancedWordData.senderVocabularies[0]?.sender || 'N/A'}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {Math.round((enhancedWordData.senderVocabularies[0]?.vocabularyRichness || 0) * 100)}% vocabulary richness
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Reading Level</span>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            Grade {Math.round(enhancedWordData.readingLevel)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            complexity estimate
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Avg Message</span>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(enhancedWordData.averageWordsPerMessage)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            words per message
          </div>
        </div>
      </div>

      {/* View Mode Tabs and Settings */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-white/50 dark:bg-gray-900/50 p-2 rounded-2xl backdrop-blur-sm border border-white/10">
        <div className="flex gap-1 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-xl overflow-x-auto">
          {(['cloud', 'frequency', 'senders', 'trends', 'sentiment', 'insights'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${viewMode === mode
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm scale-105'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Separate by Sender Toggle - Only show for relevant views */}
        {(['frequency', 'senders'].includes(viewMode)) && (
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Separate by Sender</span>
            <label className="cursor-pointer relative inline-flex items-center">
              <input
                type="checkbox"
                checked={chartSettings.separateMessagesBySender}
                onChange={(e) => updateChartSettings({ separateMessagesBySender: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/20">
        {viewMode === 'cloud' && (
          <div className="w-full flex justify-center overflow-hidden">
            <svg ref={svgRef} className="max-w-full h-auto" />
          </div>
        )}

        {viewMode === 'frequency' && (
          <div>
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">
              Top 20 Most Frequent Words
            </h3>
            <div className="overflow-x-auto custom-scrollbar pb-2">
              <svg ref={renderFrequencyChart} />
            </div>
          </div>
        )}

        {viewMode === 'senders' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Vocabulary Analysis by Participant
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enhancedWordData.senderVocabularies.map((sender, idx) => (
                <div key={sender.sender} className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getSenderColor(idx, theme) }}
                      />
                      <h4 className="font-bold text-gray-900 dark:text-white">{sender.sender}</h4>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {sender.uniqueWords.toLocaleString()} unique words
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Vocabulary Richness</span>
                        <span>{Math.round(sender.vocabularyRichness * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${sender.vocabularyRichness * 100}% `,
                            backgroundColor: getSenderColor(idx, theme)
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-2">Distinctive Words</span>
                      <div className="flex flex-wrap gap-1.5">
                        {sender.distinctiveWords.slice(0, 5).map(w => (
                          <span
                            key={w.word}
                            className="text-xs px-2 py-0.5 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                          >
                            {w.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'sentiment' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Sentiment Analysis
              </h3>
              {!enhancedWordData.supportsSentiment && (
                <span className="text-xs text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg border border-orange-200 dark:border-orange-800">
                  Only available for English
                </span>
              )}
            </div>

            {enhancedWordData.supportsSentiment ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                    <h4 className="text-emerald-700 dark:text-emerald-400 font-bold mb-2">Positive Words</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {enhancedWordData.sentimentStats.positive.slice(0, 15).map(w => (
                        <span key={w.word} className="text-xs px-2 py-1 rounded-md bg-white/80 dark:bg-gray-800/80 text-emerald-700 dark:text-emerald-400 shadow-sm">
                          {w.word} ({w.count})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 border border-rose-100 dark:border-rose-800/30">
                    <h4 className="text-rose-700 dark:text-rose-400 font-bold mb-2">Negative Words</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {enhancedWordData.sentimentStats.negative.slice(0, 15).map(w => (
                        <span key={w.word} className="text-xs px-2 py-1 rounded-md bg-white/80 dark:bg-gray-800/80 text-rose-700 dark:text-rose-400 shadow-sm">
                          {w.word} ({w.count})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                    <h4 className="text-blue-700 dark:text-blue-400 font-bold mb-2">Sentiment by Person</h4>
                    <div className="space-y-3">
                      {Object.entries(enhancedWordData.senderSentiment).map(([sender, stats]) => (
                        <div key={sender}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{sender}</span>
                            <span className={stats.average > 0 ? 'text-emerald-600' : stats.average < 0 ? 'text-rose-600' : 'text-gray-500'}>
                              {stats.average > 0 ? '+' : ''}{stats.average.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 relative">
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500"></div>
                            <div
                              className={`h - 1.5 rounded - full ${stats.average >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} `}
                              style={{
                                width: `${Math.min(Math.abs(stats.average) * 20, 50)}% `,
                                marginLeft: stats.average >= 0 ? '50%' : `${50 - Math.min(Math.abs(stats.average) * 20, 50)}% `
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Sentiment analysis is currently only supported for English conversations.
              </div>
            )}
          </div>
        )}

        {viewMode === 'insights' && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              Linguistic Insights
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-5 border border-white/10">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary-500" />
                  Common Phrases (Bigrams)
                </h4>
                <div className="space-y-2">
                  {enhancedWordData.topBigrams.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{item.phrase}</span>
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-5 border border-white/10">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4">Word Length Distribution</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Short (3-4 chars)</span>
                        <span className="text-gray-900 dark:text-white font-medium">{enhancedWordData.categorizedWords.short.length} top words</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {enhancedWordData.categorizedWords.short.slice(0, 5).map(w => (
                          <span key={w} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{w}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Medium (5-7 chars)</span>
                        <span className="text-gray-900 dark:text-white font-medium">{enhancedWordData.categorizedWords.medium.length} top words</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {enhancedWordData.categorizedWords.medium.slice(0, 5).map(w => (
                          <span key={w} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{w}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Long (8+ chars)</span>
                        <span className="text-gray-900 dark:text-white font-medium">{enhancedWordData.categorizedWords.long.length} top words</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {enhancedWordData.categorizedWords.long.slice(0, 5).map(w => (
                          <span key={w} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-5 border border-white/10">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Reading Level Estimate</h4>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                      Grade {Math.round(enhancedWordData.readingLevel)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">
                      (approximate)
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Based on average word length ({enhancedWordData.averageWordLength.toFixed(1)} chars) and sentence complexity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'trends' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Word Trends Analysis</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Temporal analysis of word usage patterns is coming soon. This will allow you to see how specific topics trend over time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};