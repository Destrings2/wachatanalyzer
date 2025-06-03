import { describe, it, expect, beforeEach } from 'vitest';
import { performanceCache } from './cache';
import { ParsedChat, ProcessedAnalytics, FilterState } from '../types';

describe('PerformanceCache', () => {
  let mockChat: ParsedChat;
  let mockAnalytics: ProcessedAnalytics;
  let mockFilters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>;

  beforeEach(() => {
    performanceCache.clearAll();

    // Mock chat data
    mockChat = {
      messages: [
        {
          datetime: new Date('2024-01-01T10:00:00Z'),
          timestamp: 1704110400000,
          sender: 'John',
          content: 'Hello world',
          type: 'text',
          metadata: {
            hasEmoji: false,
            hasUrl: false,
            wordCount: 2,
            charCount: 11,
          },
        }
      ],
      calls: [],
      participants: [
        {
          name: 'John',
          messageCount: 1,
          mediaCount: 0,
          firstMessage: new Date('2024-01-01T10:00:00Z'),
          lastMessage: new Date('2024-01-01T10:00:00Z'),
        }
      ],
      metadata: {
        exportDate: new Date('2024-01-01'),
        totalMessages: 1,
        totalCalls: 0,
        dateRange: {
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T10:00:00Z'),
        },
        chatType: 'individual',
      },
    };

    // Mock analytics
    mockAnalytics = {
      messageStats: {
        totalMessages: 1,
        messagesPerSender: { John: 1 },
        mediaPerSender: { John: 0 },
        averageMessageLength: 11,
        totalWords: 2,
        totalCharacters: 11,
      },
      timePatterns: {
        hourlyActivity: { John: { 10: 1 } },
        dailyActivity: { John: { '2024-01-01': 1 } },
        weeklyActivity: { John: { 1: 1 } },
        monthlyActivity: { John: { '2024-01': 1 } },
      },
      emojiAnalysis: {
        totalEmojis: 0,
        uniqueEmojis: 0,
        emojiFrequency: {},
        emojisPerSender: { John: {} },
        topEmojis: [],
      },
      wordFrequency: {
        topWords: [{ word: 'hello', count: 1 }, { word: 'world', count: 1 }],
        wordCloud: { hello: 1, world: 1 },
        uniqueWords: 2,
      },
      responseMetrics: {
        averageResponseTime: 0,
        responseTimePerSender: {},
        conversationInitiators: { John: 1 },
      },
      callAnalytics: {
        totalCalls: 0,
        completedCalls: 0,
        missedCalls: 0,
        averageDuration: 0,
        callsByHour: {},
        callsByDay: {},
      },
    };

    mockFilters = {
      selectedSenders: [],
      searchKeyword: '',
      messageTypes: ['text', 'media', 'call'],
      dateRange: null,
    };
  });

  describe('Cache Operations', () => {
    it('stores and retrieves analytics data', () => {
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      
      const retrieved = performanceCache.getCachedAnalytics(mockChat);
      expect(retrieved).toEqual(mockAnalytics);
    });

    it('stores and retrieves filtered data', () => {
      const filteredChat: ParsedChat = {
        ...mockChat,
        messages: mockChat.messages.slice(0, 1),
      };
      
      performanceCache.setCachedFilteredData(mockFilters, filteredChat);
      
      const retrieved = performanceCache.getCachedFilteredData(mockFilters);
      expect(retrieved).toEqual(filteredChat);
    });

    it('stores and retrieves partial analytics', () => {
      const partialAnalytics = { wordFrequency: mockAnalytics.wordFrequency };
      const partialType = 'wordAnalysis';
      
      performanceCache.setCachedPartialAnalytics(mockChat, partialType, partialAnalytics);
      
      const retrieved = performanceCache.getCachedPartialAnalytics(mockChat, partialType);
      expect(retrieved).toEqual(partialAnalytics);
    });

    it('returns null for non-existent cache entries', () => {
      expect(performanceCache.getCachedAnalytics(mockChat)).toBeNull();
      expect(performanceCache.getCachedFilteredData(mockFilters)).toBeNull();
      expect(performanceCache.getCachedPartialAnalytics(mockChat, 'nonexistent')).toBeNull();
    });
  });

  describe('Cache Key Generation', () => {
    it('generates consistent keys for same chat data', () => {
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      
      // Same chat data should retrieve the same cached value
      const identicalChat = { ...mockChat };
      const retrieved = performanceCache.getCachedAnalytics(identicalChat);
      expect(retrieved).toEqual(mockAnalytics);
    });

    it('generates different keys for different chat data', () => {
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      
      // Different chat data should not retrieve the cached value
      const differentChat: ParsedChat = {
        ...mockChat,
        messages: [
          ...mockChat.messages,
          {
            datetime: new Date('2024-01-02T10:00:00Z'),
            timestamp: 1704196800000,
            sender: 'Jane',
            content: 'Another message',
            type: 'text',
            metadata: {
              hasEmoji: false,
              hasUrl: false,
              wordCount: 2,
              charCount: 15,
            },
          }
        ],
        metadata: {
          ...mockChat.metadata,
          totalMessages: 2, // Different message count
        }
      };
      
      const retrieved = performanceCache.getCachedAnalytics(differentChat);
      expect(retrieved).toBeNull();
    });

    it('generates different keys for different filter combinations', () => {
      const filteredChat = { ...mockChat };
      performanceCache.setCachedFilteredData(mockFilters, filteredChat);
      
      // Different filters should not retrieve the cached value
      const differentFilters = {
        ...mockFilters,
        searchKeyword: 'test',
      };
      
      const retrieved = performanceCache.getCachedFilteredData(differentFilters);
      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('clears all cache entries', () => {
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      performanceCache.setCachedFilteredData(mockFilters, mockChat);
      performanceCache.setCachedPartialAnalytics(mockChat, 'test', {});
      
      performanceCache.clearAll();
      
      expect(performanceCache.getCachedAnalytics(mockChat)).toBeNull();
      expect(performanceCache.getCachedFilteredData(mockFilters)).toBeNull();
      expect(performanceCache.getCachedPartialAnalytics(mockChat, 'test')).toBeNull();
    });

    it('respects maximum cache size limit', () => {
      // Store multiple analytics with different chats
      for (let i = 0; i < 25; i++) { // More than the analytics cache limit of 20
        const chat: ParsedChat = {
          ...mockChat,
          metadata: {
            ...mockChat.metadata,
            totalMessages: i, // Make each chat unique
          },
        };
        performanceCache.setCachedAnalytics(chat, mockAnalytics);
      }
      
      // Early entries should be evicted, but recent ones should remain
      const recentChat: ParsedChat = {
        ...mockChat,
        metadata: {
          ...mockChat.metadata,
          totalMessages: 24,
        },
      };
      
      expect(performanceCache.getCachedAnalytics(recentChat)).toEqual(mockAnalytics);
    });
  });

  describe('Cache Behavior with Complex Data', () => {
    it('handles large chat data efficiently', () => {
      // Create a large chat with many messages
      const largeChat: ParsedChat = {
        ...mockChat,
        messages: Array(10000).fill(null).map((_, i) => ({
          datetime: new Date('2024-01-01T10:00:00Z'),
          timestamp: 1704110400000 + i * 1000,
          sender: `User${i % 10}`,
          content: `Message ${i}`,
          type: 'text' as const,
          metadata: {
            hasEmoji: false,
            hasUrl: false,
            wordCount: 2,
            charCount: 10,
          },
        })),
      };
      
      performanceCache.setCachedAnalytics(largeChat, mockAnalytics);
      
      // Should still retrieve quickly
      const retrieved = performanceCache.getCachedAnalytics(largeChat);
      expect(retrieved).toEqual(mockAnalytics);
    });

    it('handles complex filter combinations', () => {
      const complexFilters: typeof mockFilters = {
        selectedSenders: ['John', 'Jane', 'Bob'],
        searchKeyword: 'hello AND world OR test',
        messageTypes: ['text', 'media'],
        dateRange: [new Date('2024-01-01'), new Date('2024-01-31')],
      };
      
      performanceCache.setCachedFilteredData(complexFilters, mockChat);
      
      const retrieved = performanceCache.getCachedFilteredData(complexFilters);
      expect(retrieved).toEqual(mockChat);
    });
  });

  describe('Index Building and Usage', () => {
    it('builds and stores search indices', () => {
      const chatHash = performanceCache['generateChatHash'](mockChat);
      performanceCache.buildIndices(chatHash, mockChat);
      
      // Verify indices can be used for filtering
      const indices = performanceCache.getIndices(chatHash);
      expect(indices).toBeDefined();
      expect(indices?.senderIndex).toBeDefined();
      expect(indices?.typeIndex).toBeDefined();
      expect(indices?.keywordIndex).toBeDefined();
      expect(indices?.dateIndex).toBeDefined();
    });

    it('reuses existing indices for same chat', () => {
      const chatHash = performanceCache['generateChatHash'](mockChat);
      
      // Build indices once
      performanceCache.buildIndices(chatHash, mockChat);
      const firstIndices = performanceCache.getIndices(chatHash);
      
      // Build again - should return cached indices
      performanceCache.buildIndices(chatHash, mockChat);
      const secondIndices = performanceCache.getIndices(chatHash);
      
      expect(secondIndices).toBe(firstIndices); // Same reference
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('supports filter workflow with caching', () => {
      // Initial analytics
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      
      // User applies filters
      const filters1 = { ...mockFilters, searchKeyword: 'hello' };
      const filtered1 = { ...mockChat, messages: mockChat.messages.filter(m => m.content.includes('hello')) };
      performanceCache.setCachedFilteredData(filters1, filtered1);
      
      // User changes filters
      const filters2 = { ...mockFilters, selectedSenders: ['John'] };
      const filtered2 = { ...mockChat, messages: mockChat.messages.filter(m => m.sender === 'John') };
      performanceCache.setCachedFilteredData(filters2, filtered2);
      
      // Both filter results should be cached
      expect(performanceCache.getCachedFilteredData(filters1)).toEqual(filtered1);
      expect(performanceCache.getCachedFilteredData(filters2)).toEqual(filtered2);
      
      // Original analytics still cached
      expect(performanceCache.getCachedAnalytics(mockChat)).toEqual(mockAnalytics);
    });

    it('handles incremental analytics updates', () => {
      // Store base analytics
      performanceCache.setCachedAnalytics(mockChat, mockAnalytics);
      
      // Store partial analytics separately
      const emojiAnalysis: Partial<ProcessedAnalytics> = { 
        emojiAnalysis: {
          ...mockAnalytics.emojiAnalysis,
          emojiFrequency: { '😊': 5 }
        }
      };
      performanceCache.setCachedPartialAnalytics(mockChat, 'emoji', emojiAnalysis);
      
      const wordAnalysis: Partial<ProcessedAnalytics> = { 
        wordFrequency: {
          ...mockAnalytics.wordFrequency,
          topWords: [{ word: 'test', count: 10 }]
        }
      };
      performanceCache.setCachedPartialAnalytics(mockChat, 'words', wordAnalysis);
      
      // All should be retrievable
      expect(performanceCache.getCachedAnalytics(mockChat)).toEqual(mockAnalytics);
      expect(performanceCache.getCachedPartialAnalytics(mockChat, 'emoji')).toEqual(emojiAnalysis);
      expect(performanceCache.getCachedPartialAnalytics(mockChat, 'words')).toEqual(wordAnalysis);
    });
  });
});