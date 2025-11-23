import { create } from 'zustand';
import { FilterState, ProcessedAnalytics, ParsedChat } from '../types';
import { performanceCache } from '../utils/cache';
import { performanceMonitor } from '../utils/performance';

interface FilterStore extends FilterState {
  // Loading state
  isFiltering: boolean;

  // Internal search state for debouncing
  searchInput: string;

  // Actions
  setDateRange: (range: [Date, Date] | null) => void;
  toggleSender: (sender: string) => void;
  setSelectedSenders: (senders: string[]) => void;
  setSearchInput: (input: string) => void;
  setSearchKeyword: (keyword: string) => void;
  toggleMessageType: (type: 'text' | 'media' | 'call') => void;
  resetFilters: () => void;

  // Async filtering and analytics
  filterAndAnalyze: (chat: ParsedChat) => Promise<{ analytics: ProcessedAnalytics; filteredChat: ParsedChat }>;
  filterOnly: (chat: ParsedChat) => Promise<ParsedChat>;
  analyzeOnly: (chat: ParsedChat) => Promise<ProcessedAnalytics>;
  initializeIndices: (chat: ParsedChat) => Promise<void>;

  // Performance monitoring
  getPerformanceStats: () => {
    monitor: unknown;
    cache: unknown;
    insights: string[];
  };
}

const initialState: FilterState = {
  dateRange: null,
  selectedSenders: [],
  searchKeyword: '',
  messageTypes: ['text', 'media', 'call'],
};

let filterWorker: Worker | null = null;
let searchDebounceTimer: number | null = null;

const getFilterWorker = () => {
  if (!filterWorker) {
    filterWorker = new Worker(new URL('../workers/filter.worker.ts', import.meta.url), {
      type: 'module'
    });
  }
  return filterWorker;
};

// Generate chat hash for caching
const generateChatHash = (chat: ParsedChat): string => {
  return `${chat.messages.length}_${chat.calls.length}_${chat.metadata.totalMessages}`;
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...initialState,
  isFiltering: false,
  searchInput: '',

  setDateRange: (range) => set({ dateRange: range }),

  toggleSender: (sender) => set((state) => ({
    selectedSenders: state.selectedSenders.includes(sender)
      ? state.selectedSenders.filter(s => s !== sender)
      : [...state.selectedSenders, sender]
  })),

  setSelectedSenders: (senders) => set({ selectedSenders: senders }),

  setSearchInput: (input) => {
    set({ searchInput: input });

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Set new timer
    searchDebounceTimer = window.setTimeout(() => {
      set({ searchKeyword: input });
    }, 300);
  },

  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),

  toggleMessageType: (type) => set((state) => ({
    messageTypes: state.messageTypes.includes(type)
      ? state.messageTypes.filter(t => t !== type)
      : [...state.messageTypes, type] as Array<'text' | 'media' | 'call'>
  })),

  resetFilters: () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    // Don't clear performance cache on filter reset, only UI state
    set({
      ...initialState,
      searchInput: '',
      isFiltering: false
    });
  },

  initializeIndices: async (chat: ParsedChat): Promise<void> => {
    return new Promise((resolve, reject) => {
      const chatHash = generateChatHash(chat);

      const worker = getFilterWorker();
      const measurement = performanceMonitor.startMeasurement('build-indices');

      const handleMessage = (event: MessageEvent) => {
        const { type, error, processingTime } = event.data;

        if (type === 'indices-built') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, {
            dataSize: chat.messages.length,
            processingTime,
          });
          resolve();
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, { error: true });
          reject(new Error(error));
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        type: 'build-indices',
        data: { chat, chatHash }
      });
    });
  },

  filterOnly: async (chat: ParsedChat): Promise<ParsedChat> => {
    return new Promise((resolve, reject) => {
      const state = get();
      const chatHash = generateChatHash(chat);
      const worker = getFilterWorker();
      const measurement = performanceMonitor.startMeasurement('filter-only');

      const handleMessage = (event: MessageEvent) => {
        const { type, filteredChat, error, cacheHit, processingTime } = event.data;

        if (type === 'filter-result') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, {
            cacheHit,
            dataSize: chat.messages.length,
            filteredSize: filteredChat.messages.length,
            processingTime,
          });
          resolve(filteredChat);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, { error: true });
          reject(new Error(error));
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        type: 'filter',
        data: {
          chat,
          chatHash,
          filters: {
            selectedSenders: state.selectedSenders,
            searchKeyword: state.searchKeyword,
            messageTypes: state.messageTypes,
            dateRange: state.dateRange
          }
        }
      });
    });
  },

  analyzeOnly: async (chat: ParsedChat): Promise<ProcessedAnalytics> => {
    return new Promise((resolve, reject) => {
      const worker = getFilterWorker();
      const measurement = performanceMonitor.startMeasurement('analyze-only');

      const handleMessage = (event: MessageEvent) => {
        const { type, analytics, error, cacheHit, processingTime } = event.data;

        if (type === 'analyze-result') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, {
            cacheHit,
            dataSize: chat.messages.length,
            processingTime,
          });
          resolve(analytics);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          performanceMonitor.endMeasurement(measurement, { error: true });
          reject(new Error(error));
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({
        type: 'analyze',
        data: { chat }
      });
    });
  },

  filterAndAnalyze: async (chat: ParsedChat): Promise<{ analytics: ProcessedAnalytics; filteredChat: ParsedChat }> => {
    const state = get();
    const measurement = performanceMonitor.startMeasurement('filter-and-analyze');

    // Set loading state at the beginning
    set({ isFiltering: true });

    try {
      // First filter the data
      const filteredChat = await state.filterOnly(chat);

      // Then analyze the filtered result
      const analytics = await state.analyzeOnly(filteredChat);

      performanceMonitor.endMeasurement(measurement, {
        dataSize: chat.messages.length,
        filteredSize: filteredChat.messages.length,
      });

      // Clear loading state only after everything is done
      set({ isFiltering: false });

      return { analytics, filteredChat };
    } catch (error) {
      performanceMonitor.endMeasurement(measurement, { error: true });
      set({ isFiltering: false });
      throw error;
    }
  },

  getPerformanceStats: () => {
    return {
      monitor: performanceMonitor.getStats(),
      cache: performanceCache.getStats(),
      insights: performanceMonitor.getInsights(),
    };
  }
}));
