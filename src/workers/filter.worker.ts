import { ParsedChat, ProcessedAnalytics, FilterState } from '../types';
import { performanceCache } from '../utils/cache';
import { parseSearchQuery, SearchQueryEvaluator } from '../utils/searchParser';

interface FilterWorkerMessage {
  type: 'filter' | 'analyze' | 'partial-analyze' | 'build-indices';
  data: {
    chat?: ParsedChat;
    chatHash?: string;
    filters?: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>;
    analyticTypes?: string[]; // For partial analysis
    force?: boolean; // Skip cache
  };
}

interface FilterWorkerResponse {
  type: 'filter-result' | 'analyze-result' | 'partial-analyze-result' | 'indices-built' | 'error';
  filteredChat?: ParsedChat;
  analytics?: ProcessedAnalytics;
  partialAnalytics?: Partial<ProcessedAnalytics>;
  cacheHit?: boolean;
  processingTime?: number;
  error?: string;
}

// Fast filtering using indices
function filterMessages(
  chat: ParsedChat,
  filters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>,
  chatHash: string
): ParsedChat {

  // Check cache first
  if (!filters.searchKeyword) { // Don't cache search results as they change frequently
    const cached = performanceCache.getCachedFilteredData(filters);
    if (cached) {
      return cached;
    }
  }

  const indices = performanceCache.getIndices(chatHash);
  let candidateIndices: Set<number> | null = null;

  
  if (indices) {
    // Use indices for faster filtering
    candidateIndices = new Set<number>();

    // Start with all indices if no filters, otherwise start empty
    let resultIndices: Set<number> | null = null;

    // Apply sender filter (OR logic within senders)
    if (filters.selectedSenders.length > 0) {
      const senderIndicesSet = new Set<number>();
      for (const sender of filters.selectedSenders) {
        const senderIndices = indices.senderIndex.get(sender) || [];
        senderIndices.forEach(idx => senderIndicesSet.add(idx));
      }
      resultIndices = senderIndicesSet;
    }

    // Apply message type filter (OR logic within types, AND with previous filters)
    if (filters.messageTypes.length < 3) {
      const typeIndicesSet = new Set<number>();
      for (const type of filters.messageTypes) {
        const msgTypeIndices = indices.typeIndex.get(type) || [];
        msgTypeIndices.forEach(idx => typeIndicesSet.add(idx));
      }
      
      if (resultIndices) {
        // Intersection with existing filters
        const newResultIndices = new Set<number>();
        for (const idx of resultIndices) {
          if (typeIndicesSet.has(idx)) {
            newResultIndices.add(idx);
          }
        }
        resultIndices = newResultIndices;
      } else {
        resultIndices = typeIndicesSet;
      }
    }

    // Apply date range filter (AND with previous filters)
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      const dateIndicesSet = new Set<number>();

      for (const [dateKey, msgIndices] of indices.dateIndex.entries()) {
        const date = new Date(dateKey);
        if (date >= startDate && date <= endDate) {
          msgIndices.forEach(idx => dateIndicesSet.add(idx));
        }
      }

      if (resultIndices) {
        // Intersection with existing filters
        const newResultIndices = new Set<number>();
        for (const idx of resultIndices) {
          if (dateIndicesSet.has(idx)) {
            newResultIndices.add(idx);
          }
        }
        resultIndices = newResultIndices;
      } else {
        resultIndices = dateIndicesSet;
      }
    }

    // If no filters applied, include all messages
    if (!resultIndices) {
      for (let i = 0; i < chat.messages.length; i++) {
        candidateIndices.add(i);
      }
    } else {
      resultIndices.forEach(idx => candidateIndices!.add(idx));
    }
  }

  // Filter messages - use indices if available, otherwise filter directly
  let filteredMessages = chat.messages;
  
  if (candidateIndices) {
    // Use indices for optimized filtering
    filteredMessages = Array.from(candidateIndices).map(idx => chat.messages[idx]);
  } else {
    // Fallback to direct filtering when indices aren't available
    // Filter by senders
    if (filters.selectedSenders.length > 0) {
      filteredMessages = filteredMessages.filter(msg => 
        filters.selectedSenders.includes(msg.sender)
      );
    }
    
    // Filter by message types
    if (filters.messageTypes.length < 3) {
      filteredMessages = filteredMessages.filter(msg => 
        filters.messageTypes.includes(msg.type as 'text' | 'media' | 'call')
      );
    }
    
    // Filter by date range
    if (filters.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      filteredMessages = filteredMessages.filter(msg => 
        msg.datetime >= startDate && msg.datetime <= endDate
      );
    }
  }

  // Apply search keyword filter (always linear, but on reduced set)
  if (filters.searchKeyword.trim()) {
    const searchQuery = parseSearchQuery(filters.searchKeyword);
    
    if (searchQuery) {
      const evaluator = new SearchQueryEvaluator();
      filteredMessages = filteredMessages.filter(msg => 
        evaluator.evaluate(searchQuery, {
          content: msg.content,
          sender: msg.sender,
          type: msg.type as 'text' | 'media' | 'call',
          datetime: msg.datetime
        })
      );
    } else {
      // Fallback to simple search if parsing fails
      const keyword = filters.searchKeyword.toLowerCase().trim();
      filteredMessages = filteredMessages.filter(msg =>
        msg.content.toLowerCase().includes(keyword) ||
        msg.sender.toLowerCase().includes(keyword)
      );
    }
  }

  // Filter calls with the same logic
  let filteredCalls = chat.calls;
  if (filters.selectedSenders.length > 0) {
    filteredCalls = filteredCalls.filter(call =>
      filters.selectedSenders.includes(call.initiator)
    );
  }

  if (!filters.messageTypes.includes('call')) {
    filteredCalls = [];
  }

  if (filters.dateRange) {
    const [startDate, endDate] = filters.dateRange;
    filteredCalls = filteredCalls.filter(call =>
      call.datetime >= startDate && call.datetime <= endDate
    );
  }

  const result = {
    ...chat,
    messages: filteredMessages,
    calls: filteredCalls,
  };

  // Cache non-search results
  if (!filters.searchKeyword) {
    performanceCache.setCachedFilteredData(filters, result);
  }

  return result;
}

// Import analytics functions dynamically to avoid loading all dependencies
let analyzerModule: typeof import('../utils/analyzer') | null = null;

async function getAnalyzer() {
  if (!analyzerModule) {
    analyzerModule = await import('../utils/analyzer');
  }
  return analyzerModule;
}

// Analyze with caching
async function analyzeChat(chat: ParsedChat, force = false): Promise<ProcessedAnalytics> {

  // Check cache first
  if (!force) {
    const cached = performanceCache.getCachedAnalytics(chat);
    if (cached) {
      return cached;
    }
  }

  const analyzer = await getAnalyzer();
  const analytics = analyzer.analyzeChat(chat);

  // Cache the result
  performanceCache.setCachedAnalytics(chat, analytics);

  return analytics;
}

// Partial analysis for progressive loading
async function partialAnalyzeChat(
  chat: ParsedChat,
  analyticTypes: string[]
): Promise<Partial<ProcessedAnalytics>> {
  const result: Partial<ProcessedAnalytics> = {};
  const analyzer = await getAnalyzer();

  for (const type of analyticTypes) {
    // Check cache for this specific analytic type
    const cached = performanceCache.getCachedPartialAnalytics(chat, type);
    if (cached) {
      Object.assign(result, cached);
      continue;
    }

    // Compute specific analytics
    const partialResult: Partial<ProcessedAnalytics> = {};

    switch (type) {
      case 'messageStats':
        partialResult.messageStats = analyzer.analyzeMessageStats?.(chat) ||
          analyzer.analyzeChat(chat).messageStats;
        break;
      case 'timePatterns':
        partialResult.timePatterns = analyzer.analyzeTimePatterns?.(chat) ||
          analyzer.analyzeChat(chat).timePatterns;
        break;
      case 'emojiAnalysis':
        partialResult.emojiAnalysis = analyzer.analyzeEmojis?.(chat) ||
          analyzer.analyzeChat(chat).emojiAnalysis;
        break;
      case 'wordFrequency':
        partialResult.wordFrequency = analyzer.analyzeWordFrequency?.(chat) ||
          analyzer.analyzeChat(chat).wordFrequency;
        break;
      case 'responseMetrics':
        partialResult.responseMetrics = analyzer.analyzeResponseMetrics?.(chat) ||
          analyzer.analyzeChat(chat).responseMetrics;
        break;
      case 'callAnalytics':
        partialResult.callAnalytics = analyzer.analyzeCallAnalytics?.(chat) ||
          analyzer.analyzeChat(chat).callAnalytics;
        break;
    }

    // Cache this partial result
    performanceCache.setCachedPartialAnalytics(chat, type, partialResult);
    Object.assign(result, partialResult);
  }

  return result;
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<FilterWorkerMessage>) => {
  const { type, data } = event.data;
  const startTime = performance.now();

  try {
    switch (type) {
      case 'build-indices':
        if (data.chat && data.chatHash) {
          performanceCache.buildIndices(data.chatHash, data.chat);
          self.postMessage({
            type: 'indices-built',
            processingTime: performance.now() - startTime,
          } as  FilterWorkerResponse);
        }
        break;

      case 'filter':
        if (data.chat && data.filters && data.chatHash) {
          
          const filteredChat = filterMessages(data.chat, data.filters, data.chatHash);
          const cacheHit = performanceCache.getCachedFilteredData(data.filters) !== null;
          

          self.postMessage({
            type: 'filter-result',
            filteredChat,
            cacheHit,
            processingTime: performance.now() - startTime,
          } as  FilterWorkerResponse);
        }
        break;

      case 'analyze':
        if (data.chat) {
          const analytics = await analyzeChat(data.chat, data.force);
          const cacheHit = !data.force && performanceCache.getCachedAnalytics(data.chat) !== null;

          self.postMessage({
            type: 'analyze-result',
            analytics,
            cacheHit,
            processingTime: performance.now() - startTime,
          } as  FilterWorkerResponse);
        }
        break;

      case 'partial-analyze':
        if (data.chat && data.analyticTypes) {
          const partialAnalytics = await partialAnalyzeChat(data.chat, data.analyticTypes);

          self.postMessage({
            type: 'partial-analyze-result',
            partialAnalytics,
            processingTime: performance.now() - startTime,
          } as  FilterWorkerResponse);
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Worker processing failed',
      processingTime: performance.now() - startTime,
    } as  FilterWorkerResponse);
  }
});
