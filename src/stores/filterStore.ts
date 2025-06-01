import { create } from 'zustand';
import { FilterState, ProcessedAnalytics, ParsedChat } from '../types';

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
  
  // Async filtering
  filterAndAnalyze: (chat: ParsedChat) => Promise<ProcessedAnalytics>;
}

const initialState: FilterState = {
  dateRange: null,
  selectedSenders: [],
  searchKeyword: '',
  messageTypes: ['text', 'media', 'call'],
};

// Create worker instance
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
    set({ ...initialState, searchInput: '' });
  },
  
  filterAndAnalyze: async (chat: ParsedChat): Promise<ProcessedAnalytics> => {
    return new Promise((resolve, reject) => {
      const state = get();
      const worker = getFilterWorker();
      
      set({ isFiltering: true });
      
      const handleMessage = (event: MessageEvent) => {
        const { type, analytics, error } = event.data;
        
        if (type === 'result') {
          worker.removeEventListener('message', handleMessage);
          set({ isFiltering: false });
          resolve(analytics);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          set({ isFiltering: false });
          reject(new Error(error));
        }
      };
      
      worker.addEventListener('message', handleMessage);
      
      worker.postMessage({
        type: 'filter',
        data: {
          chat,
          filters: {
            selectedSenders: state.selectedSenders,
            searchKeyword: state.searchKeyword,
            messageTypes: state.messageTypes,
            dateRange: state.dateRange
          }
        }
      });
    });
  }
}));