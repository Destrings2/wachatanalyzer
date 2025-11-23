import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Message } from '../../types';
import { getSenderColorByName } from '../../utils/senderUtils';
import { useTheme } from '../../hooks/useTheme';
import { useChatStore } from '../../stores/chatStore';
import { parseSearchQuery, findMatchPositions, MatchPosition } from '../../utils/searchParser';
import {
  Phone,
  Video,
  Image,
  FileText,
  Music,
  Download,
  ExternalLink,
  Clock
} from 'lucide-react';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
  isLastInGroup?: boolean;
  searchQuery?: string;
  className?: string;
}

interface MessageContentProps {
  content: string;
  searchQuery?: string;
  field?: 'content' | 'sender';
}

// Helper function to render highlighted text based on match positions
const renderHighlightedText = (text: string, positions: MatchPosition[]): React.ReactNode[] => {
  if (positions.length === 0) return [text];

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  positions.forEach((pos, index) => {
    // Add text before the match
    if (pos.start > lastIndex) {
      result.push(text.slice(lastIndex, pos.start));
    }

    // Add highlighted match with different styles based on type
    const matchText = text.slice(pos.start, pos.end);
    const highlightClass = clsx(
      'rounded px-1',
      pos.type === 'phrase' && 'bg-blue-200 dark:bg-blue-900/50 text-gray-900 dark:text-white',
      pos.type === 'regex' && 'bg-purple-200 dark:bg-purple-900/50 text-gray-900 dark:text-white',
      pos.type === 'wildcard' && 'bg-green-200 dark:bg-green-900/50 text-gray-900 dark:text-white',
      pos.type === 'term' && 'bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-white'
    );

    result.push(
      <mark key={`highlight-${index}`} className={highlightClass}>
        {matchText}
      </mark>
    );

    lastIndex = pos.end;
  });

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
};

// Component to highlight search terms in message content using sophisticated search parser
const MessageContent: React.FC<MessageContentProps> = ({ content, searchQuery, field = 'content' }) => {
  const highlightedContent = useMemo(() => {
    if (!searchQuery?.trim()) {
      return content;
    }

    try {
      // Parse the search query using the sophisticated parser
      const parsedQuery = parseSearchQuery(searchQuery);
      if (!parsedQuery) {
        return content; // No valid query, return original content
      }

      // Find match positions using the parser
      const matchPositions = findMatchPositions(parsedQuery, content, field);

      // Render highlighted text
      return renderHighlightedText(content, matchPositions);
    } catch (error) {
      console.warn('Error highlighting search matches:', error);

      // Fallback to simple highlighting for edge cases
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = content.split(regex);

      return parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-white rounded px-1">
            {part}
          </mark>
        ) : part
      );
    }
  }, [content, searchQuery, field]);

  return <>{highlightedContent}</>;
};

// Component for media message preview
const MediaPreview: React.FC<{ message: Message }> = ({ message }) => {
  const getMediaIcon = () => {
    switch (message.mediaType) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      default:
        return <Download className="w-4 h-4" />;
    }
  };

  const getMediaLabel = () => {
    switch (message.mediaType) {
      case 'image':
        return 'Photo';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      case 'document':
        return 'Document';
      case 'sticker':
        return 'Sticker';
      case 'gif':
        return 'GIF';
      default:
        return 'Media';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm opacity-75">
      {getMediaIcon()}
      <span>{getMediaLabel()}</span>
    </div>
  );
};

// Component for call message
const CallMessage: React.FC<{ message: Message }> = ({ message }) => {
  // Extract call info from message content (this would depend on your parsing logic)
  const isVideoCall = message.content.toLowerCase().includes('video');
  const isMissed = message.content.toLowerCase().includes('missed');

  return (
    <div className="flex items-center gap-2 text-sm">
      {isVideoCall ? (
        <Video className="w-4 h-4" />
      ) : (
        <Phone className="w-4 h-4" />
      )}
      <span className={clsx(
        isMissed && 'text-red-600 dark:text-red-400'
      )}>
        {isVideoCall ? 'Video call' : 'Voice call'}
        {isMissed && ' (missed)'}
      </span>
    </div>
  );
};

// Component for URLs in messages
const UrlPreview: React.FC<{ urls: string[] }> = ({ urls }) => {
  if (!urls.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {urls.map((url, index) => (
        <div key={index} className="flex items-center gap-2 text-xs opacity-75 hover:opacity-100 transition-opacity">
          <ExternalLink className="w-3 h-3" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-xs"
          >
            {url}
          </a>
        </div>
      ))}
    </div>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGrouped = false,
  isLastInGroup = false,
  searchQuery,
  className
}) => {
  const { theme } = useTheme();
  const { participants } = useChatStore();

  const allSenders = participants.map(p => p.name);
  const senderColor = getSenderColorByName(message.sender, allSenders, theme);
  const timestamp = format(message.datetime, 'HH:mm');
  const isSystemMessage = message.type === 'system';

  // Determine if this is a "sent" or "received" message
  const isSentMessage = message.sender.toLowerCase().includes('you') ||
    message.sender.toLowerCase().includes('me');

  if (isSystemMessage) {
    return (
      <div className={clsx('flex justify-center py-2', className)}>
        <div className="px-4 py-1.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full max-w-xs text-center border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
          <MessageContent content={message.content} searchQuery={searchQuery} />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'px-4 py-0.5 transition-all duration-200 hover:bg-white/5 dark:hover:bg-white/5',
      isGrouped ? 'pt-0.5' : 'pt-4',
      isLastInGroup ? 'pb-4' : 'pb-0.5',
      className
    )}>
      <div className={clsx(
        'flex items-end gap-3 max-w-4xl mx-auto',
        isSentMessage ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        {!isGrouped && (
          <div
            className={clsx(
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md ring-2 ring-white dark:ring-gray-900',
              isSentMessage ? 'ml-1' : 'mr-1'
            )}
            style={{ backgroundColor: senderColor }}
          >
            {message.sender.charAt(0).toUpperCase()}
          </div>
        )}
        {isGrouped && <div className="w-9 h-9 shrink-0" />}

        {/* Message bubble */}
        <div className={clsx(
          'flex flex-col max-w-lg',
          isSentMessage ? 'items-end' : 'items-start',
          isGrouped && (isSentMessage ? 'mr-0' : 'ml-0')
        )}>
          {/* Sender name (only if not grouped and not sent message) */}
          {!isGrouped && !isSentMessage && (
            <div
              className="text-xs font-bold mb-1 px-1"
              style={{ color: senderColor }}
            >
              <MessageContent content={message.sender} searchQuery={searchQuery} field="sender" />
            </div>
          )}

          {/* Message content */}
          <div className={clsx(
            'relative px-4 py-2.5 max-w-full break-words shadow-sm transition-all duration-200',
            isSentMessage ? [
              'bg-gradient-to-br from-primary-500 to-secondary-500 text-white',
              'rounded-2xl rounded-tr-sm',
              'shadow-primary-500/20'
            ] : [
              'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
              'border border-gray-100 dark:border-gray-700',
              'rounded-2xl rounded-tl-sm',
              'shadow-sm'
            ]
          )}>
            {/* Message type specific content */}
            {message.type === 'call' ? (
              <CallMessage message={message} />
            ) : message.type === 'media' ? (
              <div className="space-y-2">
                <MediaPreview message={message} />
                {message.content && (
                  <div className="text-sm">
                    <MessageContent content={message.content} searchQuery={searchQuery} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm leading-relaxed">
                <MessageContent content={message.content} searchQuery={searchQuery} />

                {/* URLs preview */}
                {message.metadata.hasUrl && message.metadata.urls && (
                  <UrlPreview urls={message.metadata.urls} />
                )}

                {/* Emoji display for emoji-heavy messages */}
                {message.metadata.hasEmoji && message.metadata.emojis && message.metadata.emojis.length > 3 && (
                  <div className="mt-2 text-lg tracking-widest">
                    {message.metadata.emojis.slice(0, 10).join(' ')}
                    {message.metadata.emojis.length > 10 && '...'}
                  </div>
                )}
              </div>
            )}

            {/* Timestamp */}
            <div className={clsx(
              'flex items-center gap-1 mt-1 text-[10px] font-medium',
              isSentMessage ? 'justify-end text-white/70' : 'justify-start text-gray-400 dark:text-gray-500'
            )}>
              <Clock className="w-3 h-3" />
              <span>{timestamp}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};