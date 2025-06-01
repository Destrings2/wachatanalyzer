import { Message, Call, ParsedChat, Participant } from '../types';

// Chunk size for sending results back
const CHUNK_SIZE = 1000;

// Regular expression to match WhatsApp message format
const MESSAGE_REGEX = /\[(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}:\d{2})\] (.+?): (.+)/;

// Helper function to extract emojis from text
function extractEmojis(text: string): string[] {
  try {
    const emojiRegex = /\p{Emoji}/gu;
    return text.match(emojiRegex) || [];
  } catch {
    return [];
  }
}

// Helper function to extract URLs from text
function extractUrls(text: string): string[] {
  try {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    return text.match(urlRegex) || [];
  } catch {
    return [];
  }
}

// Helper function to detect media type
function detectMediaType(content: string): 'image' | 'video' | 'audio' | 'sticker' | 'document' | 'gif' | 'unknown' {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('image omitted')) return 'image';
  if (lowerContent.includes('video omitted')) return 'video';
  if (lowerContent.includes('audio omitted')) return 'audio';
  if (lowerContent.includes('sticker omitted')) return 'sticker';
  if (lowerContent.includes('document omitted')) return 'document';
  if (lowerContent.includes('gif omitted')) return 'gif';
  if (lowerContent.includes('<media omitted>')) return 'unknown';
  return 'unknown';
}

// Helper function to detect a message type
function detectMessageType(content: string): Message['type'] {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('omitted')) return 'media';
  if (lowerContent.includes('call')) return 'call';
  if (
    lowerContent.includes('created group') ||
    lowerContent.includes('added') ||
    lowerContent.includes('left') ||
    lowerContent.includes('changed') ||
    lowerContent.includes('end-to-end encrypted')
  ) {
    return 'system';
  }
  return 'text';
}

// Parse date string to Date object
function parseDate(dateStr: string, timeStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

// Parse call duration from message
function parseCallDuration(message: string): number {
  const durationMatch = message.match(/(\d+)\s*(hours?|minutes?|hrs?|mins?)/gi);
  if (!durationMatch) return 0;

  let totalMinutes = 0;
  durationMatch.forEach(match => {
    const [, value, unit] = match.match(/(\d+)\s*(\w+)/i) || [];
    const numValue = parseInt(value);
    if (unit.toLowerCase().startsWith('h')) {
      totalMinutes += numValue * 60;
    } else {
      totalMinutes += numValue;
    }
  });

  return totalMinutes;
}

function processMessage(
  msg: { datetime: Date; sender: string; content: string },
  messages: Message[],
  calls: Call[],
  participantsMap: Map<string, Participant>
) {
  const type = detectMessageType(msg.content);

  if (type === 'call') {
    // Process call
    const isVideo = msg.content.toLowerCase().includes('video');
    const isMissed = msg.content.toLowerCase().includes('missed');
    const duration = isMissed ? 0 : parseCallDuration(msg.content);

    calls.push({
      datetime: msg.datetime,
      timestamp: msg.datetime.getTime(),
      initiator: msg.sender,
      type: isVideo ? 'video' : 'voice',
      status: isMissed ? 'missed' : 'completed',
      duration,
    });
  } else if (type !== 'system') {
    // Process regular message
    const emojis = extractEmojis(msg.content);
    const urls = extractUrls(msg.content);
    const words = msg.content.split(/\s+/).filter(w => w.length > 0);

    const message: Message = {
      datetime: msg.datetime,
      timestamp: msg.datetime.getTime(),
      sender: msg.sender,
      content: msg.content,
      type,
      mediaType: type === 'media' ? detectMediaType(msg.content) : undefined,
      metadata: {
        hasEmoji: emojis.length > 0,
        emojis: emojis.length > 0 ? emojis : undefined,
        hasUrl: urls.length > 0,
        urls: urls.length > 0 ? urls : undefined,
        wordCount: words.length,
        charCount: msg.content.length,
      },
    };

    messages.push(message);

    // Update participant info
    let participant = participantsMap.get(msg.sender);
    if (!participant) {
      participant = {
        name: msg.sender,
        messageCount: 0,
        mediaCount: 0,
        firstMessage: msg.datetime,
        lastMessage: msg.datetime,
      };
      participantsMap.set(msg.sender, participant);
    }

    participant.messageCount++;
    if (type === 'media') participant.mediaCount++;
    participant.lastMessage = msg.datetime;
  }
}

// Send chunk of messages to main thread
function sendChunk(messages: Message[], calls: Call[], chunkIndex: number, isLast: boolean) {
  self.postMessage({
    type: 'chunk',
    data: {
      messages: messages.slice(0),
      calls: calls.slice(0),
      chunkIndex,
      isLast
    }
  });
}

async function parseWhatsAppChat(content: string): Promise<void> {
  const lines = content.split('\n');
  const messages: Message[] = [];
  const calls: Call[] = [];
  const participantsMap = new Map<string, Participant>();

  let currentMessage: {
    datetime: Date;
    sender: string;
    content: string;
  } | null = null;

  let processed = 0;
  let chunkIndex = 0;
  let messagesInCurrentChunk: Message[] = [];
  let callsInCurrentChunk: Call[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(MESSAGE_REGEX);

    if (match) {
      // Process previous message if exists
      if (currentMessage) {
        const tempMessages: Message[] = [];
        const tempCalls: Call[] = [];
        processMessage(currentMessage, tempMessages, tempCalls, participantsMap);

        // Add to current chunk
        messagesInCurrentChunk.push(...tempMessages);
        callsInCurrentChunk.push(...tempCalls);

        // Send chunk if it's full
        if (messagesInCurrentChunk.length >= CHUNK_SIZE) {
          sendChunk(messagesInCurrentChunk, callsInCurrentChunk, chunkIndex++, false);
          messagesInCurrentChunk = [];
          callsInCurrentChunk = [];
        }
      }

      // Start new message
      const [, dateStr, timeStr, sender, content] = match;
      const datetime = parseDate(dateStr, timeStr);
      currentMessage = { datetime, sender: sender.trim(), content: content.trim() };
    } else if (currentMessage && line.trim()) {
      // Multi-line message continuation
      currentMessage.content += '\n' + line;
    }

    // Send progress updates
    processed++;
    if (processed % 1000 === 0) {
      self.postMessage({
        type: 'progress',
        progress: Math.round((processed / lines.length) * 100),
        processed,
        total: lines.length
      });
    }
  }

  // Process last message
  if (currentMessage) {
    const tempMessages: Message[] = [];
    const tempCalls: Call[] = [];
    processMessage(currentMessage, tempMessages, tempCalls, participantsMap);
    messagesInCurrentChunk.push(...tempMessages);
    callsInCurrentChunk.push(...tempCalls);
  }

  // Send final chunk
  if (messagesInCurrentChunk.length > 0 || callsInCurrentChunk.length > 0) {
    sendChunk(messagesInCurrentChunk, callsInCurrentChunk, chunkIndex++, true);
  }

  // Send participants and metadata separately
  const participants = Array.from(participantsMap.values());

  // Calculate date range iteratively to avoid spread operator
  let minDate = new Date();
  let maxDate = new Date(0);
  let totalMessages = 0;
  let totalCalls = 0;

  // Count totals from participants
  for (const participant of participants) {
    totalMessages += participant.messageCount;
    if (participant.firstMessage < minDate) minDate = participant.firstMessage;
    if (participant.lastMessage > maxDate) maxDate = participant.lastMessage;
  }

  const metadata = {
    exportDate: new Date(),
    totalMessages,
    totalCalls: callsInCurrentChunk.length,
    dateRange: {
      start: minDate,
      end: maxDate,
    },
    chatType: participants.length > 2 ? 'group' : 'individual',
  } as const;

  // Send final result with participants and metadata
  self.postMessage({
    type: 'complete',
    result: { participants, metadata }
  });
}

// Listen for messages from main thread
self.addEventListener('message', async (event) => {
  const { type, content } = event.data;

  if (type === 'parse') {
    try {
      await parseWhatsAppChat(content);
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to parse chat'
      });
    }
  }
});
