import React, { Suspense, lazy } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import { Loader2 } from 'lucide-react';

// Lazy load chart components
const ActivityTimeline = lazy(() => import('../charts/ActivityTimeline').then(m => ({ default: m.ActivityTimeline })));
const RadialActivityClock = lazy(() => import('../charts/RadialActivityClock').then(m => ({ default: m.RadialActivityClock })));

interface ChartContainerProps {
  chartType: string;
  analytics: ProcessedAnalytics;
  messages: Message[];
  isLoading?: boolean;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  chartType,
  analytics,
  messages,
  isLoading = false
}) => {
  const renderChart = () => {
    switch (chartType) {
      case 'timeline':
        return <ActivityTimeline analytics={analytics} />;
      case 'radial':
        return <RadialActivityClock analytics={analytics} />;
      case 'heatmap':
        return <div className="text-center py-20 text-gray-500">Activity Heatmap - Coming Soon</div>;
      case 'emoji':
        return <div className="text-center py-20 text-gray-500">Emoji Analysis - Coming Soon</div>;
      case 'wordcloud':
        return <div className="text-center py-20 text-gray-500">Word Cloud - Coming Soon</div>;
      case 'response':
        return <div className="text-center py-20 text-gray-500">Response Patterns - Coming Soon</div>;
      case 'network':
        return <div className="text-center py-20 text-gray-500">Chat Network - Coming Soon</div>;
      default:
        return <div className="text-center py-20 text-gray-500">Select a chart type</div>;
    }
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }
      >
        {renderChart()}
      </Suspense>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="font-medium">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
};
