import { 
  ParsedChat, 
  ProcessedAnalytics, 
  MessageStats, 
  TimePatterns, 
  EmojiAnalysis, 
  WordFrequency, 
  ResponseMetrics, 
  CallAnalytics 
} from '../types';
import { format } from 'date-fns';
import * as sw from 'stopword';
import { franc } from 'franc-min';

// Utility functions to aggregate sender-separated data
export function aggregateHourlyActivity(hourlyBySender: Record<string, Record<number, number>>): Record<number, number> {
  const aggregated: Record<number, number> = {};
  for (let i = 0; i < 24; i++) aggregated[i] = 0;
  
  Object.values(hourlyBySender).forEach(senderData => {
    Object.entries(senderData).forEach(([hour, count]) => {
      aggregated[parseInt(hour)] += count;
    });
  });
  
  return aggregated;
}

export function aggregateDailyActivity(dailyBySender: Record<string, Record<string, number>>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  Object.values(dailyBySender).forEach(senderData => {
    Object.entries(senderData).forEach(([date, count]) => {
      aggregated[date] = (aggregated[date] || 0) + count;
    });
  });
  
  return aggregated;
}

export function aggregateWeeklyActivity(weeklyBySender: Record<string, Record<number, number>>): Record<number, number> {
  const aggregated: Record<number, number> = {};
  for (let i = 0; i < 7; i++) aggregated[i] = 0;
  
  Object.values(weeklyBySender).forEach(senderData => {
    Object.entries(senderData).forEach(([day, count]) => {
      aggregated[parseInt(day)] += count;
    });
  });
  
  return aggregated;
}

export function aggregateMonthlyActivity(monthlyBySender: Record<string, Record<string, number>>): Record<string, number> {
  const aggregated: Record<string, number> = {};
  
  Object.values(monthlyBySender).forEach(senderData => {
    Object.entries(senderData).forEach(([month, count]) => {
      aggregated[month] = (aggregated[month] || 0) + count;
    });
  });
  
  return aggregated;
}

// Type for supported languages in stopword package
type StopwordLanguage = 'eng' | 'spa' | 'por' | 'fra' | 'deu' | 'ita' | 'nld' | 'swe' | 'dan' | 'rus' | 'pol' | 'fin' | 'hun' | 'tur' | 'ara' | 'fas' | 'hin' | 'jpn' | 'zho' | 'kor' | 'tha' | 'vie' | 'ind';

// Map ISO 639-3 codes from franc to stopword language codes
const francToStopwordMap: Record<string, StopwordLanguage> = {
  eng: 'eng', // English
  spa: 'spa', // Spanish
  por: 'por', // Portuguese
  fra: 'fra', // French
  deu: 'deu', // German (Deutsch)
  ita: 'ita', // Italian
  nld: 'nld', // Dutch
  swe: 'swe', // Swedish
  dan: 'dan', // Danish
  // nor: 'nor', // Norwegian - not supported by stopword package
  rus: 'rus', // Russian
  pol: 'pol', // Polish
  fin: 'fin', // Finnish
  hun: 'hun', // Hungarian
  tur: 'tur', // Turkish
  ara: 'ara', // Arabic
  fas: 'fas', // Persian/Farsi
  hin: 'hin', // Hindi
  jpn: 'jpn', // Japanese
  zho: 'zho', // Chinese
  kor: 'kor', // Korean
  tha: 'tha', // Thai
  vie: 'vie', // Vietnamese
  ind: 'ind', // Indonesian
};

// Cached stopwords to avoid repeated language detection
const stopwordCache = new Map<string, string[]>();
const languageCache = new Map<string, string>();

// Get stopwords for detected language
function getStopwords(text: string): string[] {
  // Use cached result if available
  const cacheKey = text.slice(0, 200); // Use first 200 chars as cache key
  if (stopwordCache.has(cacheKey)) {
    return stopwordCache.get(cacheKey)!;
  }

  // Use franc to detect language (returns ISO 639-3 code) with caching
  let detectedLang = languageCache.get(cacheKey);
  if (!detectedLang) {
    detectedLang = franc(text);
    languageCache.set(cacheKey, detectedLang);
  }
  
  // Map to stopword language code
  const stopwordLang = francToStopwordMap[detectedLang];
  
  // Return stopwords for detected language, fallback to English
  let stopwords: string[];
  if (stopwordLang && stopwordLang in sw) {
    stopwords = sw[stopwordLang] as string[];
  } else {
    stopwords = sw.eng as string[];
  }
  
  // Cache the result
  stopwordCache.set(cacheKey, stopwords);
  return stopwords;
}

export function analyzeMessageStats(chat: ParsedChat): MessageStats {
  const messagesPerSender: Record<string, number> = {};
  const mediaPerSender: Record<string, number> = {};
  let totalWords = 0;
  let totalCharacters = 0;
  
  for (const msg of chat.messages) {
    messagesPerSender[msg.sender] = (messagesPerSender[msg.sender] || 0) + 1;
    
    if (msg.type === 'media') {
      mediaPerSender[msg.sender] = (mediaPerSender[msg.sender] || 0) + 1;
    }
    
    totalWords += msg.metadata.wordCount;
    totalCharacters += msg.metadata.charCount;
  }
  
  return {
    totalMessages: chat.messages.length,
    messagesPerSender,
    mediaPerSender,
    averageMessageLength: totalCharacters / chat.messages.length,
    totalWords,
    totalCharacters,
  };
}

export function analyzeTimePatterns(chat: ParsedChat): TimePatterns {
  const hourlyActivity: Record<string, Record<number, number>> = {};
  const dailyActivity: Record<string, Record<string, number>> = {};
  const weeklyActivity: Record<string, Record<number, number>> = {};
  const monthlyActivity: Record<string, Record<string, number>> = {};
  
  // Get all unique senders
  const senders = new Set(chat.messages.map(m => m.sender));
  
  // Initialize patterns for each sender
  senders.forEach(sender => {
    hourlyActivity[sender] = {};
    weeklyActivity[sender] = {};
    dailyActivity[sender] = {};
    monthlyActivity[sender] = {};
    
    // Initialize hourly and weekly patterns
    for (let i = 0; i < 24; i++) hourlyActivity[sender][i] = 0;
    for (let i = 0; i < 7; i++) weeklyActivity[sender][i] = 0;
  });
  
  // Populate patterns
  for (const msg of chat.messages) {
    const sender = msg.sender;
    const hour = msg.datetime.getHours();
    const dayOfWeek = msg.datetime.getDay();
    const date = format(msg.datetime, 'yyyy-MM-dd');
    const month = format(msg.datetime, 'yyyy-MM');
    
    hourlyActivity[sender][hour]++;
    weeklyActivity[sender][dayOfWeek]++;
    dailyActivity[sender][date] = (dailyActivity[sender][date] || 0) + 1;
    monthlyActivity[sender][month] = (monthlyActivity[sender][month] || 0) + 1;
  }
  
  return {
    hourlyActivity,
    dailyActivity,
    weeklyActivity,
    monthlyActivity,
  };
}

// Helper function to normalize emojis by removing skin tone modifiers
function normalizeEmoji(emoji: string): string {
  // Remove skin tone modifiers but preserve the structure of ZWJ sequences
  let normalized = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
  
  // Clean up any double ZWJ sequences that might result from modifier removal
  normalized = normalized.replace(/\u200D\u200D+/g, '\u200D');
  
  // Remove any trailing or leading ZWJ sequences
  normalized = normalized.replace(/^\u200D+|\u200D+$/g, '');
  
  // If we ended up with just modifier characters, gender symbols, or ZWJ, filter it out
  if (/^(\u200D|\u2640|\u2642|\uFE0F|\u20E3)+$/.test(normalized) || normalized.length === 0) {
    return emoji; // Return original if normalization breaks it
  }
  
  return normalized;
}

export function analyzeEmojis(chat: ParsedChat): EmojiAnalysis {
  const emojiFrequency: Record<string, number> = {};
  const emojisPerSender: Record<string, Record<string, number>> = {};
  const rawEmojiFrequency: Record<string, number> = {}; // Track original emojis with skin tones
  let totalEmojis = 0;
  
  for (const msg of chat.messages) {
    if (msg.metadata.emojis) {
      for (const emoji of msg.metadata.emojis) {
        // Track raw emoji for accurate unique count
        rawEmojiFrequency[emoji] = (rawEmojiFrequency[emoji] || 0) + 1;
        
        // Normalize emoji for grouping
        const normalizedEmoji = normalizeEmoji(emoji);
        emojiFrequency[normalizedEmoji] = (emojiFrequency[normalizedEmoji] || 0) + 1;
        
        if (!emojisPerSender[msg.sender]) {
          emojisPerSender[msg.sender] = {};
        }
        emojisPerSender[msg.sender][normalizedEmoji] = 
          (emojisPerSender[msg.sender][normalizedEmoji] || 0) + 1;
        
        totalEmojis++;
      }
    }
  }
  
  const topEmojis = Object.entries(emojiFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([emoji, count]) => ({ emoji, count }));
  
  return {
    totalEmojis,
    uniqueEmojis: Object.keys(rawEmojiFrequency).length, // Count of actual unique emojis (including variants)
    emojiFrequency, // Normalized frequencies for display
    emojisPerSender, // Normalized per sender
    topEmojis, // Top normalized emojis
  };
}

export function analyzeWordFrequency(chat: ParsedChat): WordFrequency {
  const wordCount: Record<string, number> = {};
  
  // Filter text messages first for efficiency
  const textMessages = chat.messages.filter(msg => msg.type === 'text');
  if (textMessages.length === 0) {
    return {
      topWords: [],
      wordCloud: {},
      uniqueWords: 0,
      languageDetected: 'eng',
    };
  }
  
  // Collect sample text for language detection (optimized)
  const sampleText = textMessages
    .slice(0, Math.min(100, textMessages.length))
    .map(msg => msg.content)
    .join(' ');
  
  const detectedLang = franc(sampleText);
  const stopwords = getStopwords(sampleText);
  
  // Optimized word processing with early termination for large datasets
  const maxMessages = Math.min(textMessages.length, 10000); // Limit for performance
  const wordRegex = /\b\w{3,}\b/g; // Pre-compiled regex for better performance
  
  for (let i = 0; i < maxMessages; i++) {
    const msg = textMessages[i];
    const content = msg.content.toLowerCase();
    const words = content.match(wordRegex) || [];
    
    // Batch process stopword removal for efficiency
    if (words.length > 0) {
      const filteredWords = sw.removeStopwords(words, stopwords);
      
      for (const word of filteredWords) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }
    
    // Early termination if we have enough data
    if (Object.keys(wordCount).length > 5000) break;
  }
  
  const topWords = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([word, count]) => ({ word, count }));
  
  return {
    topWords,
    wordCloud: wordCount,
    uniqueWords: Object.keys(wordCount).length,
    languageDetected: detectedLang,
  };
}

export function analyzeResponseMetrics(chat: ParsedChat): ResponseMetrics {
  const responseTimes: number[] = [];
  const responseTimePerSender: Record<string, number[]> = {};
  const conversationInitiators: Record<string, number> = {};
  
  let lastMessage: typeof chat.messages[0] | null = null;
  const conversationGap = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  for (const msg of chat.messages) {
    if (lastMessage) {
      const timeDiff = msg.datetime.getTime() - lastMessage.datetime.getTime();
      
      // New conversation if gap is more than 30 minutes
      if (timeDiff > conversationGap) {
        conversationInitiators[msg.sender] = (conversationInitiators[msg.sender] || 0) + 1;
      }
      // Response if different sender
      else if (msg.sender !== lastMessage.sender) {
        const responseMinutes = timeDiff / (1000 * 60);
        responseTimes.push(responseMinutes);
        
        if (!responseTimePerSender[msg.sender]) {
          responseTimePerSender[msg.sender] = [];
        }
        responseTimePerSender[msg.sender].push(responseMinutes);
      }
    } else {
      // First message is a conversation initiator
      conversationInitiators[msg.sender] = 1;
    }
    
    lastMessage = msg;
  }
  
  // Calculate averages
  const avgResponseTimePerSender: Record<string, number> = {};
  for (const [sender, times] of Object.entries(responseTimePerSender)) {
    avgResponseTimePerSender[sender] = times.reduce((a, b) => a + b, 0) / times.length;
  }
  
  return {
    averageResponseTime: responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0,
    responseTimePerSender: avgResponseTimePerSender,
    conversationInitiators,
  };
}

export function analyzeCallAnalytics(chat: ParsedChat): CallAnalytics {
  const callsByHour: Record<number, number> = {};
  const callsByDay: Record<number, number> = {};
  
  // Initialize
  for (let i = 0; i < 24; i++) callsByHour[i] = 0;
  for (let i = 0; i < 7; i++) callsByDay[i] = 0;
  
  let totalDuration = 0;
  let completedCalls = 0;
  
  for (const call of chat.calls) {
    const hour = call.datetime.getHours();
    const day = call.datetime.getDay();
    
    callsByHour[hour]++;
    callsByDay[day]++;
    
    if (call.status === 'completed') {
      completedCalls++;
      totalDuration += call.duration;
    }
  }
  
  return {
    totalCalls: chat.calls.length,
    completedCalls,
    missedCalls: chat.calls.length - completedCalls,
    averageDuration: completedCalls > 0 ? totalDuration / completedCalls : 0,
    callsByHour,
    callsByDay,
  };
}

export function analyzeChat(chat: ParsedChat): ProcessedAnalytics {
  return {
    messageStats: analyzeMessageStats(chat),
    timePatterns: analyzeTimePatterns(chat),
    emojiAnalysis: analyzeEmojis(chat),
    wordFrequency: analyzeWordFrequency(chat),
    responseMetrics: analyzeResponseMetrics(chat),
    callAnalytics: analyzeCallAnalytics(chat),
  };
}

// Filter messages based on filter criteria
export function filterMessages(
  chat: ParsedChat,
  filters: {
    selectedSenders: string[];
    searchKeyword: string;
    messageTypes: ('text' | 'media' | 'call')[];
    dateRange?: [Date, Date] | null;
  }
): ParsedChat {
  let filteredMessages = chat.messages;
  let filteredCalls = chat.calls;

  // Filter by senders
  if (filters.selectedSenders.length > 0) {
    filteredMessages = filteredMessages.filter(msg => 
      filters.selectedSenders.includes(msg.sender)
    );
    filteredCalls = filteredCalls.filter(call => 
      filters.selectedSenders.includes(call.initiator)
    );
  }

  // Filter by message types
  if (filters.messageTypes.length < 3) {
    filteredMessages = filteredMessages.filter(msg => 
      filters.messageTypes.includes(msg.type as 'text' | 'media' | 'call')
    );
    
    if (!filters.messageTypes.includes('call')) {
      filteredCalls = [];
    }
  }

  // Filter by search keyword
  if (filters.searchKeyword.trim()) {
    const keyword = filters.searchKeyword.toLowerCase().trim();
    filteredMessages = filteredMessages.filter(msg => 
      msg.content.toLowerCase().includes(keyword) ||
      msg.sender.toLowerCase().includes(keyword)
    );
  }

  // Filter by date range
  if (filters.dateRange) {
    const [startDate, endDate] = filters.dateRange;
    filteredMessages = filteredMessages.filter(msg => 
      msg.datetime >= startDate && msg.datetime <= endDate
    );
    filteredCalls = filteredCalls.filter(call => 
      call.datetime >= startDate && call.datetime <= endDate
    );
  }

  return {
    ...chat,
    messages: filteredMessages,
    calls: filteredCalls,
  };
}