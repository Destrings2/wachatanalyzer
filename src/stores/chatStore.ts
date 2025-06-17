import { create } from 'zustand';
import { Message, Call, Participant, ChatMetadata, ProcessedAnalytics } from '../types';
import { parseWhatsAppChatWithWorker } from '../utils/parserWorker';
import { analyzeChat } from '../utils/analyzer';
import { performanceCache } from '../utils/cache';

interface ChatStore {
  // Raw Data
  rawMessages: Message[];
  rawCalls: Call[];
  participants: Participant[];
  metadata: ChatMetadata | null;
  
  // Processed Data
  analytics: ProcessedAnalytics | null;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
  progress: number;
  
  // Actions
  loadChatFile: (file: File) => Promise<void>;
  clearData: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  // Initial state
  rawMessages: [],
  rawCalls: [],
  participants: [],
  metadata: null,
  analytics: null,
  isLoading: false,
  error: null,
  progress: 0,
  
  // Actions
  loadChatFile: async (file: File) => {
    set({ isLoading: true, error: null, progress: 0 });
    
    // Clear all caches when loading new data
    performanceCache.clearAll();
    
    try {
      // Read file content in chunks for large files
      const text = await file.text();
      
      // Parse chat data using Web Worker with progress updates
      const parsedData = await parseWhatsAppChatWithWorker(text, (progress) => {
        set({ progress });
      });
      
      // Analyze chat data in main thread (could also be moved to worker)
      const analytics = analyzeChat(parsedData);
      
      set({
        rawMessages: parsedData.messages,
        rawCalls: parsedData.calls,
        participants: parsedData.participants,
        metadata: parsedData.metadata,
        analytics,
        isLoading: false,
        progress: 100,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load chat file',
        isLoading: false,
      });
    }
  },
  
  clearData: () => {
    set({
      rawMessages: [],
      rawCalls: [],
      participants: [],
      metadata: null,
      analytics: null,
      error: null,
      progress: 0,
    });
  },
}));