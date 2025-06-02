import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Message } from '../../types';
import { getSenderColorByName } from '../../utils/senderUtils';
import { useTheme } from '../../hooks/useTheme';
import { useChatStore } from '../../stores/chatStore';
import { 
  Phone, 
  Video, 
  Image, 
  FileText, 
  Music, 
  Download,
  ExternalLink,
  Clock,
  User
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
}

// Component to highlight search terms in message content
const MessageContent: React.FC<MessageContentProps> = ({ content, searchQuery }) => {
  const highlightedContent = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) {
      return content;
    }

    // Simple highlighting - in a real app, you'd integrate with the search parser
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-900/50 text-gray-900 dark:text-white rounded px-1">
          {part}
        </mark>
      ) : part
    );
  }, [content, searchQuery]);

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
  // For now, we'll use a simple heuristic - you might want to make this configurable
  const isSentMessage = message.sender.toLowerCase().includes('you') || 
                       message.sender.toLowerCase().includes('me');

  if (isSystemMessage) {
    return (
      <div className={clsx('flex justify-center py-2', className)}>
        <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full max-w-xs text-center">
          <MessageContent content={message.content} searchQuery={searchQuery} />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      'px-4 py-1 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50',
      isGrouped ? 'pt-1' : 'pt-3',
      isLastInGroup ? 'pb-3' : 'pb-1',
      className
    )}>
      <div className={clsx(
        'flex items-end gap-2 max-w-4xl mx-auto',
        isSentMessage ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        {!isGrouped && (
          <div 
            className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0',
              isSentMessage ? 'ml-2' : 'mr-2'
            )}
            style={{ backgroundColor: senderColor }}
          >
            <User className="w-4 h-4" />
          </div>
        )}
        
        {/* Message bubble */}
        <div className={clsx(
          'flex flex-col max-w-lg',
          isSentMessage ? 'items-end' : 'items-start',
          isGrouped && (isSentMessage ? 'mr-10' : 'ml-10')
        )}>
          {/* Sender name (only if not grouped and not sent message) */}
          {!isGrouped && !isSentMessage && (
            <div 
              className="text-xs font-medium mb-1 px-3"
              style={{ color: senderColor }}
            >
              {message.sender}
            </div>
          )}
          
          {/* Message content */}
          <div className={clsx(
            'relative rounded-2xl px-4 py-2 max-w-full break-words shadow-sm',
            isSentMessage ? [
              'bg-blue-500 text-white',
              'rounded-br-md'
            ] : [
              'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600',
              'rounded-bl-md'
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
                  <div className="mt-2 text-lg">
                    {message.metadata.emojis.slice(0, 10).join(' ')}
                    {message.metadata.emojis.length > 10 && '...'}
                  </div>
                )}
              </div>
            )}
            
            {/* Timestamp */}
            <div className={clsx(
              'flex items-center gap-1 mt-1 text-xs opacity-60',
              isSentMessage ? 'justify-end text-white' : 'justify-start text-gray-500 dark:text-gray-400'
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