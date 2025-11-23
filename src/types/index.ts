export interface Message {
  datetime: Date;
  timestamp: number;
  sender: string;
  content: string;
  type: 'text' | 'media' | 'call' | 'system';
  mediaType?: 'image' | 'video' | 'audio' | 'sticker' | 'document' | 'gif' | 'unknown';
  metadata: {
    hasEmoji: boolean;
    emojis?: string[];
    hasUrl: boolean;
    urls?: string[];
    wordCount: number;
    charCount: number;
  };
}

export interface Call {
  datetime: Date;
  timestamp: number;
  initiator: string;
  type: 'voice' | 'video';
  status: 'completed' | 'missed';
  duration: number; // in minutes
}

export interface Participant {
  name: string;
  messageCount: number;
  mediaCount: number;
  firstMessage: Date;
  lastMessage: Date;
}

export interface ChatMetadata {
  exportDate: Date;
  totalMessages: number;
  totalCalls: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  chatType: 'individual' | 'group';
}

export interface ParsedChat {
  messages: Message[];
  calls: Call[];
  participants: Participant[];
  metadata: ChatMetadata;
}

export interface MessageStats {
  totalMessages: number;
  messagesPerSender: Record<string, number>;
  mediaPerSender: Record<string, number>;
  averageMessageLength: number;
  totalWords: number;
  totalCharacters: number;
}

export interface TimePatterns {
  // All time patterns are now sender-separated by default
  // When not separating by sender, we aggregate these values
  hourlyActivity: Record<string, Record<number, number>>;
  dailyActivity: Record<string, Record<string, number>>;
  weeklyActivity: Record<string, Record<number, number>>;
  monthlyActivity: Record<string, Record<string, number>>;
}

export interface EmojiAnalysis {
  totalEmojis: number;
  uniqueEmojis: number;
  emojiFrequency: Record<string, number>;
  emojisPerSender: Record<string, Record<string, number>>;
  topEmojis: Array<{ emoji: string; count: number }>;
}

export interface WordFrequency {
  topWords: Array<{ word: string; count: number }>;
  wordCloud: Record<string, number>;
  uniqueWords: number;
  languageDetected?: string;
}

export interface ResponseMetrics {
  averageResponseTime: number; // in minutes
  responseTimePerSender: Record<string, number>;
  conversationInitiators: Record<string, number>;
}

export interface CallAnalytics {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  averageDuration: number;
  callsByHour: Record<number, number>;
  callsByDay: Record<number, number>;
}

export interface ProcessedAnalytics {
  messageStats: MessageStats;
  timePatterns: TimePatterns;
  emojiAnalysis: EmojiAnalysis;
  wordFrequency: WordFrequency;
  responseMetrics: ResponseMetrics;
  callAnalytics: CallAnalytics;
}

export type View = 'upload' | 'dashboard' | 'details';
export type Theme = 'light' | 'dark';
export type ExportFormat = 'png' | 'svg' | 'csv' | 'json' | 'pdf';

export interface FilterState {
  dateRange: [Date, Date] | null;
  selectedSenders: string[];
  searchKeyword: string;
  messageTypes: Array<'text' | 'media' | 'call'>;
}
