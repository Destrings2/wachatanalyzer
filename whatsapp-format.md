# WhatsApp Chat Export Format Documentation

## Overview
WhatsApp allows users to export their chat history as a `.txt` file. Despite being a text file, the content follows a structured format that can be parsed into JSON for analysis.

## Export Format

### Raw Text Format
The exported `.txt` file contains messages in this pattern:
```
[DD/MM/YYYY, HH:MM:SS] Sender Name: Message content
```

### Examples
```
[14/08/2023, 09:15:32] John Doe: Hey, how are you?
[14/08/2023, 09:16:45] Jane Smith: I'm good! Just finished the project 🎉
[14/08/2023, 09:17:03] John Doe: <Media omitted>
[14/08/2023, 09:18:21] Jane Smith: image omitted
[14/08/2023, 09:20:15] John Doe: Check out this link https://example.com
[14/08/2023, 10:45:30] Jane Smith: Missed video call
[14/08/2023, 11:00:00] John Doe: Video call, 45 minutes
```

## Message Types

### 1. Text Messages
Regular text content after the sender name.

### 2. Media Messages
- `<Media omitted>` - Generic media placeholder
- `image omitted` - Image was sent
- `video omitted` - Video was sent
- `audio omitted` - Audio/voice message
- `sticker omitted` - Sticker was sent
- `document omitted` - Document/file was sent
- `GIF omitted` - GIF was sent

### 3. Call Information
- `Missed voice call` - Missed audio call
- `Missed video call` - Missed video call
- `Voice call, X minutes` - Completed voice call with duration
- `Video call, X minutes` - Completed video call with duration
- `Video call, X hours Y minutes` - Longer call format

### 4. System Messages
- `Messages and calls are end-to-end encrypted...`
- `You created group "Group Name"`
- `John Doe added Jane Smith`
- `Jane Smith left`
- `You changed the group description`

### 5. Special Content
- URLs are included as plain text
- Emojis are preserved in Unicode
- Multi-line messages maintain line breaks
- Deleted messages show as `This message was deleted`

## Parsing Considerations

### Date/Time Format Variations
Different regions may have different date formats:
- `DD/MM/YYYY` - Most common
- `MM/DD/YYYY` - US format
- `YYYY-MM-DD` - ISO format

Time can be:
- 24-hour format: `HH:MM:SS`
- 12-hour format: `HH:MM:SS AM/PM`

### Sender Name Variations
- Can contain spaces: `John Doe`
- Can contain special characters: `João Silva`
- Can contain emojis: `Sarah 💫`
- Phone numbers: `+1 234 567 8900`

### Message Content Edge Cases
1. **Multi-line messages**: Message content can span multiple lines
2. **Messages with colons**: Content itself might contain `: ` pattern
3. **System messages**: May not follow the standard format
4. **Encoding**: UTF-8 encoding with various languages and scripts

## JSON Structure After Parsing

### Proposed JSON Schema
```json
{
  "messages": [
    {
      "datetime": "2023-08-14T09:15:32",
      "timestamp": 1692010532000,
      "sender": "John Doe",
      "content": "Hey, how are you?",
      "type": "text",
      "metadata": {
        "hasEmoji": false,
        "hasUrl": false,
        "wordCount": 4,
        "charCount": 18
      }
    },
    {
      "datetime": "2023-08-14T09:16:45",
      "timestamp": 1692010605000,
      "sender": "Jane Smith",
      "content": "I'm good! Just finished the project 🎉",
      "type": "text",
      "metadata": {
        "hasEmoji": true,
        "emojis": ["🎉"],
        "hasUrl": false,
        "wordCount": 7,
        "charCount": 38
      }
    },
    {
      "datetime": "2023-08-14T09:17:03",
      "timestamp": 1692010623000,
      "sender": "John Doe",
      "content": "<Media omitted>",
      "type": "media",
      "mediaType": "unknown"
    },
    {
      "datetime": "2023-08-14T09:18:21",
      "timestamp": 1692010701000,
      "sender": "Jane Smith",
      "content": "image omitted",
      "type": "media",
      "mediaType": "image"
    }
  ],
  "calls": [
    {
      "datetime": "2023-08-14T10:45:30",
      "timestamp": 1692016530000,
      "initiator": "Jane Smith",
      "type": "video",
      "status": "missed",
      "duration": 0
    },
    {
      "datetime": "2023-08-14T11:00:00",
      "timestamp": 1692017400000,
      "initiator": "John Doe",
      "type": "video",
      "status": "completed",
      "duration": 45
    }
  ],
  "participants": [
    {
      "name": "John Doe",
      "messageCount": 2,
      "firstMessage": "2023-08-14T09:15:32",
      "lastMessage": "2023-08-14T09:17:03"
    },
    {
      "name": "Jane Smith",
      "messageCount": 2,
      "firstMessage": "2023-08-14T09:16:45",
      "lastMessage": "2023-08-14T09:18:21"
    }
  ],
  "metadata": {
    "exportDate": "2023-08-14T12:00:00",
    "totalMessages": 4,
    "totalCalls": 2,
    "dateRange": {
      "start": "2023-08-14T09:15:32",
      "end": "2023-08-14T11:00:00"
    },
    "chatType": "individual"
  }
}
```

## Parsing Algorithm

### Regular Expression Pattern
```javascript
const messagePattern = /\[(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2})\] (.+?): (.+)/;
```

### Parsing Steps
1. Read file line by line
2. Check if line matches message pattern
3. If not, append to previous message (multi-line)
4. Extract datetime, sender, and content
5. Determine message type from content
6. Extract metadata (emojis, URLs, etc.)
7. Handle special cases (calls, media)

### Type Detection Logic
```javascript
function detectMessageType(content) {
  if (content.includes('omitted')) return 'media';
  if (content.includes('call')) return 'call';
  if (content.startsWith('http')) return 'link';
  return 'text';
}
```

## Privacy Considerations
- Sender names are included as-is
- Phone numbers may be visible
- Message content is unencrypted
- Media files are not included (only references)
- Location sharing shows as coordinates

## Limitations
1. **No media files**: Only references to media
2. **No message IDs**: Cannot track replies/threads
3. **No reaction data**: Emoji reactions not exported
4. **No edit history**: Only final message version
5. **No read receipts**: No delivery/read status
6. **Group info limited**: Member changes but not roles

## Best Practices for Parsing
1. Use UTF-8 encoding when reading file
2. Handle multi-line messages correctly
3. Validate date/time format before parsing
4. Sanitize sender names (trim whitespace)
5. Account for system messages
6. Handle edge cases gracefully
7. Preserve original content for reference