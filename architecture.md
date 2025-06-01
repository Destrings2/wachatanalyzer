# WhatsApp Chat Analyzer Architecture

## Overview
A client-side React application for analyzing WhatsApp chat exports with beautiful D3.js visualizations and real-time interactivity.

## Tech Stack
- **Framework**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: Tailwind CSS + CSS Modules
- **Visualizations**: D3.js
- **Data Processing**: Web Workers
- **Build Tool**: Vite

## Data Format
WhatsApp exports are `.txt` files containing messages in this format:
```
[DD/MM/YYYY, HH:MM:SS] Sender Name: Message content
```

## Core Features

### 1. Statistics & Analytics
- **Message Metrics**: Total messages, images, stickers, videos per sender
- **Response Time Analysis**: Average delay between participants
- **Message Length Distribution**: Character patterns by sender
- **Activity Patterns**: Hourly, daily, weekly heatmaps
- **Emoji Analytics**: Most used emojis with counts
- **Word Frequency**: Interactive word cloud (multi-language stopwords)
- **Call Analytics**: Video call duration heatmaps
- **Time Series Forecasting**: ARIMA predictions for future activity

### 2. Visualizations (D3.js)
- **Interactive Timeline**: Zoomable message density chart
- **Radial Activity Clock**: 24-hour circular heatmap
- **Conversation Flow Sankey**: Topic/keyword flow visualization
- **Response Pattern Network**: Interactive graph showing reply patterns
- **Emoji Bubble Chart**: Animated emoji usage bubbles
- **Message Burst Visualization**: Real-time conversation intensity
- **Sentiment Journey**: Emotional arc with gradient colors
- **Interactive Word Cloud**: Click to filter messages by word
- **Activity Calendar Heatmap**: GitHub-style contribution chart
- **Relationship Chord Diagram**: Message exchange patterns

### 3. User Features
- **Real-time Filtering**: Date range, sender, keyword, message type
- **Export Options**: PNG/SVG charts, CSV data, PDF reports
- **Theme Toggle**: Dark/light mode with smooth transitions
- **Multi-language Support**: Handles various languages and emoji
- **Privacy First**: All processing done client-side

## Architecture

### Component Structure
```
src/
├── components/
│   ├── FileUploader/
│   │   ├── FileUploader.tsx
│   │   ├── FileUploader.module.css
│   │   └── DropZone.tsx
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.module.css
│   │   ├── StatsOverview.tsx
│   │   └── FilterBar.tsx
│   ├── charts/
│   │   ├── ActivityHeatmap/
│   │   ├── MessageTimeline/
│   │   ├── EmojiChart/
│   │   ├── WordCloud/
│   │   ├── NetworkGraph/
│   │   ├── SankeyFlow/
│   │   ├── RadialClock/
│   │   ├── ChordDiagram/
│   │   └── shared/
│   │       ├── ChartContainer.tsx
│   │       ├── Tooltip.tsx
│   │       └── Legend.tsx
│   └── common/
│       ├── ThemeToggle.tsx
│       ├── ExportMenu.tsx
│       └── LoadingSpinner.tsx
├── stores/
│   ├── chatStore.ts
│   ├── uiStore.ts
│   └── filterStore.ts
├── utils/
│   ├── parser.ts
│   ├── analyzer.ts
│   ├── dateHelpers.ts
│   ├── exporters.ts
│   └── constants.ts
├── workers/
│   └── dataProcessor.worker.ts
├── hooks/
│   ├── useD3.ts
│   ├── useResponsive.ts
│   └── useTheme.ts
└── types/
    └── index.ts
```

### Zustand Store Structure
```typescript
// stores/chatStore.ts
interface ChatStore {
  // Raw Data
  rawMessages: Message[]
  rawCalls: Call[]
  
  // Processed Data
  analytics: ProcessedAnalytics
  
  // Actions
  loadChatFile: (file: File) => Promise<void>
  clearData: () => void
}

// stores/filterStore.ts
interface FilterStore {
  dateRange: [Date, Date] | null
  selectedSenders: string[]
  searchKeyword: string
  messageTypes: MessageType[]
  
  // Actions
  setDateRange: (range: [Date, Date] | null) => void
  toggleSender: (sender: string) => void
  setSearchKeyword: (keyword: string) => void
  resetFilters: () => void
}

// stores/uiStore.ts
interface UIStore {
  theme: 'light' | 'dark'
  activeView: 'upload' | 'dashboard' | 'details'
  selectedChart: ChartType | null
  isLoading: boolean
  
  // Actions
  toggleTheme: () => void
  setActiveView: (view: View) => void
  setSelectedChart: (chart: ChartType | null) => void
}
```

### Data Types
```typescript
interface Message {
  datetime: Date
  sender: string
  content: string
  type: 'text' | 'image' | 'video' | 'sticker' | 'document'
  emojis: string[]
  words: string[]
  length: number
}

interface Call {
  datetime: Date
  initiator: string
  duration: number // in minutes
  type: 'completed' | 'missed'
}

interface ProcessedAnalytics {
  messageStats: MessageStats
  timePatterns: TimePatterns
  emojiAnalysis: EmojiAnalysis
  wordFrequency: WordFrequency
  responseMetrics: ResponseMetrics
  callAnalytics: CallAnalytics
}
```

### Data Flow
1. **File Upload** → FileUploader component
2. **Parsing** → Web Worker processes .txt file
3. **Storage** → Parsed data stored in Zustand
4. **Analysis** → Analytics computed and cached
5. **Visualization** → D3 components read from store
6. **Filtering** → Real-time updates trigger re-renders
7. **Export** → Canvas/SVG to file download

### Performance Optimizations
- Web Workers for heavy parsing/analysis
- Virtual scrolling for large message lists
- Memoization of expensive calculations
- Lazy loading of chart components
- Debounced filtering
- Progressive data loading

### Security & Privacy
- No server uploads - all processing client-side
- No external API calls
- No data persistence beyond session
- Sanitized message content display

### Styling Guidelines
- Tailwind utility classes for layout
- CSS Modules for component-specific styles
- CSS variables for theme colors
- Consistent spacing scale (4px base)
- Glass morphism effects for modern look
- Smooth transitions (300ms default)

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- No IE support

### Development Workflow
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint check
npm run format   # Prettier format
```