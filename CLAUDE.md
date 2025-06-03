# Project Context for Claude

This is a React application meant to run client side, there is no Node.JS

## Architecture Overview

### State Management with Zustand

The application uses three distinct stores in `src/stores/`:

1. **chatStore.ts** - Core data management
   - Manages raw chat data (messages, calls, participants)
   - Handles file loading and parsing via Web Workers
   - Processes analytics and maintains loading/error states
   - Implements progress tracking for long operations

2. **filterStore.ts** - Filter and search state
   - Manages all filtering logic (date range, senders, search queries, message types)
   - Implements debounced search input for performance
   - Uses Web Workers for filtering large datasets
   - Includes performance monitoring and result caching
   - Provides async methods `filterMessages()` and `analyzeFiltered()`

3. **uiStore.ts** - UI preferences (persisted)
   - Theme selection (light/dark)
   - View preferences (list/grid)
   - Sidebar collapse state
   - Chart-specific settings

**Best Practices:**
- Always use Web Workers for heavy computations
- Implement caching for expensive operations
- Debounce user inputs that trigger filtering
- Monitor performance with the built-in utilities

### Component Architecture

#### Chart Components (`src/components/charts/`)

All chart components follow this pattern:

```typescript
interface ChartProps {
  analytics: ProcessedAnalytics;
  settings?: ChartSettings;
  messages?: Message[];
  isLoading?: boolean;
}
```

**Key Patterns:**
- Use the `useD3` hook for D3.js lifecycle management
- Implement responsive design with mobile-first approach
- Support dark mode with theme-aware colors
- Add interactive tooltips and hover states
- Export settings through uiStore

**Example Chart Structure:**
1. ActivityHeatmap - Calendar-based activity visualization
2. ActivityTimeline - Time-series message analysis
3. CallAnalysis - Call duration and pattern analysis
4. RadialActivityClock - 24-hour activity pattern

#### Dashboard Components (`src/components/Dashboard/`)

**Component Hierarchy:**
- Dashboard.tsx - Main container with sidebar
- Home.tsx - Overview statistics and quick insights
- StatsOverview.tsx - Key metrics display
- ChartContainer.tsx - Wrapper for chart components
- FilterBar.tsx - Advanced filtering interface

**Best Practices:**
- Lazy load chart components with React.lazy()
- Use Skeleton components during loading
- Implement error boundaries for graceful failures
- Make layouts responsive with Tailwind's responsive utilities

### Filtering System

#### FilterBar Component
The FilterBar is the central filtering interface that manages:
- Advanced search with boolean operators
- Participant selection
- Message type filtering (text, media, calls)
- Date range selection
- Quick filter shortcuts

**Search Query Features:**
- Boolean operators: AND, OR, NOT (-)
- Field searches: `sender:name`, `content:text`, `type:media`
- Phrase matching: `"exact phrase"`
- Wildcards: `hello*`, `*world`
- Regular expressions: `/pattern/`
- Nested queries: `(john OR mary) AND meeting`

#### Filter Processing Flow:
1. User input → FilterBar component
2. FilterBar → filterStore (with debouncing)
3. filterStore → filter.worker.ts (Web Worker)
4. Worker processes with pre-built indices
5. Results cached and returned
6. Analytics recalculated on filtered data
7. Components re-render with new data

### Performance Optimization

#### Web Workers
- **parser.worker.ts** - Handles chat file parsing
- **filter.worker.ts** - Handles filtering and analysis

**Worker Communication Pattern:**
```typescript
// Send to worker
postMessage({
  type: 'FILTER_MESSAGES',
  payload: { messages, filters }
});

// Receive from worker
onMessage((event) => {
  if (event.data.type === 'FILTER_COMPLETE') {
    // Handle results
  }
});
```

#### Caching Strategy
- Use the `cache.ts` utility for performance caching
- Generate cache keys with chat hash
- Implement TTL for cache entries
- Monitor cache hit rates

#### Performance Best Practices:
1. Virtual scrolling for large message lists
2. Debounce search and scroll handlers
3. Memoize expensive computations
4. Use indices for search operations
5. Lazy load heavy components

### TypeScript Patterns

**Type Definitions (`src/types/index.ts`):**
- Use discriminated unions for message types
- Define separate interfaces for raw vs processed data
- Implement type guards for runtime safety
- Use strict null checking

**Common Patterns:**
```typescript
// Discriminated union
type Message = TextMessage | MediaMessage | CallMessage;

// Type guard
function isTextMessage(msg: Message): msg is TextMessage {
  return msg.type === 'text';
}

// Processed data separation
interface RawAnalytics { /* raw data */ }
interface ProcessedAnalytics { /* UI-ready data */ }
```

### UI/UX Guidelines

#### Responsive Design
- Mobile-first approach with Tailwind
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly targets (min 44px)
- Collapsible sidebar on mobile

#### Dark Mode Support
- Use Tailwind's dark: prefix
- Ensure sufficient contrast ratios
- Test all color combinations
- Consider reduced transparency in dark mode

#### Accessibility
- Add ARIA labels to interactive elements
- Implement keyboard navigation
- Ensure focus indicators are visible
- Test with screen readers

### Testing Approach

**Unit Tests:**
- Test pure functions in utils/
- Test store actions and state changes
- Test worker message processing

**Integration Tests:**
- Test filter pipeline end-to-end
- Test file upload and parsing
- Test analytics calculations

**Test Commands:**
```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode
npm run coverage    # Coverage report
```

## Tailwind CSS Quirks

### Dynamic Class Generation Issue
When using template literals for Tailwind classes (e.g., `bg-${color}-50`), Tailwind's purge process may remove unused color variants from the final CSS bundle. This happens because Tailwind can't detect dynamically generated class names during build time.

**Solution**: Add a `safelist` array to `tailwind.config.js` to ensure specific color classes are always included:

```javascript
export default {
  safelist: [
    // MetricCard color classes
    'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50',
    'dark:bg-blue-900/20', 'dark:bg-green-900/20', 'dark:bg-purple-900/20', 'dark:bg-orange-900/20',
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600',
    'dark:text-blue-400', 'dark:text-green-400', 'dark:text-purple-400', 'dark:text-orange-400',
    'text-blue-900', 'text-green-900', 'text-purple-900', 'text-orange-900',
    'dark:text-blue-100', 'dark:text-green-100', 'dark:text-purple-100', 'dark:text-orange-100',
  ],
  // ... rest of config
}
```

This ensures components like `MetricCard` that use dynamic color props work consistently across all color variants.

## Code Style Guidelines

### Component Structure
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useFilterStore } from '../../stores/filterStore';

// 2. Types/Interfaces
interface ComponentProps {
  // Props definition
}

// 3. Component
export const Component: React.FC<ComponentProps> = ({ prop }) => {
  // 4. Hooks
  const { state, action } = useFilterStore();
  
  // 5. State
  const [local, setLocal] = useState();
  
  // 6. Effects
  useEffect(() => {
    // Effect logic
  }, []);
  
  // 7. Handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 8. Render helpers
  const renderItem = () => {
    // Render logic
  };
  
  // 9. Main render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### Naming Conventions
- Components: PascalCase (e.g., `FilterBar`, `MessageBubble`)
- Files: Match component name (e.g., `FilterBar.tsx`)
- Hooks: camelCase with 'use' prefix (e.g., `useD3`, `useTheme`)
- Stores: camelCase with 'Store' suffix (e.g., `filterStore`)
- Types/Interfaces: PascalCase (e.g., `Message`, `ProcessedAnalytics`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_MESSAGES`)

### Common Utilities

**Performance Monitoring:**
```typescript
import { monitor } from '../utils/performance';

const result = await monitor('operationName', async () => {
  // Expensive operation
});
```

**Search Parsing:**
```typescript
import { parseSearchQuery, validateSearchQuery } from '../utils/searchParser';

const query = parseSearchQuery(input);
const validation = validateSearchQuery(input);
```

**Analytics Processing:**
```typescript
import { processAnalytics } from '../utils/analyzer';

const analytics = processAnalytics(messages, participants);
```
