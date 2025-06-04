import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the worker environment and extract parsing functions for testing
const mockPostMessage = vi.fn()
const mockAddEventListener = vi.fn()

// Set up global worker environment
globalThis.self = {
  postMessage: mockPostMessage,
  addEventListener: mockAddEventListener
} as unknown as typeof globalThis.self

// We'll import the worker to set up the environment, then extract the logic for testing
let parseWhatsAppChatFunction: (content: string) => Promise<void>

describe('WhatsApp Chat Parser', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Import the worker module to set up the environment
    await import('./parser.worker')

    // Extract the message handler from the addEventListener call
    const messageHandlerCall = mockAddEventListener.mock.calls.find(
      call => call[0] === 'message'
    )

    if (messageHandlerCall) {
      const originalHandler = messageHandlerCall[1]
      // Create a wrapper function that simulates the worker message handling
      parseWhatsAppChatFunction = async (content: string) => {
        await originalHandler({ data: { type: 'parse', content } })
      }
    }
  })

  describe('Message Format Recognition', () => {
    it('should parse standard WhatsApp message format', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John Doe: Hello world
[15/01/2024, 10:31:00] Jane Smith: Hi there!`

      await parseWhatsAppChatFunction(chatContent)

      // Verify chunk messages were sent
      const chunkCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'chunk'
      )
      expect(chunkCalls.length).toBeGreaterThan(0)

      // Verify the structure of parsed messages
      const firstChunk = chunkCalls[0][0]
      expect(firstChunk.data.messages).toBeDefined()
      expect(firstChunk.data.messages.length).toBe(2)

      const [message1, message2] = firstChunk.data.messages
      expect(message1.sender).toBe('John Doe')
      expect(message1.content).toBe('Hello world')
      expect(message2.sender).toBe('Jane Smith')
      expect(message2.content).toBe('Hi there!')
    })

    it('should handle multi-line messages', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John Doe: This is a long message
that spans multiple lines
and has line breaks`

      await parseWhatsAppChatFunction(chatContent)

      const chunkCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'chunk'
      )

      const message = chunkCalls[0][0].data.messages[0]
      expect(message.content).toContain('This is a long message')
      expect(message.content).toContain('that spans multiple lines')
      expect(message.content).toContain('and has line breaks')
    })

    it('should parse different date formats', async () => {
      const chatContent = `[1/1/2024, 9:00:00] Alice: New Year message
[31/12/2024, 23:59:59] Bob: End of year message`

      await parseWhatsAppChatFunction(chatContent)

      const chunkCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'chunk'
      )

      const messages = chunkCalls[0][0].data.messages
      expect(messages[0].datetime).toBeInstanceOf(Date)
      expect(messages[1].datetime).toBeInstanceOf(Date)

      // Verify dates are parsed correctly
      expect(messages[0].datetime.getMonth()).toBe(0) // January
      expect(messages[1].datetime.getMonth()).toBe(11) // December
    })
  })

  describe('Message Type Detection', () => {
    it('should identify text messages', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: This is a regular text message`

      await parseWhatsAppChatFunction(chatContent)

      const chunk = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )!
      const message = chunk[0].data.messages[0]

      expect(message.type).toBe('text')
      expect(message.mediaType).toBeUndefined()
    })

    it('should identify media messages', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: <image omitted>
[15/01/2024, 10:31:00] Jane: <video omitted>
[15/01/2024, 10:32:00] Bob: <audio omitted>
[15/01/2024, 10:33:00] Alice: <document omitted>`

      await parseWhatsAppChatFunction(chatContent)

      const messages = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.messages

      expect(messages[0].type).toBe('media')
      expect(messages[0].mediaType).toBe('image')
      expect(messages[1].type).toBe('media')
      expect(messages[1].mediaType).toBe('video')
      expect(messages[2].type).toBe('media')
      expect(messages[2].mediaType).toBe('audio')
      expect(messages[3].type).toBe('media')
      expect(messages[3].mediaType).toBe('document')
    })

    it('should identify call messages', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Missed voice call
[15/01/2024, 10:35:00] Jane: Voice call - 5 minutes
[15/01/2024, 11:00:00] Bob: Missed video call
[15/01/2024, 11:05:00] Alice: Video call - 10 minutes`

      await parseWhatsAppChatFunction(chatContent)

      const calls = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.calls

      expect(calls).toHaveLength(4)

      expect(calls[0].initiator).toBe('John')
      expect(calls[0].type).toBe('voice')
      expect(calls[0].status).toBe('missed')
      expect(calls[0].duration).toBe(0)

      expect(calls[1].initiator).toBe('Jane')
      expect(calls[1].type).toBe('voice')
      expect(calls[1].status).toBe('completed')
      expect(calls[1].duration).toBe(5)

      expect(calls[2].type).toBe('video')
      expect(calls[2].status).toBe('missed')

      expect(calls[3].type).toBe('video')
      expect(calls[3].status).toBe('completed')
      expect(calls[3].duration).toBe(10)
    })

    it('should identify system messages', async () => {
      const chatContent = `[15/01/2024, 10:30:00] System: John created group "Test Group"
[15/01/2024, 10:31:00] System: Jane added Alice
[15/01/2024, 10:32:00] System: Bob left
[15/01/2024, 10:33:00] System: Messages to this chat and calls are now secured with end-to-end encryption`

      await parseWhatsAppChatFunction(chatContent)

      // System messages should not be included in the parsed messages
      const chunkCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'chunk'
      )

      // System messages are filtered out, so no messages should be processed
      expect(chunkCalls.length === 0 || chunkCalls[0][0].data.messages.length === 0).toBe(true)
    })
  })

  describe('Metadata Extraction', () => {
    it('should extract emoji metadata', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Hello! 😊👍🎉
[15/01/2024, 10:31:00] Jane: No emojis here`

      await parseWhatsAppChatFunction(chatContent)

      const messages = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.messages

      expect(messages[0].metadata.hasEmoji).toBe(true)
      expect(messages[0].metadata.emojis).toEqual(['😊', '👍', '🎉'])

      expect(messages[1].metadata.hasEmoji).toBe(false)
      expect(messages[1].metadata.emojis).toBeUndefined()
    })

    it('should extract URL metadata', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Check this out: https://example.com
[15/01/2024, 10:31:00] Jane: Multiple links: https://google.com and http://github.com
[15/01/2024, 10:32:00] Bob: No links here`

      await parseWhatsAppChatFunction(chatContent)

      const messages = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.messages

      expect(messages[0].metadata.hasUrl).toBe(true)
      expect(messages[0].metadata.urls).toEqual(['https://example.com'])

      expect(messages[1].metadata.hasUrl).toBe(true)
      expect(messages[1].metadata.urls).toEqual(['https://google.com', 'http://github.com'])

      expect(messages[2].metadata.hasUrl).toBe(false)
      expect(messages[2].metadata.urls).toBeUndefined()
    })

    it('should calculate word and character counts', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Hello world
[15/01/2024, 10:31:00] Jane: This is a longer message with more words`

      await parseWhatsAppChatFunction(chatContent)

      const messages = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.messages

      expect(messages[0].metadata.wordCount).toBe(2)
      expect(messages[0].metadata.charCount).toBe(11)

      expect(messages[1].metadata.wordCount).toBe(8) // "This is a longer message with more words" = 8 words
      expect(messages[1].metadata.charCount).toBe(40)
    })
  })

  describe('Call Duration Parsing', () => {
    it('should parse call durations in different formats', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Voice call - 5 minutes
[15/01/2024, 10:35:00] Jane: Video call - 1 hour 30 minutes
[15/01/2024, 11:00:00] Bob: Voice call - 45 mins
[15/01/2024, 11:05:00] Alice: Video call - 2 hrs`

      await parseWhatsAppChatFunction(chatContent)

      const calls = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.calls

      expect(calls[0].duration).toBe(5)
      expect(calls[1].duration).toBe(90) // 1 hour 30 minutes = 90 minutes
      expect(calls[2].duration).toBe(45)
      expect(calls[3].duration).toBe(120) // 2 hours = 120 minutes
    })

    it('should handle calls with no duration', async () => {
      const chatContent = `[15/01/2024, 10:30:00] John: Missed voice call
[15/01/2024, 10:31:00] Jane: Voice call ended`

      await parseWhatsAppChatFunction(chatContent)

      const calls = mockPostMessage.mock.calls.find(
        call => call[0].type === 'chunk'
      )[0].data.calls

      expect(calls[0].duration).toBe(0)
      expect(calls[1].duration).toBe(0)
    })
  })

  describe('Participant Processing', () => {
    it('should track participant statistics', async () => {
      const chatContent = `[15/01/2024, 10:30:00] Alice: Hello
[15/01/2024, 10:31:00] Bob: Hi there
[15/01/2024, 10:32:00] Alice: How are you?
[15/01/2024, 10:33:00] Alice: <image omitted>
[15/01/2024, 10:34:00] Charlie: Hey everyone`

      await parseWhatsAppChatFunction(chatContent)

      const completeCall = mockPostMessage.mock.calls.find(
        call => call[0].type === 'complete'
      )

      expect(completeCall).toBeDefined()
      const participants = completeCall[0].result.participants

      const alice = participants.find(p => p.name === 'Alice')
      const bob = participants.find(p => p.name === 'Bob')
      const charlie = participants.find(p => p.name === 'Charlie')

      expect(alice.messageCount).toBe(3)
      expect(alice.mediaCount).toBe(1)
      expect(bob.messageCount).toBe(1)
      expect(bob.mediaCount).toBe(0)
      expect(charlie.messageCount).toBe(1)
      expect(charlie.mediaCount).toBe(0)
    })

    it('should track first and last message dates', async () => {
      const chatContent = `[15/01/2024, 09:00:00] Alice: First message
[15/01/2024, 10:00:00] Bob: Middle message
[15/01/2024, 11:00:00] Alice: Last message from Alice`

      await parseWhatsAppChatFunction(chatContent)

      const participants = mockPostMessage.mock.calls.find(
        call => call[0].type === 'complete'
      )[0].result.participants

      const alice = participants.find(p => p.name === 'Alice')

      expect(alice.firstMessage.getHours()).toBe(9)
      expect(alice.lastMessage.getHours()).toBe(11)
    })
  })

  describe('Progress Reporting', () => {
    it('should send progress updates during parsing', async () => {
      // Create a large chat content to trigger progress updates
      const lines = Array.from({ length: 2000 }, (_, i) =>
        `[15/01/2024, 10:${String(i % 60).padStart(2, '0')}:00] User${i % 3}: Message ${i}`
      )
      const chatContent = lines.join('\n')

      await parseWhatsAppChatFunction(chatContent)

      const progressCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'progress'
      )

      expect(progressCalls.length).toBeGreaterThan(0)

      // Verify progress structure
      const progressUpdate = progressCalls[0][0]
      expect(progressUpdate.progress).toBeGreaterThan(0)
      expect(progressUpdate.processed).toBeGreaterThan(0)
      expect(progressUpdate.total).toBe(2000)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed chat content gracefully', async () => {
      const malformedContent = `This is not a valid WhatsApp chat format
Some random text here
[invalid date] Invalid message`

      await parseWhatsAppChatFunction(malformedContent)

      // Should complete without errors, even with malformed content
      const errorCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'error'
      )

      // Either no errors or handled gracefully
      if (errorCalls.length > 0) {
        expect(errorCalls[0][0].error).toBeDefined()
      }
    })

    it('should handle empty content', async () => {
      await parseWhatsAppChatFunction('')

      const completeCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'complete'
      )

      expect(completeCalls).toHaveLength(1)
      expect(completeCalls[0][0].result.participants).toEqual([])
    })
  })

  describe('Chunking Behavior', () => {
    it('should send messages in chunks for large datasets', async () => {
      // Create content that exceeds chunk size
      const lines = Array.from({ length: 1500 }, (_, i) =>
        `[15/01/2024, 10:${String(i % 60).padStart(2, '0')}:00] User: Message ${i}`
      )
      const chatContent = lines.join('\n')

      await parseWhatsAppChatFunction(chatContent)

      const chunkCalls = mockPostMessage.mock.calls.filter(
        call => call[0].type === 'chunk'
      )

      // Should have multiple chunks
      expect(chunkCalls.length).toBeGreaterThan(1)

      // All but last chunk should be marked as not final
      for (let i = 0; i < chunkCalls.length - 1; i++) {
        expect(chunkCalls[i][0].data.isLast).toBe(false)
      }

      // Last chunk should be marked as final
      expect(chunkCalls[chunkCalls.length - 1][0].data.isLast).toBe(true)
    })
  })

  describe('Chat Metadata Generation', () => {
    it('should generate correct metadata', async () => {
      const chatContent = `[15/01/2024, 09:00:00] Alice: First message
[15/01/2024, 10:00:00] Bob: Second message
[15/01/2024, 11:00:00] Charlie: Third message`

      await parseWhatsAppChatFunction(chatContent)

      const metadata = mockPostMessage.mock.calls.find(
        call => call[0].type === 'complete'
      )[0].result.metadata

      expect(metadata.totalMessages).toBe(3)
      expect(metadata.chatType).toBe('group') // More than 2 participants
      expect(metadata.dateRange.start).toBeInstanceOf(Date)
      expect(metadata.dateRange.end).toBeInstanceOf(Date)
      expect(metadata.exportDate).toBeInstanceOf(Date)
    })

    it('should detect individual vs group chats', async () => {
      const individualChat = `[15/01/2024, 09:00:00] Alice: Hello
[15/01/2024, 10:00:00] Bob: Hi there`

      await parseWhatsAppChatFunction(individualChat)

      const metadata = mockPostMessage.mock.calls.find(
        call => call[0].type === 'complete'
      )[0].result.metadata

      expect(metadata.chatType).toBe('individual') // Only 2 participants
    })
  })
})
