import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from './chatStore';
import * as parserWorker from '../utils/parserWorker';
import * as analyzer from '../utils/analyzer';
import { performanceCache } from '../utils/cache';
import { ParsedChat } from '../types';

// Mock dependencies
vi.mock('../utils/parserWorker');
vi.mock('../utils/analyzer');
vi.mock('../utils/cache');

const mockParseWhatsAppChatWithWorker = vi.mocked(parserWorker.parseWhatsAppChatWithWorker);
const mockAnalyzeChat = vi.mocked(analyzer.analyzeChat);
const mockPerformanceCache = vi.mocked(performanceCache);

// Mock data
const mockParsedData = {
  messages: [
    {
      id: '1',
      datetime: new Date('2024-01-01T10:00:00Z'),
      timestamp: 1704110400000,
      sender: 'John',
      content: 'Hello world',
      type: 'text' as const,
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
    exportDate: new Date('2024-01-01T00:00:00Z'),
    totalMessages: 1,
    totalCalls: 0,
    dateRange: {
      start: new Date('2024-01-01T10:00:00Z'),
      end: new Date('2024-01-01T10:00:00Z'),
    },
    chatType: 'individual' as const,
  },
};

const mockAnalytics = {
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
    emojisPerSender: {},
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

// Mock File.prototype.text method
File.prototype.text = vi.fn().mockResolvedValue('chat content');

// Helper function to create a File with mocked text method
function createMockFile(content: string | string[], filename: string = 'chat.txt'): File {
  const file = new File(Array.isArray(content) ? content : [content], filename, { type: 'text/plain' });
  const textContent = Array.isArray(content) ? content.join('') : content;
  file.text = vi.fn().mockResolvedValue(textContent);
  return file;
}

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      isLoading: false,
      error: null,
      progress: 0,
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockParseWhatsAppChatWithWorker.mockResolvedValue(mockParsedData);
    mockAnalyzeChat.mockReturnValue(mockAnalytics);
    mockPerformanceCache.clearAll = vi.fn();

    // Reset File.prototype.text mock
    globalThis.File.prototype.text = vi.fn().mockResolvedValue('chat content');
  });

  describe('loadChatFile', () => {
    it('successfully loads and processes a chat file', async () => {
      const file = createMockFile('chat content');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      const state = useChatStore.getState();

      expect(state.rawMessages).toEqual(mockParsedData.messages);
      expect(state.rawCalls).toEqual(mockParsedData.calls);
      expect(state.participants).toEqual(mockParsedData.participants);
      expect(state.metadata).toEqual(mockParsedData.metadata);
      expect(state.analytics).toEqual(mockAnalytics);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.progress).toBe(100);
    });

    it('sets loading state during processing', async () => {
      const file = createMockFile('chat content');

      // Mock a delayed response
      let resolveParser: (value: ParsedChat) => void;
      const parserPromise = new Promise<ParsedChat>(resolve => {
        resolveParser = resolve;
      });
      mockParseWhatsAppChatWithWorker.mockReturnValue(parserPromise);

      const { loadChatFile } = useChatStore.getState();

      const loadPromise = loadChatFile(file);

      // Check loading state
      expect(useChatStore.getState().isLoading).toBe(true);
      expect(useChatStore.getState().error).toBeNull();
      expect(useChatStore.getState().progress).toBe(0);

      // Resolve the parser
      resolveParser!(mockParsedData);
      await loadPromise;

      expect(useChatStore.getState().isLoading).toBe(false);
    });

    it('clears cache before loading new data', async () => {
      const file = createMockFile('chat content');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockPerformanceCache.clearAll).toHaveBeenCalledOnce();
    });

    it('calls parser worker with file content', async () => {
      const fileContent = 'chat content';
      const file = createMockFile(fileContent);

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockParseWhatsAppChatWithWorker).toHaveBeenCalledWith(fileContent, expect.any(Function));
    });

    it('calls analyzer with parsed data', async () => {
      const file = createMockFile('chat content');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockAnalyzeChat).toHaveBeenCalledWith(mockParsedData);
    });

    it('handles parser errors gracefully', async () => {
      const file = createMockFile('invalid content');
      const errorMessage = 'Failed to parse chat file';

      mockParseWhatsAppChatWithWorker.mockRejectedValueOnce(new Error(errorMessage));

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      const state = useChatStore.getState();

      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
      expect(state.rawMessages).toEqual([]);
      expect(state.analytics).toBeNull();
    });

    it('handles analyzer errors gracefully', async () => {
      const file = createMockFile('chat content');
      const errorMessage = 'Failed to analyze chat data';

      mockAnalyzeChat.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      const state = useChatStore.getState();

      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });

    it('handles non-Error exceptions', async () => {
      const file = createMockFile('content');

      mockParseWhatsAppChatWithWorker.mockRejectedValueOnce('String error');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      const state = useChatStore.getState();

      expect(state.error).toBe('Failed to load chat file');
      expect(state.isLoading).toBe(false);
    });

    it('clears previous error state when loading new file', async () => {
      // Set initial error state
      useChatStore.setState({ error: 'Previous error' });

      const file = createMockFile('chat content');

      const { loadChatFile } = useChatStore.getState();

      const loadPromise = loadChatFile(file);

      // Error should be cleared immediately when starting load
      expect(useChatStore.getState().error).toBeNull();

      await loadPromise;
    });

    it('resets progress when starting new load', async () => {
      // Set initial progress
      useChatStore.setState({ progress: 50 });

      const file = createMockFile('chat content');

      const { loadChatFile } = useChatStore.getState();

      const loadPromise = loadChatFile(file);

      // Progress should be reset to 0
      expect(useChatStore.getState().progress).toBe(0);

      await loadPromise;

      // Should be 100 when complete
      expect(useChatStore.getState().progress).toBe(100);
    });
  });

  describe('clearData', () => {
    it('resets all store state to initial values', () => {
      // Set some state
      useChatStore.setState({
        rawMessages: mockParsedData.messages,
        rawCalls: mockParsedData.calls,
        participants: mockParsedData.participants,
        metadata: mockParsedData.metadata,
        analytics: mockAnalytics,
        error: 'Some error',
        progress: 100,
      });

      const { clearData } = useChatStore.getState();
      clearData();

      const state = useChatStore.getState();

      expect(state.rawMessages).toEqual([]);
      expect(state.rawCalls).toEqual([]);
      expect(state.participants).toEqual([]);
      expect(state.metadata).toBeNull();
      expect(state.analytics).toBeNull();
      expect(state.error).toBeNull();
      expect(state.progress).toBe(0);
    });
  });

  describe('store subscription', () => {
    it('notifies subscribers of state changes', () => {
      const subscriber = vi.fn();

      const unsubscribe = useChatStore.subscribe(subscriber);

      const { clearData } = useChatStore.getState();
      clearData();

      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it('can unsubscribe from state changes', () => {
      const subscriber = vi.fn();

      const unsubscribe = useChatStore.subscribe(subscriber);
      unsubscribe();

      const { clearData } = useChatStore.getState();
      clearData();

      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('file reading edge cases', () => {
    it('handles large files', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB file
      const file = createMockFile(largeContent, 'large-chat.txt');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockParseWhatsAppChatWithWorker).toHaveBeenCalledWith(largeContent, expect.any(Function));
    });

    it('handles empty files', async () => {
      const file = createMockFile('', 'empty.txt');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockParseWhatsAppChatWithWorker).toHaveBeenCalledWith('', expect.any(Function));
    });

    it('handles files with special characters', async () => {
      const specialContent = '🔥 Special characters: àáâãäå çèéêë';
      const file = createMockFile(specialContent, 'special.txt');

      const { loadChatFile } = useChatStore.getState();

      await loadChatFile(file);

      expect(mockParseWhatsAppChatWithWorker).toHaveBeenCalledWith(specialContent, expect.any(Function));
    });
  });

  describe('state consistency', () => {
    it('maintains state consistency during loading', async () => {
      const file = createMockFile('content');

      let resolveParser: (value: ParsedChat) => void;
      const parserPromise = new Promise<ParsedChat>(resolve => {
        resolveParser = resolve;
      });
      mockParseWhatsAppChatWithWorker.mockReturnValue(parserPromise);

      const { loadChatFile } = useChatStore.getState();

      const loadPromise = loadChatFile(file);

      // State should be consistent during loading
      const loadingState = useChatStore.getState();
      expect(loadingState.isLoading).toBe(true);
      expect(loadingState.error).toBeNull();
      expect(loadingState.rawMessages).toEqual([]);
      expect(loadingState.analytics).toBeNull();

      resolveParser!(mockParsedData);
      await loadPromise;

      // State should be consistent after loading
      const loadedState = useChatStore.getState();
      expect(loadedState.isLoading).toBe(false);
      expect(loadedState.error).toBeNull();
      expect(loadedState.rawMessages).not.toEqual([]);
      expect(loadedState.analytics).not.toBeNull();
    });
  });
});
