import { ParsedChat, ProcessedAnalytics, FilterState } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

interface FilterCacheKey {
  selectedSenders: string[];
  searchKeyword: string;
  messageTypes: string[];
  dateRange: string | null;
}

interface AnalyticsCacheKey {
  chatHash: string;
  messageCount: number;
}

class LRUCache<K, V> {
  private cache = new Map<string, CacheEntry<V>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private keyToString(key: K): string {
    return JSON.stringify(key);
  }

  private isExpired(entry: CacheEntry<V>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxSize) return;

    let lruKey = '';
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  get(key: K): V | null {
    const keyStr = this.keyToString(key);
    const entry = this.cache.get(keyStr);

    if (!entry || this.isExpired(entry)) {
      if (entry) this.cache.delete(keyStr);
      return null;
    }

    entry.accessCount++;
    entry.lastAccess = Date.now();
    return entry.data;
  }

  set(key: K, value: V): void {
    const keyStr = this.keyToString(key);
    const now = Date.now();

    this.cache.set(keyStr, {
      data: value,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
    });

    this.evictLRU();
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    let expired = 0;
    let totalAccess = 0;

    for (const entry of this.cache.values()) {
      if (this.isExpired(entry)) expired++;
      totalAccess += entry.accessCount;
    }

    return {
      size: this.cache.size,
      expired,
      averageAccess: totalAccess / this.cache.size || 0,
    };
  }
}

export class PerformanceCache {
  private filterCache = new LRUCache<FilterCacheKey, ParsedChat>(50, 2 * 60 * 1000); // 2 min TTL
  private analyticsCache = new LRUCache<AnalyticsCacheKey, ProcessedAnalytics>(20, 10 * 60 * 1000); // 10 min TTL
  private partialAnalyticsCache = new LRUCache<string, Partial<ProcessedAnalytics>>(100, 5 * 60 * 1000);
  
  // Pre-computed indices for faster filtering
  private messageIndices = new Map<string, {
    senderIndex: Map<string, number[]>;
    typeIndex: Map<string, number[]>;
    keywordIndex: Map<string, number[]>;
    dateIndex: Map<string, number[]>;
  }>();

  private static instance: PerformanceCache;

  static getInstance(): PerformanceCache {
    if (!PerformanceCache.instance) {
      PerformanceCache.instance = new PerformanceCache();
    }
    return PerformanceCache.instance;
  }

  // Generate consistent hash for chat data
  private generateChatHash(chat: ParsedChat): string {
    return `${chat.messages.length}_${chat.calls.length}_${chat.metadata.totalMessages}`;
  }

  // Generate filter cache key
  private generateFilterKey(filters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>): FilterCacheKey {
    return {
      selectedSenders: [...filters.selectedSenders].sort(),
      searchKeyword: filters.searchKeyword.toLowerCase().trim(),
      messageTypes: [...filters.messageTypes].sort(),
      dateRange: filters.dateRange ? `${filters.dateRange[0].getTime()}_${filters.dateRange[1].getTime()}` : null,
    };
  }

  // Build indices for faster filtering
  buildIndices(chatHash: string, chat: ParsedChat): void {
    if (this.messageIndices.has(chatHash)) return;

    const senderIndex = new Map<string, number[]>();
    const typeIndex = new Map<string, number[]>();
    const keywordIndex = new Map<string, number[]>();
    const dateIndex = new Map<string, number[]>();

    chat.messages.forEach((message, index) => {
      // Sender index
      if (!senderIndex.has(message.sender)) {
        senderIndex.set(message.sender, []);
      }
      senderIndex.get(message.sender)!.push(index);

      // Type index
      if (!typeIndex.has(message.type)) {
        typeIndex.set(message.type, []);
      }
      typeIndex.get(message.type)!.push(index);

      // Keyword index (for common words)
      const words = message.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) {
          if (!keywordIndex.has(word)) {
            keywordIndex.set(word, []);
          }
          keywordIndex.get(word)!.push(index);
        }
      });

      // Date index (by day)
      const dateKey = message.datetime.toISOString().split('T')[0];
      if (!dateIndex.has(dateKey)) {
        dateIndex.set(dateKey, []);
      }
      dateIndex.get(dateKey)!.push(index);
    });

    this.messageIndices.set(chatHash, {
      senderIndex,
      typeIndex, 
      keywordIndex,
      dateIndex,
    });
  }

  // Get cached filtered data
  getCachedFilteredData(filters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>): ParsedChat | null {
    const key = this.generateFilterKey(filters);
    return this.filterCache.get(key);
  }

  // Cache filtered data
  setCachedFilteredData(filters: Pick<FilterState, 'selectedSenders' | 'searchKeyword' | 'messageTypes' | 'dateRange'>, data: ParsedChat): void {
    const key = this.generateFilterKey(filters);
    this.filterCache.set(key, data);
  }

  // Get cached analytics
  getCachedAnalytics(chat: ParsedChat): ProcessedAnalytics | null {
    const key: AnalyticsCacheKey = {
      chatHash: this.generateChatHash(chat),
      messageCount: chat.messages.length,
    };
    return this.analyticsCache.get(key);
  }

  // Cache analytics
  setCachedAnalytics(chat: ParsedChat, analytics: ProcessedAnalytics): void {
    const key: AnalyticsCacheKey = {
      chatHash: this.generateChatHash(chat),
      messageCount: chat.messages.length,
    };
    this.analyticsCache.set(key, analytics);
  }

  // Get partial analytics (for incremental loading)
  getCachedPartialAnalytics(chat: ParsedChat, type: string): Partial<ProcessedAnalytics> | null {
    const key = `${this.generateChatHash(chat)}_${type}_${chat.messages.length}`;
    return this.partialAnalyticsCache.get(key);
  }

  // Cache partial analytics
  setCachedPartialAnalytics(chat: ParsedChat, type: string, analytics: Partial<ProcessedAnalytics>): void {
    const key = `${this.generateChatHash(chat)}_${type}_${chat.messages.length}`;
    this.partialAnalyticsCache.set(key, analytics);
  }

  // Get indices for faster filtering
  getIndices(chatHash: string) {
    return this.messageIndices.get(chatHash);
  }

  // Clear all caches
  clearAll(): void {
    this.filterCache.clear();
    this.analyticsCache.clear();
    this.partialAnalyticsCache.clear();
    this.messageIndices.clear();
  }

  // Get cache statistics
  getStats() {
    return {
      filter: this.filterCache.getStats(),
      analytics: this.analyticsCache.getStats(),
      partialAnalytics: this.partialAnalyticsCache.getStats(),
      indicesCount: this.messageIndices.size,
    };
  }
}

export const performanceCache = PerformanceCache.getInstance();