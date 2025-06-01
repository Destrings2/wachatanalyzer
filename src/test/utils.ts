import { ParsedChat, Message, Call, Participant, ChatMetadata } from '../types'

/**
 * Creates mock message data for testing
 */
export function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    datetime: new Date('2024-01-15T10:30:00Z'),
    timestamp: 1705312200000,
    sender: 'John Doe',
    content: 'Hello world',
    type: 'text',
    metadata: {
      hasEmoji: false,
      emojis: [],
      hasUrl: false,
      urls: [],
      wordCount: 2,
      charCount: 11
    },
    ...overrides
  }
}

/**
 * Creates mock call data for testing
 */
export function createMockCall(overrides: Partial<Call> = {}): Call {
  return {
    datetime: new Date('2024-01-15T10:30:00Z'),
    timestamp: 1705312200000,
    initiator: 'John Doe',
    type: 'voice',
    status: 'completed',
    duration: 5,
    ...overrides
  }
}

/**
 * Creates mock participant data for testing
 */
export function createMockParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    name: 'John Doe',
    messageCount: 10,
    mediaCount: 2,
    firstMessage: new Date('2024-01-01T00:00:00Z'),
    lastMessage: new Date('2024-01-15T10:30:00Z'),
    ...overrides
  }
}

/**
 * Creates mock chat metadata for testing
 */
export function createMockChatMetadata(overrides: Partial<ChatMetadata> = {}): ChatMetadata {
  return {
    exportDate: new Date('2024-01-15T12:00:00Z'),
    totalMessages: 100,
    totalCalls: 5,
    dateRange: {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-15T10:30:00Z')
    },
    chatType: 'individual',
    ...overrides
  }
}

/**
 * Creates a complete mock chat for testing
 */
export function createMockChat(overrides: Partial<ParsedChat> = {}): ParsedChat {
  const messages = overrides.messages || [
    createMockMessage({ 
      sender: 'Alice', 
      content: 'Good morning everyone!',
      datetime: new Date('2024-01-15T09:00:00Z')
    }),
    createMockMessage({ 
      sender: 'Bob', 
      content: 'Hello Alice, how are you?',
      datetime: new Date('2024-01-15T09:15:00Z')
    }),
    createMockMessage({ 
      sender: 'Alice', 
      content: 'I\'m doing great, thanks for asking! 😊',
      datetime: new Date('2024-01-15T09:20:00Z'),
      metadata: {
        hasEmoji: true,
        emojis: ['😊'],
        hasUrl: false,
        urls: [],
        wordCount: 7,
        charCount: 42
      }
    }),
    createMockMessage({
      sender: 'Charlie',
      content: 'Check out this link: https://example.com',
      datetime: new Date('2024-01-15T10:00:00Z'),
      metadata: {
        hasEmoji: false,
        emojis: [],
        hasUrl: true,
        urls: ['https://example.com'],
        wordCount: 6,
        charCount: 39
      }
    }),
    createMockMessage({
      sender: 'Bob',
      content: '',
      type: 'media',
      mediaType: 'image',
      datetime: new Date('2024-01-15T10:30:00Z')
    })
  ]

  const calls = overrides.calls || [
    createMockCall({
      initiator: 'Alice',
      type: 'voice',
      status: 'completed',
      duration: 10,
      datetime: new Date('2024-01-15T11:00:00Z')
    }),
    createMockCall({
      initiator: 'Bob',
      type: 'video',
      status: 'missed',
      duration: 0,
      datetime: new Date('2024-01-15T11:30:00Z')
    })
  ]

  const participants = overrides.participants || [
    createMockParticipant({ 
      name: 'Alice', 
      messageCount: 2, 
      mediaCount: 0 
    }),
    createMockParticipant({ 
      name: 'Bob', 
      messageCount: 2, 
      mediaCount: 1 
    }),
    createMockParticipant({ 
      name: 'Charlie', 
      messageCount: 1, 
      mediaCount: 0 
    })
  ]

  return {
    messages,
    calls,
    participants,
    metadata: createMockChatMetadata({
      totalMessages: messages.length,
      totalCalls: calls.length
    }),
    ...overrides
  }
}

/**
 * Creates a search test scenario with specific content
 */
export function createSearchTestChat(): ParsedChat {
  return createMockChat({
    messages: [
      createMockMessage({
        sender: 'Alice',
        content: 'Hello world',
        datetime: new Date('2024-01-15T09:00:00Z')
      }),
      createMockMessage({
        sender: 'Bob',
        content: 'Good morning Alice',
        datetime: new Date('2024-01-15T09:15:00Z')
      }),
      createMockMessage({
        sender: 'Alice',
        content: 'Let\'s schedule a meeting tomorrow',
        datetime: new Date('2024-01-15T09:20:00Z')
      }),
      createMockMessage({
        sender: 'Charlie',
        content: 'Meeting sounds good to me',
        datetime: new Date('2024-01-15T09:25:00Z')
      }),
      createMockMessage({
        sender: 'Bob',
        content: 'Can we make it a video call instead?',
        datetime: new Date('2024-01-15T09:30:00Z')
      }),
      createMockMessage({
        sender: 'Alice',
        content: 'Sure, video meeting it is!',
        datetime: new Date('2024-01-15T09:35:00Z')
      }),
      createMockMessage({
        sender: 'Dave',
        content: 'Sorry, I can\'t attend the meeting',
        datetime: new Date('2024-01-15T09:40:00Z')
      }),
      createMockMessage({
        sender: 'Bob',
        content: '',
        type: 'media',
        mediaType: 'image',
        datetime: new Date('2024-01-15T10:00:00Z')
      })
    ]
  })
}