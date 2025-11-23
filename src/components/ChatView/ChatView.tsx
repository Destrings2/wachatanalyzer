import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { startOfDay, isSameDay } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { useFilterStore } from '../../stores/filterStore';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { DateNavigator } from './DateNavigator';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Message } from '../../types';
import { Search, Calendar, Settings, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

interface ChatViewProps {
  className?: string;
  messages: Message[];
}

interface ChatItem {
  type: 'message' | 'date-separator';
  data: Message | Date;
  id: string;
  isGrouped?: boolean;
  isLastInGroup?: boolean;
}

// Custom hook to process messages into chat items
const useChatItems = (messages: Message[]): ChatItem[] => {
  return useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const items: ChatItem[] = [];
    let currentDate: Date | null = null;
    let lastSender: string | null = null;

    messages.forEach((message, index) => {
      const messageDate = startOfDay(message.datetime);
      const nextMessage = messages[index + 1];

      // Add date separator if day changed
      if (!currentDate || !isSameDay(currentDate, messageDate)) {
        if (lastSender && items.length > 0) {
          // Mark last message in previous group
          const lastItem = items[items.length - 1];
          if (lastItem.type === 'message') {
            lastItem.isLastInGroup = true;
          }
        }

        items.push({
          type: 'date-separator',
          data: messageDate,
          id: `date-${messageDate.getTime()}`
        });
        currentDate = messageDate;
        lastSender = null;
      }

      // Determine grouping
      const isGrouped = lastSender === message.sender;
      const isLastInGroup = !nextMessage ||
        nextMessage.sender !== message.sender ||
        !isSameDay(message.datetime, nextMessage.datetime);

      items.push({
        type: 'message',
        data: message,
        id: `msg-${message.timestamp}-${index}`,
        isGrouped,
        isLastInGroup
      });

      lastSender = message.sender;
    });

    return items;
  }, [messages]);
};

export const ChatView: React.FC<ChatViewProps> = ({ className, messages }) => {
  const { isLoading } = useChatStore();
  const { searchKeyword } = useFilterStore();
  const [showDateNavigator, setShowDateNavigator] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatItems = useChatItems(messages);

  // Virtual scrolling setup with dynamic height support
  const virtualizer = useVirtualizer({
    count: chatItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: useCallback((index) => {
      // Better estimates based on item type
      const item = chatItems[index];
      if (!item) return 80;
      return item.type === 'date-separator' ? 40 : 80;
    }, [chatItems]),
    overscan: 10 // Render 10 items outside visible area
  });

  // Jump to specific date
  const jumpToDate = useCallback((date: Date) => {
    // Find the first message of the selected date (not just the separator)
    const targetIndex = chatItems.findIndex((item) => {
      if (item.type === 'message') {
        const message = item.data as Message;
        return isSameDay(message.datetime, date);
      }
      // Also check if this is the date separator for the target date
      if (item.type === 'date-separator') {
        return isSameDay(item.data as Date, date);
      }
      return false;
    });

    if (targetIndex >= 0) {
      // Scroll to the item programmatically
      const scrollToTarget = () => {
        const scrollElement = scrollContainerRef.current;
        if (!scrollElement) return;

        // Get the virtual item
        const virtualItems = virtualizer.getVirtualItems();
        const targetVirtualItem = virtualItems.find(item => item.index === targetIndex);

        if (targetVirtualItem) {
          // Scroll directly to the position
          scrollElement.scrollTop = targetVirtualItem.start - 20; // 20px padding
        } else {
          // If item not in virtual list, use scrollToIndex
          virtualizer.scrollToIndex(targetIndex, {
            behavior: 'auto',
            align: 'start'
          });
        }
      };

      // Execute scroll
      scrollToTarget();

      setSelectedDate(date);
    }
  }, [chatItems, virtualizer]);

  // Jump to latest messages
  const jumpToLatest = useCallback(() => {
    if (chatItems.length > 0) {
      const scrollElement = scrollContainerRef.current;
      if (!scrollElement) return;

      // Then use virtualizer as backup
      virtualizer.scrollToIndex(chatItems.length - 1, {
        behavior: 'auto',
        align: 'end'
      });

      // Ensure it worked after DOM updates

      setSelectedDate(null);
    }
  }, [chatItems, virtualizer]);

  if (isLoading) {
    return (
      <div className={clsx('flex flex-col h-full', className)}>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-white/50 dark:bg-gray-800/50" />
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
    <div className={clsx('flex flex-col h-full min-h-0 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden shadow-sm', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-4 border-b border-white/20 dark:border-gray-700/30 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate tracking-tight">
            Chat Messages
          </h2>
          <span className="flex-shrink-0 px-2.5 py-0.5 text-xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full border border-primary-200 dark:border-primary-800">
            {messages.length.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setShowDateNavigator(!showDateNavigator)}
            className={clsx(
              "p-2 rounded-lg transition-all touch-manipulation",
              showDateNavigator
                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                : "text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-white/50 dark:hover:bg-gray-800/50"
            )}
            title="Jump to date"
          >
            <Calendar className="w-5 h-5" />
          </button>

          <button
            onClick={jumpToLatest}
            className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation"
            title="Jump to latest"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Virtual Message List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-4"
        style={{
          overscrollBehavior: 'contain'
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = chatItems[virtualItem.index];

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
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
                      selectedDate && 'opacity-90'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Summary */}
      {searchKeyword && (
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 bg-primary-50/80 dark:bg-primary-900/20 border-t border-primary-100 dark:border-primary-800 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-primary-800 dark:text-primary-200 flex-wrap">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium">Search active</span>
            </div>
            <span className="px-2 py-0.5 bg-white/50 dark:bg-black/20 rounded text-xs truncate max-w-xs font-mono border border-primary-200 dark:border-primary-800">
              {searchKeyword}
            </span>
          </div>
        </div>
      )}

      {/* Date Navigator Modal */}
      {showDateNavigator && (
        <DateNavigator
          messages={messages}
          onDateSelect={jumpToDate}
          onClose={() => setShowDateNavigator(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};
