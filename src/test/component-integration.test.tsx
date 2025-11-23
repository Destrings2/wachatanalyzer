import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../App';
import { useChatStore } from '../stores/chatStore';
import { useUIStore } from '../stores/uiStore';

// Mock stores
vi.mock('../stores/chatStore');
vi.mock('../stores/uiStore');

const mockUseChatStore = vi.mocked(useChatStore);
const mockUseUIStore = vi.mocked(useUIStore);

// Mock Web Workers
vi.mock('../utils/parserWorker', () => ({
  parseWhatsAppChatWithWorker: vi.fn(),
}));

// Mock D3 for chart components
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    selectAll: vi.fn(() => ({ remove: vi.fn() })),
    append: vi.fn(() => ({ attr: vi.fn(), text: vi.fn() })),
    attr: vi.fn(),
    node: vi.fn(() => ({ getBoundingClientRect: () => ({ width: 800, height: 600 }) })),
  })),
  scaleLinear: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
  })),
  scaleBand: vi.fn(() => ({
    domain: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    bandwidth: vi.fn(() => 20),
  })),
  axisBottom: vi.fn(),
  axisLeft: vi.fn(),
  max: vi.fn(),
  extent: vi.fn(),
}));

// Mock chart components to avoid D3 complexity in integration tests
vi.mock('../components/charts/WordCloud', () => ({
  WordCloud: () => <div data-testid="word-cloud">Word Cloud Chart</div>,
}));

vi.mock('../components/charts/ActivityTimeline', () => ({
  ActivityTimeline: () => <div data-testid="activity-timeline">Activity Timeline Chart</div>,
}));

describe('Component Integration Tests', () => {
  const mockLoadChatFile = vi.fn();
  const mockSetActiveView = vi.fn();
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default store mocks
    mockUseChatStore.mockReturnValue({
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      isLoading: false,
      error: null,
      progress: 0,
      loadChatFile: mockLoadChatFile,
      clearData: vi.fn(),
    });

    mockUseUIStore.mockReturnValue({
      theme: 'light',
      activeView: 'upload',
      sidebarCollapsed: false,
      chartSettings: { separateMessagesBySender: false },
      setActiveView: mockSetActiveView,
      toggleTheme: mockToggleTheme,
      toggleSidebar: vi.fn(),
      setSidebarCollapsed: vi.fn(),
      updateChartSettings: vi.fn(),
      setTheme: vi.fn(),
      initializeTheme: vi.fn(),
      initializeSidebar: vi.fn(),
      initializeChartSettings: vi.fn(),
    });
  });

  describe('App Component Integration', () => {
    it('renders FileUploader when activeView is upload', () => {
      render(<App />);

      expect(screen.getByText('WhatsApp Chat')).toBeInTheDocument();
      expect(screen.getByText('Analyzer')).toBeInTheDocument();
      expect(screen.getByText('Unlock insights from your conversations with beautiful, interactive visualizations.')).toBeInTheDocument();
    });

    it('switches to dashboard when data is loaded', () => {
      // Mock with loaded data
      mockUseChatStore.mockReturnValue({
        rawMessages: [
          {
            id: '1',
            datetime: new Date(),
            timestamp: Date.now(),
            sender: 'John',
            content: 'Hello',
            type: 'text',
            metadata: { hasEmoji: false, hasUrl: false, wordCount: 1, charCount: 5 },
          }
        ],
        rawCalls: [],
        participants: [],
        metadata: null,
        analytics: null,
        isLoading: false,
        error: null,
        progress: 100,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });

      render(<App />);

      expect(mockSetActiveView).toHaveBeenCalledWith('dashboard');
    });

    it('handles file upload workflow', async () => {
      const user = userEvent.setup();
      render(<App />);

      const file = new File(['chat content'], 'chat.txt', { type: 'text/plain' });
      // Find the hidden file input
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeTruthy();

      await user.upload(input, file);

      expect(mockLoadChatFile).toHaveBeenCalledWith(file);
    });
  });

  describe('Dashboard Integration', () => {
    const mockAnalytics = {
      messageStats: {
        totalMessages: 100,
        messagesPerSender: { John: 60, Alice: 40 },
        mediaPerSender: { John: 5, Alice: 3 },
        averageMessageLength: 25,
        totalWords: 500,
        totalCharacters: 2500,
      },
      timePatterns: {
        hourlyActivity: { John: { 9: 10, 10: 15 }, Alice: { 9: 5, 10: 8 } },
        dailyActivity: { John: { '2024-01-01': 25 }, Alice: { '2024-01-01': 15 } },
        weeklyActivity: { John: { 1: 30 }, Alice: { 1: 20 } },
        monthlyActivity: { John: { '2024-01': 60 }, Alice: { '2024-01': 40 } },
      },
      emojiAnalysis: {
        totalEmojis: 50,
        uniqueEmojis: 20,
        emojiFrequency: { '😀': 10, '❤️': 8 },
        emojisPerSender: { John: { '😀': 6 }, Alice: { '❤️': 5 } },
        topEmojis: [{ emoji: '😀', count: 10 }, { emoji: '❤️', count: 8 }],
      },
      wordFrequency: {
        topWords: [{ word: 'hello', count: 20 }, { word: 'world', count: 15 }],
        wordCloud: { hello: 20, world: 15 },
        uniqueWords: 100,
      },
      responseMetrics: {
        averageResponseTime: 30,
        responseTimePerSender: { John: 25, Alice: 35 },
        conversationInitiators: { John: 40, Alice: 20 },
      },
      callAnalytics: {
        totalCalls: 10,
        completedCalls: 8,
        missedCalls: 2,
        averageDuration: 300,
        callsByHour: { 10: 3, 14: 5 },
        callsByDay: { 1: 4, 2: 6 },
      },
    };

    const mockMetadata = {
      exportDate: new Date('2024-01-01'),
      totalMessages: 100,
      totalCalls: 10,
      dateRange: {
        start: new Date('2023-12-01'),
        end: new Date('2024-01-01'),
      },
      chatType: 'individual' as const,
    };

    const mockParticipants = [
      {
        name: 'John',
        messageCount: 60,
        mediaCount: 5,
        firstMessage: new Date('2023-12-01'),
        lastMessage: new Date('2024-01-01'),
      },
      {
        name: 'Alice',
        messageCount: 40,
        mediaCount: 3,
        firstMessage: new Date('2023-12-05'),
        lastMessage: new Date('2023-12-30'),
      },
    ];

    beforeEach(() => {
      // Setup dashboard view with data
      mockUseUIStore.mockReturnValue({
        theme: 'light',
        activeView: 'dashboard',
        sidebarCollapsed: false,
        chartSettings: { separateMessagesBySender: false },
        setActiveView: mockSetActiveView,
        toggleTheme: mockToggleTheme,
        toggleSidebar: vi.fn(),
        setSidebarCollapsed: vi.fn(),
        updateChartSettings: vi.fn(),
        setTheme: vi.fn(),
        initializeTheme: vi.fn(),
        initializeSidebar: vi.fn(),
        initializeChartSettings: vi.fn(),
      });

      mockUseChatStore.mockReturnValue({
        rawMessages: [],
        rawCalls: [],
        participants: mockParticipants,
        metadata: mockMetadata,
        analytics: mockAnalytics,
        isLoading: false,
        error: null,
        progress: 100,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });
    });

    it('renders dashboard with navigation and content', () => {
      render(<App />);

      expect(screen.getByText('Analyzer')).toBeInTheDocument();
      expect(screen.getAllByText('Overview').length).toBeGreaterThan(0); // At least one Overview element exists
      expect(screen.getByText('Word Cloud')).toBeInTheDocument();
      expect(screen.getByText('Activity Timeline')).toBeInTheDocument();
    });

    it('allows navigation between chart views', async () => {
      const user = userEvent.setup();
      render(<App />);

      const timelineButton = screen.getByRole('button', { name: /Activity Timeline/i });
      await user.click(timelineButton);

      // Check that the button is now selected (has gradient background)
      expect(timelineButton).toHaveClass('from-primary-500/10');
    });

    it('displays theme toggle functionality', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Find theme toggle button by looking for Moon or Sun icon
      const themeButton = document.querySelector('button svg.lucide-moon, button svg.lucide-sun')?.closest('button');
      expect(themeButton).toBeTruthy();
      await user.click(themeButton!);

      expect(mockToggleTheme).toHaveBeenCalledOnce();
    });

    it('shows sidebar toggle on mobile', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Find sidebar toggle buttons (Menu or X icons)
      const sidebarButtons = document.querySelectorAll('button svg.lucide-menu, button svg.lucide-x');
      expect(sidebarButtons.length).toBeGreaterThan(0);

      const firstButton = sidebarButtons[0].closest('button');
      await user.click(firstButton!);
      // Sidebar toggle functionality should be called
    });
  });

  describe('Error Handling Integration', () => {
    it('displays error state in FileUploader', () => {
      mockUseChatStore.mockReturnValue({
        rawMessages: [],
        rawCalls: [],
        participants: [],
        metadata: null,
        analytics: null,
        isLoading: false,
        error: 'Failed to parse chat file',
        progress: 0,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Failed to parse chat file')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows loading state during file processing', () => {
      mockUseChatStore.mockReturnValue({
        rawMessages: [],
        rawCalls: [],
        participants: [],
        metadata: null,
        analytics: null,
        isLoading: true,
        error: null,
        progress: 50,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });

      render(<App />);

      expect(screen.getByText('Analyzing your chat...')).toBeInTheDocument();
      // Look for the loading spinner by class or other identifier
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Theme Integration', () => {
    it('applies dark theme classes when theme is dark', () => {
      mockUseUIStore.mockReturnValue({
        theme: 'dark',
        activeView: 'upload',
        sidebarCollapsed: false,
        chartSettings: { separateMessagesBySender: false },
        setActiveView: mockSetActiveView,
        toggleTheme: mockToggleTheme,
        toggleSidebar: vi.fn(),
        setSidebarCollapsed: vi.fn(),
        updateChartSettings: vi.fn(),
        setTheme: vi.fn(),
        initializeTheme: vi.fn(),
        initializeSidebar: vi.fn(),
        initializeChartSettings: vi.fn(),
      });

      render(<App />);

      // Check that dark theme is applied to document root
      // The useTheme hook should add 'dark' class to document.documentElement
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('Responsive Design Integration', () => {
    it('handles mobile layout correctly', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<App />);

      // Should render mobile-friendly layout
      expect(screen.getByText('WhatsApp Chat')).toBeInTheDocument();
    });
  });

  describe('Data Flow Integration', () => {
    it('passes data correctly from stores to components', () => {
      const mockMessages = [
        {
          id: '1',
          datetime: new Date(),
          timestamp: Date.now(),
          sender: 'John',
          content: 'Hello world',
          type: 'text' as const,
          metadata: { hasEmoji: false, hasUrl: false, wordCount: 2, charCount: 11 },
        }
      ];

      mockUseChatStore.mockReturnValue({
        rawMessages: mockMessages,
        rawCalls: [],
        participants: [
          {
            name: 'John',
            messageCount: 1,
            mediaCount: 0,
            firstMessage: new Date(),
            lastMessage: new Date(),
          }
        ],
        metadata: {
          exportDate: new Date(),
          totalMessages: 1,
          totalCalls: 0,
          dateRange: { start: new Date(), end: new Date() },
          chatType: 'individual',
        },
        analytics: {
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
        },
        isLoading: false,
        error: null,
        progress: 100,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });

      mockUseUIStore.mockReturnValue({
        theme: 'light',
        activeView: 'dashboard',
        sidebarCollapsed: false,
        chartSettings: { separateMessagesBySender: false },
        setActiveView: mockSetActiveView,
        toggleTheme: mockToggleTheme,
        toggleSidebar: vi.fn(),
        setSidebarCollapsed: vi.fn(),
        updateChartSettings: vi.fn(),
        setTheme: vi.fn(),
        initializeTheme: vi.fn(),
        initializeSidebar: vi.fn(),
        initializeChartSettings: vi.fn(),
      });

      render(<App />);

      // Should display data from the stores
      expect(screen.getByText('John')).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('handles large datasets without crashing', async () => {
      const largeMessageSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        datetime: new Date(),
        timestamp: Date.now(),
        sender: `User${i % 10}`,
        content: `Message ${i}`,
        type: 'text' as const,
        metadata: { hasEmoji: false, hasUrl: false, wordCount: 2, charCount: 10 },
      }));

      mockUseChatStore.mockReturnValue({
        rawMessages: largeMessageSet,
        rawCalls: [],
        participants: [],
        metadata: {
          exportDate: new Date(),
          totalMessages: 1000,
          totalCalls: 0,
          dateRange: { start: new Date(), end: new Date() },
          chatType: 'group',
        },
        analytics: null,
        isLoading: false,
        error: null,
        progress: 100,
        loadChatFile: mockLoadChatFile,
        clearData: vi.fn(),
      });

      mockUseUIStore.mockReturnValue({
        theme: 'light',
        activeView: 'dashboard',
        sidebarCollapsed: false,
        chartSettings: { separateMessagesBySender: false },
        setActiveView: mockSetActiveView,
        toggleTheme: mockToggleTheme,
        toggleSidebar: vi.fn(),
        setSidebarCollapsed: vi.fn(),
        updateChartSettings: vi.fn(),
        setTheme: vi.fn(),
        initializeTheme: vi.fn(),
        initializeSidebar: vi.fn(),
        initializeChartSettings: vi.fn(),
      });

      // Just test that the component renders without crashing with large data
      const { container } = render(<App />);

      // Verify that the component rendered something (not just an empty div)
      expect(container.firstChild).toBeTruthy();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });
  });
});