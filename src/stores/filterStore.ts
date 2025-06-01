import { create } from 'zustand';
import { FilterState } from '../types';

interface FilterStore extends FilterState {
  // Actions
  setDateRange: (range: [Date, Date] | null) => void;
  toggleSender: (sender: string) => void;
  setSelectedSenders: (senders: string[]) => void;
  setSearchKeyword: (keyword: string) => void;
  toggleMessageType: (type: 'text' | 'media' | 'call') => void;
  resetFilters: () => void;
}

const initialState: FilterState = {
  dateRange: null,
  selectedSenders: [],
  searchKeyword: '',
  messageTypes: ['text', 'media', 'call'],
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...initialState,
  
  setDateRange: (range) => set({ dateRange: range }),
  
  toggleSender: (sender) => set((state) => ({
    selectedSenders: state.selectedSenders.includes(sender)
      ? state.selectedSenders.filter(s => s !== sender)
      : [...state.selectedSenders, sender]
  })),
  
  setSelectedSenders: (senders) => set({ selectedSenders: senders }),
  
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  
  toggleMessageType: (type) => set((state) => ({
    messageTypes: state.messageTypes.includes(type)
      ? state.messageTypes.filter(t => t !== type)
      : [...state.messageTypes, type] as Array<'text' | 'media' | 'call'>
  })),
  
  resetFilters: () => set(initialState),
}));