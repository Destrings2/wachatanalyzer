import { ParsedChat, ProcessedAnalytics, FilterState } from '../types';
import { filterMessages, analyzeChat } from '../utils/analyzer';

interface FilterWorkerMessage {
  type: 'filter';
  data: {
    chat: ParsedChat;
    filters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>;
  };
}

interface FilterWorkerResponse {
  type: 'result' | 'error';
  analytics?: ProcessedAnalytics;
  error?: string;
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<FilterWorkerMessage>) => {
  const { type, data } = event.data;

  if (type === 'filter') {
    try {
      // Apply filters to the chat data
      const filteredChat = filterMessages(data.chat, data.filters);
      
      // Analyze the filtered data
      const analytics = analyzeChat(filteredChat);
      
      // Send result back to main thread
      self.postMessage({
        type: 'result',
        analytics
      } as FilterWorkerResponse);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to filter and analyze chat'
      } as FilterWorkerResponse);
    }
  }
});