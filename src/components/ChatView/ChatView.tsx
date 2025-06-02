import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { format, startOfDay, isSameDay } from 'date-fns';
import { useChatStore } from '../../stores/chatStore';
import { useFilterStore } from '../../stores/filterStore';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { DateNavigator } from './DateNavigator';
import { SearchHighlight } from './SearchHighlight';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { Message } from '../../types';
import { Search, Calendar, ArrowUp, Settings } from 'lucide-react';
import clsx from 'clsx';

interface ChatViewProps {
  className?: string;
}

interface ChatItem {
  type: 'message' | 'date-separator';
  data: Message | Date;
  index: number;
  isGrouped?: boolean; // For consecutive messages from same sender
  isLastInGroup?: boolean;
}

const ITEM_HEIGHT = 80; // Average height for virtual scrolling
const DATE_SEPARATOR_HEIGHT = 40;

export const ChatView: React.FC<ChatViewProps> = ({ className }) => {
  const { rawMessages, isLoading } = useChatStore();
  const { selectedSenders, searchKeyword, messageTypes, dateRange } = useFilterStore();
  const [showDateNavigator, setShowDateNavigator] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<List>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply client-side filtering (simple version)
  const filteredMessages = useMemo(() => {
    if (!rawMessages) return [];
    
    return rawMessages.filter(message => {
      // Filter by senders
      if (selectedSenders.length > 0 && !selectedSenders.includes(message.sender)) {
        return false;
      }
      
      // Filter by message types (exclude system messages from filtering)
      if (message.type !== 'system' && !messageTypes.includes(message.type as 'text' | 'media' | 'call')) {
        return false;
      }
      
      // Filter by search keyword
      if (searchKeyword && !message.content.toLowerCase().includes(searchKeyword.toLowerCase())) {
        return false;
      }
      
      // Filter by date range
      if (dateRange) {
        const messageDate = message.datetime;
        if (messageDate < dateRange[0] || messageDate > dateRange[1]) {
          return false;
        }
      }
      
      return true;
    });
  }, [rawMessages, selectedSenders, messageTypes, searchKeyword, dateRange]);

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

  // Calculate item height based on type
  const getItemHeight = useCallback((index: number) => {
    const item = chatItems[index];
    if (!item) return ITEM_HEIGHT;
    
    if (item.type === 'date-separator') {
      return DATE_SEPARATOR_HEIGHT;
    }
    
    // Dynamic height calculation based on message content
    const message = item.data as Message;
    const baseHeight = 60;
    const lineHeight = 20;
    const estimatedLines = Math.ceil(message.content.length / 50); // Rough estimate
    const contentHeight = Math.max(1, estimatedLines) * lineHeight;
    const paddingHeight = item.isGrouped ? 4 : 12;
    
    return baseHeight + contentHeight + paddingHeight;
  }, [chatItems]);

  // Jump to specific date
  const jumpToDate = useCallback((date: Date) => {
    const targetIndex = chatItems.findIndex(item => 
      item.type === 'date-separator' && 
      isSameDay(item.data as Date, date)
    );
    
    if (targetIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(targetIndex, 'start');
      setSelectedDate(date);
      setAutoScroll(false);
    }
  }, [chatItems]);

  // Jump to latest messages
  const jumpToLatest = useCallback(() => {
    if (listRef.current && chatItems.length > 0) {
      listRef.current.scrollToItem(chatItems.length - 1, 'end');
      setAutoScroll(true);
      setSelectedDate(null);
    }
  }, [chatItems.length]);

  // Auto-scroll to bottom when new messages arrive (if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && listRef.current && chatItems.length > 0) {
      listRef.current.scrollToItem(chatItems.length - 1, 'end');
    }
  }, [chatItems.length, autoScroll]);

  // Calculate container height dynamically
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const headerHeight = 60; // Header height
        const filterHeight = (selectedSenders.length > 0 || dateRange || messageTypes.length < 3 || searchKeyword) ? 50 : 0;
        const dateNavHeight = showDateNavigator ? 60 : 0;
        const availableHeight = rect.height - headerHeight - filterHeight - dateNavHeight - 20; // 20px for padding
        setContainerHeight(Math.max(300, availableHeight));
      }
    };

    updateHeight();
    const timeoutId = setTimeout(updateHeight, 100); // Small delay for layout to settle
    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
      clearTimeout(timeoutId);
    };
  }, [selectedSenders.length, dateRange, messageTypes.length, searchKeyword, showDateNavigator]);

  // Render individual chat item
  const renderChatItem = useCallback(({ index, style }: ListChildComponentProps) => {
    const item = chatItems[index];
    if (!item) return null;

    return (
      <div style={style}>
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
    );
  }, [chatItems, searchKeyword, selectedDate]);

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

  if (!rawMessages || rawMessages.length === 0) {
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
    <div ref={containerRef} className={clsx('flex flex-col h-full min-h-0', className)}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
            Chat Messages
          </h2>
          <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
            {filteredMessages?.length || 0}
          </span>
          {searchKeyword && (
            <div className="hidden sm:block">
              <SearchHighlight 
                query={searchKeyword} 
                resultCount={filteredMessages?.length || 0}
              />
            </div>
          )}
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
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date Navigator */}
      {showDateNavigator && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <DateNavigator
            messages={filteredMessages || []}
            onDateSelect={jumpToDate}
            onClose={() => setShowDateNavigator(false)}
            selectedDate={selectedDate}
          />
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 min-h-0">
        <List
          ref={listRef}
          height={containerHeight}
          width="100%"
          itemCount={chatItems.length}
          itemSize={ITEM_HEIGHT}
          className="w-full"
          overscanCount={5}
        >
          {renderChatItem}
        </List>
      </div>

      {/* Filter Summary */}
      {(selectedSenders.length > 0 || dateRange || messageTypes.length < 3 || searchKeyword) && (
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 flex-wrap">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Filters active</span>
            </div>
            {selectedSenders.length > 0 && (
              <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs flex-shrink-0">
                {selectedSenders.length} sender{selectedSenders.length !== 1 ? 's' : ''}
              </span>
            )}
            {messageTypes.length < 3 && (
              <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs flex-shrink-0">
                {messageTypes.join(', ')}
              </span>
            )}
            {searchKeyword && (
              <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-xs truncate max-w-xs">
                Search: "{searchKeyword}"
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};