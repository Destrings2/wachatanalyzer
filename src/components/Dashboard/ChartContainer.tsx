import React, { Suspense, lazy } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import { Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { NoDataState, ErrorState } from '../ui/EmptyState';

// Lazy load chart components
const ActivityTimeline = lazy(() => import('../charts/ActivityTimeline').then(m => ({ default: m.ActivityTimeline })));
const RadialActivityClock = lazy(() => import('../charts/RadialActivityClock').then(m => ({ default: m.RadialActivityClock })));
const CallAnalysis = lazy(() => import('../charts/CallAnalysis').then(m => ({ default: m.CallAnalysis })));
const ActivityHeatmap = lazy(() => import('../charts/ActivityHeatmap').then(m => ({ default: m.ActivityHeatmap })));
const EmojiAnalysis = lazy(() => import('../charts/EmojiAnalysis').then(m => ({ default: m.EmojiAnalysis })));
const WordCloud = lazy(() => import('../charts/WordCloud').then(m => ({ default: m.WordCloud })));
const ResponsePatterns = lazy(() => import('../charts/ResponsePatterns').then(m => ({ default: m.ResponsePatterns })));
const SearchInsights = lazy(() => import('../charts/SearchInsights').then(m => ({ default: m.SearchInsights })));

interface ChartContainerProps {
  chartType: string;
  analytics: ProcessedAnalytics;
  messages: Message[];
  isLoading?: boolean;
  error?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  chartType,
  analytics,
  messages,
  isLoading = false,
  error
}) => {
  const { chartSettings } = useUIStore();

  const renderChart = () => {
    // Handle error state
    if (error) {
      return <ErrorState error={error} />;
    }

    // Handle no data state
    if (!analytics || !messages || messages.length === 0) {
      return <NoDataState />;
    }

    switch (chartType) {
      case 'search-insights':
        return (
          <SearchInsights
            analytics={analytics}
            filteredMessages={messages}
          />
        );
      case 'timeline':
        return <ActivityTimeline analytics={analytics} settings={chartSettings} />;
      case 'radial':
        return <RadialActivityClock analytics={analytics} settings={chartSettings} />;
      case 'calls':
        return <CallAnalysis analytics={analytics} isLoading={isLoading} />;
      case 'heatmap':
        return <ActivityHeatmap analytics={analytics} messages={messages} isLoading={isLoading} />;
      case 'emoji':
        return <EmojiAnalysis analytics={analytics} messages={messages} />;
      case 'wordcloud':
        return <WordCloud analytics={analytics} messages={messages} />;
      case 'response':
        return <ResponsePatterns analytics={analytics} messages={messages} isLoading={isLoading} />;
      default:
        return <NoDataState />;
    }
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6 overflow-hidden">

      <div className="w-full overflow-x-auto">
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="flex items-center justify-center h-64 lg:h-96 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="text-sm font-medium">Loading chart...</span>
                </div>
              </div>
            </div>
          }
        >
          {renderChart()}
        </Suspense>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-gray-600 dark:text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="font-medium text-sm lg:text-base">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};
