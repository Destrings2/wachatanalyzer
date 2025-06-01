import { describe, it, expect } from 'vitest'
import {
  analyzeMessageStats,
  analyzeTimePatterns,
  analyzeEmojis,
  analyzeWordFrequency,
  analyzeResponseMetrics,
  analyzeCallAnalytics,
  analyzeChat,
  aggregateHourlyActivity,
  aggregateDailyActivity,
  aggregateWeeklyActivity,
  aggregateMonthlyActivity
} from './analyzer'
import { createMockChat, createMockMessage, createMockCall } from '../test/utils'

describe('Message Stats Analysis', () => {
  it('should calculate basic message statistics', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice', 
          content: 'Hello world',
          metadata: { hasEmoji: false, emojis: [], hasUrl: false, urls: [], wordCount: 2, charCount: 11 }
        }),
        createMockMessage({ 
          sender: 'Bob', 
          content: 'Hi there!',
          metadata: { hasEmoji: false, emojis: [], hasUrl: false, urls: [], wordCount: 2, charCount: 9 }
        }),
        createMockMessage({ 
          sender: 'Alice', 
          content: 'How are you?',
          metadata: { hasEmoji: false, emojis: [], hasUrl: false, urls: [], wordCount: 3, charCount: 12 }
        })
      ]
    })

    const stats = analyzeMessageStats(chat)

    expect(stats.totalMessages).toBe(3)
    expect(stats.messagesPerSender).toEqual({
      'Alice': 2,
      'Bob': 1
    })
    expect(stats.totalWords).toBe(7)
    expect(stats.totalCharacters).toBe(32)
    expect(stats.averageMessageLength).toBeCloseTo(32 / 3)
  })

  it('should track media messages per sender', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ sender: 'Alice', type: 'text' }),
        createMockMessage({ sender: 'Alice', type: 'media', mediaType: 'image' }),
        createMockMessage({ sender: 'Bob', type: 'media', mediaType: 'video' }),
        createMockMessage({ sender: 'Bob', type: 'media', mediaType: 'audio' })
      ]
    })

    const stats = analyzeMessageStats(chat)

    expect(stats.mediaPerSender).toEqual({
      'Alice': 1,
      'Bob': 2
    })
  })

  it('should handle empty chat', () => {
    const chat = createMockChat({ messages: [] })
    const stats = analyzeMessageStats(chat)

    expect(stats.totalMessages).toBe(0)
    expect(stats.totalWords).toBe(0)
    expect(stats.totalCharacters).toBe(0)
    expect(stats.averageMessageLength).toBeNaN()
  })
})

describe('Time Patterns Analysis', () => {
  it('should analyze hourly activity patterns', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ datetime: new Date('2024-01-15T09:00:00Z') }), // Hour 9
        createMockMessage({ datetime: new Date('2024-01-15T09:30:00Z') }), // Hour 9
        createMockMessage({ datetime: new Date('2024-01-15T14:00:00Z') }), // Hour 14
        createMockMessage({ datetime: new Date('2024-01-15T20:00:00Z') })  // Hour 20
      ]
    })

    const patterns = analyzeTimePatterns(chat)
    const aggregated = aggregateHourlyActivity(patterns.hourlyActivity)

    expect(aggregated[9]).toBe(2)
    expect(aggregated[14]).toBe(1)
    expect(aggregated[20]).toBe(1)
    expect(aggregated[0]).toBe(0) // No messages at midnight
  })

  it('should analyze weekly activity patterns', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ datetime: new Date('2024-01-14T10:00:00Z') }), // Sunday (0)
        createMockMessage({ datetime: new Date('2024-01-15T10:00:00Z') }), // Monday (1)
        createMockMessage({ datetime: new Date('2024-01-15T11:00:00Z') }), // Monday (1)
        createMockMessage({ datetime: new Date('2024-01-16T10:00:00Z') })  // Tuesday (2)
      ]
    })

    const patterns = analyzeTimePatterns(chat)
    const aggregated = aggregateWeeklyActivity(patterns.weeklyActivity)

    expect(aggregated[0]).toBe(1) // Sunday
    expect(aggregated[1]).toBe(2) // Monday
    expect(aggregated[2]).toBe(1) // Tuesday
    expect(aggregated[3]).toBe(0) // Wednesday
  })

  it('should analyze daily and monthly activity', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ datetime: new Date('2024-01-15T10:00:00Z') }),
        createMockMessage({ datetime: new Date('2024-01-15T11:00:00Z') }),
        createMockMessage({ datetime: new Date('2024-01-16T10:00:00Z') }),
        createMockMessage({ datetime: new Date('2024-02-01T10:00:00Z') })
      ]
    })

    const patterns = analyzeTimePatterns(chat)
    const aggregatedDaily = aggregateDailyActivity(patterns.dailyActivity)
    const aggregatedMonthly = aggregateMonthlyActivity(patterns.monthlyActivity)

    expect(aggregatedDaily['2024-01-15']).toBe(2)
    expect(aggregatedDaily['2024-01-16']).toBe(1)
    expect(aggregatedMonthly['2024-01']).toBe(3)
    expect(aggregatedMonthly['2024-02']).toBe(1)
  })
})

describe('Emoji Analysis', () => {
  it('should analyze emoji frequency', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice',
          metadata: { 
            hasEmoji: true, 
            emojis: ['😊', '😊', '👍'], 
            hasUrl: false, 
            urls: [], 
            wordCount: 3, 
            charCount: 10 
          }
        }),
        createMockMessage({ 
          sender: 'Bob',
          metadata: { 
            hasEmoji: true, 
            emojis: ['😊', '❤️'], 
            hasUrl: false, 
            urls: [], 
            wordCount: 2, 
            charCount: 8 
          }
        })
      ]
    })

    const analysis = analyzeEmojis(chat)

    expect(analysis.totalEmojis).toBe(5)
    expect(analysis.uniqueEmojis).toBe(3)
    expect(analysis.emojiFrequency).toEqual({
      '😊': 3,
      '👍': 1,
      '❤️': 1
    })
    expect(analysis.topEmojis[0]).toEqual({ emoji: '😊', count: 3 })
  })

  it('should track emojis per sender', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice',
          metadata: { 
            hasEmoji: true, 
            emojis: ['😊', '👍'], 
            hasUrl: false, 
            urls: [], 
            wordCount: 2, 
            charCount: 8 
          }
        }),
        createMockMessage({ 
          sender: 'Bob',
          metadata: { 
            hasEmoji: true, 
            emojis: ['😊'], 
            hasUrl: false, 
            urls: [], 
            wordCount: 1, 
            charCount: 4 
          }
        })
      ]
    })

    const analysis = analyzeEmojis(chat)

    expect(analysis.emojisPerSender['Alice']).toEqual({
      '😊': 1,
      '👍': 1
    })
    expect(analysis.emojisPerSender['Bob']).toEqual({
      '😊': 1
    })
  })

  it('should handle messages without emojis', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          metadata: { hasEmoji: false, emojis: [], hasUrl: false, urls: [], wordCount: 2, charCount: 10 }
        })
      ]
    })

    const analysis = analyzeEmojis(chat)

    expect(analysis.totalEmojis).toBe(0)
    expect(analysis.uniqueEmojis).toBe(0)
    expect(analysis.topEmojis).toEqual([])
  })
})

describe('Word Frequency Analysis', () => {
  it('should analyze word frequency in text messages', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          content: 'Hello world beautiful world',
          type: 'text'
        }),
        createMockMessage({ 
          content: 'Beautiful day today',
          type: 'text'
        }),
        createMockMessage({ 
          content: '', // Media message
          type: 'media'
        })
      ]
    })

    const analysis = analyzeWordFrequency(chat)

    expect(analysis.uniqueWords).toBeGreaterThan(0)
    expect(analysis.topWords.length).toBeGreaterThan(0)
    
    // Should include words like "world", "beautiful" (without stopwords)
    const words = analysis.topWords.map(w => w.word)
    expect(words).toContain('world')
    expect(words).toContain('beautiful')
  })

  it('should handle chat with no text messages', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ type: 'media' }),
        createMockMessage({ type: 'call' })
      ]
    })

    const analysis = analyzeWordFrequency(chat)

    expect(analysis.uniqueWords).toBe(0)
    expect(analysis.topWords).toEqual([])
    expect(analysis.languageDetected).toBe('eng')
  })

  it('should detect language', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          content: 'Hello world this is English text',
          type: 'text'
        })
      ]
    })

    const analysis = analyzeWordFrequency(chat)

    expect(analysis.languageDetected).toBeTruthy()
    expect(typeof analysis.languageDetected).toBe('string')
  })
})

describe('Response Metrics Analysis', () => {
  it('should calculate response times between different senders', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice', 
          datetime: new Date('2024-01-15T10:00:00Z') 
        }),
        createMockMessage({ 
          sender: 'Bob', 
          datetime: new Date('2024-01-15T10:05:00Z') // 5 minutes later
        }),
        createMockMessage({ 
          sender: 'Alice', 
          datetime: new Date('2024-01-15T10:10:00Z') // 5 minutes later
        })
      ]
    })

    const metrics = analyzeResponseMetrics(chat)

    expect(metrics.averageResponseTime).toBe(5) // 5 minutes average
    expect(metrics.responseTimePerSender['Bob']).toBe(5)
    expect(metrics.responseTimePerSender['Alice']).toBe(5)
  })

  it('should identify conversation initiators', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice', 
          datetime: new Date('2024-01-15T09:00:00Z') 
        }),
        createMockMessage({ 
          sender: 'Bob', 
          datetime: new Date('2024-01-15T09:05:00Z') 
        }),
        // Long gap - new conversation
        createMockMessage({ 
          sender: 'Charlie', 
          datetime: new Date('2024-01-15T12:00:00Z') // 3 hours later
        })
      ]
    })

    const metrics = analyzeResponseMetrics(chat)

    expect(metrics.conversationInitiators['Alice']).toBe(1)
    expect(metrics.conversationInitiators['Charlie']).toBe(1)
    expect(metrics.conversationInitiators['Bob']).toBeUndefined()
  })

  it('should not count consecutive messages from same sender as responses', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice', 
          datetime: new Date('2024-01-15T10:00:00Z') 
        }),
        createMockMessage({ 
          sender: 'Alice', 
          datetime: new Date('2024-01-15T10:01:00Z') 
        })
      ]
    })

    const metrics = analyzeResponseMetrics(chat)

    expect(metrics.averageResponseTime).toBe(0)
    expect(Object.keys(metrics.responseTimePerSender)).toHaveLength(0)
  })
})

describe('Call Analytics', () => {
  it('should analyze call patterns by time', () => {
    const chat = createMockChat({
      calls: [
        createMockCall({ 
          datetime: new Date('2024-01-15T09:00:00Z'), // Monday, Hour 9
          status: 'completed',
          duration: 10
        }),
        createMockCall({ 
          datetime: new Date('2024-01-15T14:00:00Z'), // Monday, Hour 14
          status: 'missed',
          duration: 0
        }),
        createMockCall({ 
          datetime: new Date('2024-01-16T09:00:00Z'), // Tuesday, Hour 9
          status: 'completed',
          duration: 15
        })
      ]
    })

    const analytics = analyzeCallAnalytics(chat)

    expect(analytics.callsByHour[9]).toBe(2)
    expect(analytics.callsByHour[14]).toBe(1)
    expect(analytics.callsByDay[1]).toBe(2) // Monday
    expect(analytics.callsByDay[2]).toBe(1) // Tuesday
  })

  it('should calculate call success rate and duration', () => {
    const chat = createMockChat({
      calls: [
        createMockCall({ status: 'completed', duration: 10 }),
        createMockCall({ status: 'completed', duration: 20 }),
        createMockCall({ status: 'missed', duration: 0 }),
        createMockCall({ status: 'missed', duration: 0 })
      ]
    })

    const analytics = analyzeCallAnalytics(chat)

    expect(analytics.totalCalls).toBe(4)
    expect(analytics.completedCalls).toBe(2)
    expect(analytics.missedCalls).toBe(2)
    expect(analytics.averageDuration).toBe(15) // (10 + 20) / 2
    // Note: successRate is not part of CallAnalytics interface, so calculating manually
    const successRate = analytics.completedCalls / analytics.totalCalls
    expect(successRate).toBe(0.5) // 2/4
  })

  it('should handle no calls', () => {
    const chat = createMockChat({ calls: [] })
    const analytics = analyzeCallAnalytics(chat)

    expect(analytics.totalCalls).toBe(0)
    expect(analytics.completedCalls).toBe(0)
    expect(analytics.missedCalls).toBe(0)
    expect(analytics.averageDuration).toBe(0)
    const successRate = analytics.totalCalls > 0 ? analytics.completedCalls / analytics.totalCalls : 0
    expect(successRate).toBe(0)
  })
})

describe('Complete Chat Analysis', () => {
  it('should analyze all aspects of a chat', () => {
    const chat = createMockChat({
      messages: [
        createMockMessage({ 
          sender: 'Alice', 
          content: 'Hello world! 😊',
          datetime: new Date('2024-01-15T09:00:00Z'),
          metadata: {
            hasEmoji: true,
            emojis: ['😊'],
            hasUrl: false,
            urls: [],
            wordCount: 2,
            charCount: 13
          }
        }),
        createMockMessage({ 
          sender: 'Bob', 
          content: 'Hi there!',
          datetime: new Date('2024-01-15T09:05:00Z'),
          metadata: {
            hasEmoji: false,
            emojis: [],
            hasUrl: false,
            urls: [],
            wordCount: 2,
            charCount: 9
          }
        })
      ],
      calls: [
        createMockCall({ 
          initiator: 'Alice',
          status: 'completed',
          duration: 10
        })
      ]
    })

    const analysis = analyzeChat(chat)

    // Verify all analysis components are present
    expect(analysis).toHaveProperty('messageStats')
    expect(analysis).toHaveProperty('timePatterns')
    expect(analysis).toHaveProperty('emojiAnalysis')
    expect(analysis).toHaveProperty('wordFrequency')
    expect(analysis).toHaveProperty('responseMetrics')
    expect(analysis).toHaveProperty('callAnalytics')

    // Verify some basic calculations
    expect(analysis.messageStats.totalMessages).toBe(2)
    expect(analysis.emojiAnalysis.totalEmojis).toBe(1)
    expect(analysis.callAnalytics.totalCalls).toBe(1)
  })

  it('should handle edge cases gracefully', () => {
    const emptyChat = createMockChat({ 
      messages: [], 
      calls: [],
      participants: []
    })

    const analysis = analyzeChat(emptyChat)

    expect(analysis.messageStats.totalMessages).toBe(0)
    expect(analysis.emojiAnalysis.totalEmojis).toBe(0)
    expect(analysis.callAnalytics.totalCalls).toBe(0)
    expect(analysis.wordFrequency.uniqueWords).toBe(0)
  })
})

describe('Analysis Workflows', () => {
  describe('Progressive Analysis', () => {
    it('should handle large datasets efficiently', () => {
      const largeChat = createMockChat({
        messages: Array.from({ length: 1000 }, (_, i) => 
          createMockMessage({ 
            sender: i % 3 === 0 ? 'Alice' : i % 3 === 1 ? 'Bob' : 'Charlie',
            content: `Message ${i} with some test content`,
            datetime: new Date(Date.now() + i * 60000) // 1 minute apart
          })
        )
      })

      const startTime = Date.now()
      const analysis = analyzeChat(largeChat)
      const endTime = Date.now()

      // Analysis should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000) // Less than 5 seconds

      // Results should be meaningful
      expect(analysis.messageStats.totalMessages).toBe(1000)
      expect(Object.keys(analysis.messageStats.messagesPerSender)).toHaveLength(3)
    })
  })

  describe('Multilingual Content', () => {
    it('should handle different languages', () => {
      const multilingualChat = createMockChat({
        messages: [
          createMockMessage({ content: 'Hello world how are you today' }),
          createMockMessage({ content: 'Hola mundo cómo estás hoy' }),
          createMockMessage({ content: 'Bonjour monde comment allez-vous' })
        ]
      })

      const analysis = analyzeWordFrequency(multilingualChat)

      expect(analysis.languageDetected).toBeTruthy()
      expect(analysis.uniqueWords).toBeGreaterThan(0)
    })
  })

  describe('Real-time Analysis Scenarios', () => {
    it('should handle incremental data updates', () => {
      // Initial analysis
      const initialChat = createMockChat({
        messages: [
          createMockMessage({ sender: 'Alice', content: 'Hello' })
        ]
      })

      const initialAnalysis = analyzeMessageStats(initialChat)
      expect(initialAnalysis.totalMessages).toBe(1)

      // Updated chat with more messages
      const updatedChat = createMockChat({
        messages: [
          ...initialChat.messages,
          createMockMessage({ sender: 'Bob', content: 'Hi there' })
        ]
      })

      const updatedAnalysis = analyzeMessageStats(updatedChat)
      expect(updatedAnalysis.totalMessages).toBe(2)
      expect(updatedAnalysis.messagesPerSender['Alice']).toBe(1)
      expect(updatedAnalysis.messagesPerSender['Bob']).toBe(1)
    })
  })

  describe('Data Quality Scenarios', () => {
    it('should handle malformed or missing data', () => {
      const problematicChat = createMockChat({
        messages: [
          createMockMessage({ 
            content: '',
            metadata: {
              hasEmoji: false,
              emojis: undefined as unknown as string[],
              hasUrl: false,
              urls: undefined as unknown as string[],
              wordCount: 0,
              charCount: 0
            }
          })
        ]
      })

      // Should not throw errors
      expect(() => analyzeChat(problematicChat)).not.toThrow()
      
      const analysis = analyzeChat(problematicChat)
      expect(analysis.messageStats.totalMessages).toBe(1)
    })
  })
})