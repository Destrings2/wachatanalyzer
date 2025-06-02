import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { startOfDay, isSameDay } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { useFilterStore } from '../../stores/filterStore';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { DateNavigator } from './DateNavigator';
import { SearchHighlight } from './SearchHighlight';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Message } from '../../types';
import {Search, Calendar, Settings, ArrowDown} from 'lucide-react';
import clsx from 'clsx';

interface ChatViewProps {
  className?: string;
  messages: Message[];
}

interface ChatItem {
  type: 'message' | 'date-separator';
  data: Message | Date;
  index: number;
  isGrouped?: boolean; // For consecutive messages from same sender
  isLastInGroup?: boolean;
}

const CHUNK_SIZE = 150; // Messages per chunk
const MAX_RENDERED_ITEMS = 500; // Maximum DOM items

export const ChatView: React.FC<ChatViewProps> = ({ className, messages }) => {
  const { isLoading } = useChatStore();
  const { searchKeyword } = useFilterStore();
  const [showDateNavigator, setShowDateNavigator] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Chunking state
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: CHUNK_SIZE });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastScrollTopRef = useRef<number>(0);

  // Enhanced scroll management refs
  const scrollDebounceRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);

  // Use messages directly from props (already filtered by Dashboard)
  const filteredMessages = messages;

  // Process messages for chat display with date separators and grouping
  const chatItems = useMemo(() => {
    if (!filteredMessages || filteredMessages.length === 0) return [];

    const items: ChatItem[] = [];
    let currentDate: Date | null = null;
    let lastSender: string | null = null;
    let groupStartIndex = -1;

    filteredMessages.forEach((message: Message, index: number) => {
      const messageDate = startOfDay(message.datetime);

      // Add date separator if day changed
      if (!currentDate || !isSameDay(currentDate, messageDate)) {
        // Mark last message in previous group
        if (groupStartIndex >= 0 && items.length > 0) {
          const lastItem = items[items.length - 1];
          if (lastItem.type === 'message') {
            lastItem.isLastInGroup = true;
          }
        }

        items.push({
          type: 'date-separator',
          data: messageDate,
          index: items.length
        });
        currentDate = messageDate;
        lastSender = null;
        groupStartIndex = -1;
      }

      // Determine if this message should be grouped with previous
      const isGrouped = lastSender === message.sender;
      const isLastInGroup = index === filteredMessages.length - 1 ||
                           filteredMessages[index + 1]?.sender !== message.sender ||
                           !isSameDay(message.datetime, filteredMessages[index + 1]?.datetime);

      if (!isGrouped) {
        groupStartIndex = items.length;
      }

      items.push({
        type: 'message',
        data: message,
        index: items.length,
        isGrouped,
        isLastInGroup
      });

      lastSender = message.sender;
    });

    // Mark the last message as end of group
    if (items.length > 0 && items[items.length - 1].type === 'message') {
      items[items.length - 1].isLastInGroup = true;
    }

    return items;
  }, [filteredMessages]);

  // Get currently visible chat items based on range
  const visibleChatItems = useMemo(() => {
    const start = Math.max(0, visibleRange.start);
    const end = Math.min(chatItems.length, visibleRange.end);
    return chatItems.slice(start, end);
  }, [chatItems, visibleRange]);

  // Load more content with scroll position preservation
  const loadMoreContent = useCallback((direction: 'up' | 'down') => {
    if (isLoadingMore || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setIsLoadingMore(true);

    if (direction === 'up' && visibleRange.start > 0) {
      // Loading older messages - preserve scroll position
      const newStart = Math.max(0, visibleRange.start - CHUNK_SIZE);

      setVisibleRange(prev => ({
        start: newStart,
        end: Math.min(chatItems.length, prev.end)
      }));

      // Restore scroll position after DOM updates
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const heightDiff = newScrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + heightDiff;
        }
        setIsLoadingMore(false);
      });
    } else if (direction === 'down' && visibleRange.end < chatItems.length) {
      // Loading newer messages - no position adjustment needed
      setVisibleRange(prev => ({
        start: prev.start,
        end: Math.min(chatItems.length, prev.end + CHUNK_SIZE)
      }));

      setTimeout(() => setIsLoadingMore(false), 50);
    } else {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, visibleRange, chatItems.length]);

  // Debounced scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Clear existing debounce
    if (scrollDebounceRef.current) {
      clearTimeout(scrollDebounceRef.current);
    }

    // Mark as user scrolling
    isUserScrollingRef.current = true;
    lastScrollTopRef.current = scrollTop;

    // Debounced scroll handling
    scrollDebounceRef.current = setTimeout(() => {
      if (!isLoadingMore) {
        const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

        // Load more when near edges
        if (scrollPercentage < 0.15 && visibleRange.start > 0) {
          loadMoreContent('up');
        } else if (scrollPercentage > 0.85 && visibleRange.end < chatItems.length) {
          loadMoreContent('down');
        }
      }

      isUserScrollingRef.current = false;
    }, 150);
  }, [loadMoreContent, isLoadingMore, visibleRange, chatItems.length]);

  // Memory management (separate from scroll events)
  useEffect(() => {
    // Only manage memory when not actively loading and not user scrolling
    if (!isLoadingMore && !isUserScrollingRef.current &&
        visibleRange.end - visibleRange.start > MAX_RENDERED_ITEMS) {

      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollPercentage = scrollTop / (scrollHeight - clientHeight);

      // Calculate new range based on current scroll position
      const totalItems = visibleRange.end - visibleRange.start;
      const targetSize = Math.floor(MAX_RENDERED_ITEMS * 0.8); // Use 80% of max for buffer
      const currentIndex = visibleRange.start + Math.floor(totalItems * scrollPercentage);
      const halfTarget = Math.floor(targetSize / 2);

      const newStart = Math.max(0, currentIndex - halfTarget);
      const newEnd = Math.min(chatItems.length, newStart + targetSize);

      setVisibleRange({ start: newStart, end: newEnd });
    }
  }, [visibleRange, isLoadingMore, chatItems.length]);

  // Jump to specific date
  const jumpToDate = useCallback((date: Date) => {
    const targetIndex = chatItems.findIndex(item =>
      item.type === 'date-separator' &&
      isSameDay(item.data as Date, date)
    );

    if (targetIndex >= 0 && scrollContainerRef.current) {
      // Expand visible range to include target
      setVisibleRange({
        start: Math.max(0, targetIndex - CHUNK_SIZE),
        end: Math.min(chatItems.length, targetIndex + CHUNK_SIZE)
      });

      // Scroll to target after DOM update
      setTimeout(() => {
        const element = scrollContainerRef.current?.querySelector(`[data-index="${targetIndex}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);

      setSelectedDate(date);
      setAutoScroll(false);
    }
  }, [chatItems]);

  // Jump to latest messages
  const jumpToLatest = useCallback(() => {
    if (scrollContainerRef.current && chatItems.length > 0) {
      setVisibleRange({
        start: Math.max(0, chatItems.length - CHUNK_SIZE),
        end: chatItems.length
      });

      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);

      setAutoScroll(true);
      setSelectedDate(null);
    }
  }, [chatItems.length]);

  // Auto-scroll to bottom when new messages arrive (if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current && chatItems.length > 0) {
      setVisibleRange({
        start: Math.max(0, chatItems.length - CHUNK_SIZE),
        end: chatItems.length
      });

      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'auto'
        });
      }, 0);
    }
  }, [chatItems.length, autoScroll]);

  // Initialize with latest messages
  useEffect(() => {
    if (chatItems.length > 0 && visibleRange.end === CHUNK_SIZE) {
      setVisibleRange({
        start: Math.max(0, chatItems.length - CHUNK_SIZE),
        end: chatItems.length
      });
    }
  }, [chatItems.length, visibleRange.end]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollDebounceRef.current) {
        clearTimeout(scrollDebounceRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="No Messages"
          description="No messages found in this chat. Try uploading a chat file."
        />
      </div>
    );
  }

  if (chatItems.length === 0) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <EmptyState
          icon={<Search className="w-12 h-12" />}
          title="No Messages Match Filters"
          description="Try adjusting your search criteria or filters to see messages."
        />
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col h-full min-h-0', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            Chat Messages
          </h2>
          <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
            {filteredMessages?.length || 0}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setShowDateNavigator(!showDateNavigator)}
            className={clsx(
              "p-2 rounded-lg transition-colors touch-manipulation",
              showDateNavigator
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
            title="Jump to date"
            aria-pressed={showDateNavigator}
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            onClick={jumpToLatest}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
            title="Jump to latest"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* Messages List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 scrollbar-hide"
        onScroll={handleScroll}
      >
        {/* Loading indicator for older messages */}
        {isLoadingMore && visibleRange.start > 0 && (
          <div className="flex justify-center py-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading older messages...</div>
          </div>
        )}

        {/* Rendered chat items */}
        {visibleChatItems.map((item, index) => (
          <div
            key={`${item.type}-${item.index}`}
            data-index={visibleRange.start + index}
            className="transition-all duration-200"
          >
            {item.type === 'date-separator' ? (
              <DateSeparator date={item.data as Date} />
            ) : (
              <MessageBubble
                message={item.data as Message}
                isGrouped={item.isGrouped}
                isLastInGroup={item.isLastInGroup}
                searchQuery={searchKeyword}
                className={clsx(
                  'transition-all duration-200',
                  selectedDate && 'opacity-90'
                )}
              />
            )}
          </div>
        ))}

        {/* Loading indicator for newer messages */}
        {isLoadingMore && visibleRange.end < chatItems.length && (
          <div className="flex justify-center py-2">
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading newer messages...</div>
          </div>
        )}
      </div>

      {/* Search Summary - Only show when search is active */}
      {searchKeyword && (
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 flex-wrap">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Search active</span>
            </div>
            <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs truncate max-w-xs">
              {searchKeyword}
            </span>
          </div>
        </div>
      )}

      {/* Date Navigator Modal */}
      {showDateNavigator && (
        <DateNavigator
          messages={filteredMessages || []}
          onDateSelect={jumpToDate}
          onClose={() => setShowDateNavigator(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};
