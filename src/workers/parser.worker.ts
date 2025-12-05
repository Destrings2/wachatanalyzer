import { Message, Call, Participant } from '../types';

// Chunk size for sending results back
const CHUNK_SIZE = 1000;

// Regular expression to match WhatsApp message format
// Regular expression to match WhatsApp message format
const MESSAGE_REGEX = /\[(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}:\d{2})\] (.+?): (.+)/;
const ANDROID_MESSAGE_REGEX = /(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}) - (.+?): (.+)/;
const ANDROID_SYSTEM_REGEX = /(\d{1,2}\/\d{1,2}\/\d{4}), (\d{1,2}:\d{2}) - (.+)/;

// Helper function to extract emojis from text
function extractEmojis(text: string): string[] {
  try {
    // Find all potential emoji sequences including ZWJ sequences
    const matches: string[] = [];
    let match;

    // Use a more comprehensive approach to capture complete emoji sequences
    const advancedEmojiRegex = /(?:(?:\ud83c[\udf00-\udfff])|(?:\ud83d[\udc00-\ude4f\ude80-\udeff])|(?:\ud83e[\udd00-\uddff\ude00-\ude6f\ude70-\ude74\ude78-\ude7a\ude80-\ude86\ude90-\udeac\udeb0-\udeba\udec0-\udec2\uded0-\uded6\udf00-\udf92\udf94-\udf9a\udf9c-\udfad\udfb0-\udfb8\udfc0\udfe0-\udfeb])|(?:\u26c4|\u2600|\u2601|\u26c5|\u26a1|\u2744|\u26c1|\u26aa|\u26ab|\u26bd|\u26be|\u2615|\u26f7|\u26f9|\u2618|\u26fa|\u26fd|\u2696|\u2660|\u2663|\u2665|\u2666|\u26d1|\u26d3|\u26f0|\u26f1|\u26f4|\u26f8|\u2708|\u2692|\u2693|\u2694|\u269a|\u2699|\u269b|\u269c|\u26a0|\u26b0|\u26b1|\u26d4|\u26ea|\u26f2|\u26f3|\u26f5|\u26fa|\u2702|\u2705|\u2708|\u2709|\u270a|\u270b|\u270c|\u270d|\u270f|\u2712|\u2714|\u2716|\u271d|\u2721|\u2728|\u2733|\u2734|\u2744|\u2747|\u274c|\u274e|\u2753|\u2754|\u2755|\u2757|\u2763|\u2764|\u2795|\u2796|\u2797|\u27a1|\u27b0|\u27bf|\u2934|\u2935))(?:\ufe0f)?(?:\u200d(?:(?:\ud83c[\udf00-\udfff])|(?:\ud83d[\udc00-\ude4f\ude80-\udeff])|(?:\ud83e[\udd00-\uddff\ude00-\ude6f\ude70-\ude74\ude78-\ude7a\ude80-\ude86\ude90-\udeac\udeb0-\udeba\udec0-\udec2\uded0-\uded6\udf00-\udf92\udf94-\udf9a\udf9c-\udfad\udfb0-\udfb8\udfc0\udfe0-\udfeb])|\u2640|\u2642|\u2695|\u2696|\u2708|\u2764)(?:\ufe0f)?)*(?:\ud83c[\udffb-\udfff])?/g;

    while ((match = advancedEmojiRegex.exec(text)) !== null) {
      const emoji = match[0];

      // Filter out standalone modifiers, ZWJ, and variation selectors
      if (emoji &&
        emoji !== '\u200D' && // ZWJ
        !/^[\u{1F3FB}-\u{1F3FF}]$/u.test(emoji) && // Standalone skin tone
        !/^[\u{FE00}-\u{FE0F}]$/u.test(emoji) && // Variation selector
        !/^[\u{2640}\u{2642}]$/u.test(emoji) // Standalone gender symbols
      ) {
        matches.push(emoji);
      }
    }

    // Additional filter to exclude basic digits and symbols
    return matches.filter(emoji => {
      // Don't filter out number emojis like 1️⃣, 2️⃣ etc. as they are legitimate emojis
      // Only filter standalone digits
      if (/^[0-9]$/.test(emoji)) return false;
      if (/^[#*]$/.test(emoji)) return false;

      return true;
    });
  } catch {
    return [];
  }
}

// Helper function to extract URLs from text
function extractUrls(text: string): string[] {
  try {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/g;
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
  return new Date(year, month - 1, day, hours, minutes, seconds || 0);
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
  const participantsMap = new Map<string, Participant>();

  let currentMessage: {
    datetime: Date;
    sender: string;
    content: string;
  } | null = null;

  // Detect message format from first 50 lines
  let messageRegex = MESSAGE_REGEX;
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    if (MESSAGE_REGEX.test(lines[i])) {
      messageRegex = MESSAGE_REGEX;
      break;
    }
    if (ANDROID_MESSAGE_REGEX.test(lines[i])) {
      messageRegex = ANDROID_MESSAGE_REGEX;
      break;
    }
  }

  let processed = 0;
  let chunkIndex = 0;
  let messagesInCurrentChunk: Message[] = [];
  let callsInCurrentChunk: Call[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = line.match(messageRegex);

    // Fallback for Android system messages (calls, encryption notices, etc.)
    if (!match && messageRegex === ANDROID_MESSAGE_REGEX) {
      const sysMatch = line.match(ANDROID_SYSTEM_REGEX);
      if (sysMatch) {
        // Reconstruct match array to match the structure expected: [full, date, time, sender, content]
        // System messages don't have a sender, so we assign 'System'
        match = [sysMatch[0], sysMatch[1], sysMatch[2], 'System', sysMatch[3]];
      }
    }

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
