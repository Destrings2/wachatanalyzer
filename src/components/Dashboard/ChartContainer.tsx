import React, { Suspense, lazy, useState } from 'react';
import { ProcessedAnalytics, Message } from '../../types';
import { Loader2, Settings, Check } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

// Lazy load chart components
const ActivityTimeline = lazy(() => import('../charts/ActivityTimeline').then(m => ({ default: m.ActivityTimeline })));
const RadialActivityClock = lazy(() => import('../charts/RadialActivityClock').then(m => ({ default: m.RadialActivityClock })));
const CallAnalysis = lazy(() => import('../charts/CallAnalysis').then(m => ({ default: m.CallAnalysis })));
const ActivityHeatmap = lazy(() => import('../charts/ActivityHeatmap').then(m => ({ default: m.ActivityHeatmap })));

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
  const [showSettings, setShowSettings] = useState(false);
  const { chartSettings, updateChartSettings } = useUIStore();
  const renderChart = () => {
    switch (chartType) {
      case 'timeline':
        return <ActivityTimeline analytics={analytics} settings={chartSettings} />;
      case 'radial':
        return <RadialActivityClock analytics={analytics} settings={chartSettings} />;
      case 'calls':
        return <CallAnalysis analytics={analytics} isLoading={isLoading} />;
      case 'heatmap':
        return <ActivityHeatmap analytics={analytics} messages={messages} isLoading={isLoading} />;
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
      {/* Settings Button */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
            title="Chart Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {/* Settings Dropdown */}
          {showSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-4 z-20">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Chart Settings</h3>
              
              <div className="space-y-3">
                {/* Separate Messages by Sender */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Separate by Sender
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={chartSettings.separateMessagesBySender}
                      onChange={(e) => updateChartSettings({ separateMessagesBySender: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      chartSettings.separateMessagesBySender 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {chartSettings.separateMessagesBySender && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </label>

                {/* Show Message Count */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Show Message Count
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={chartSettings.showMessageCount}
                      onChange={(e) => updateChartSettings({ showMessageCount: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      chartSettings.showMessageCount 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {chartSettings.showMessageCount && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </label>

                {/* Enable Animations */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Enable Animations
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={chartSettings.enableAnimations}
                      onChange={(e) => updateChartSettings({ enableAnimations: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      chartSettings.enableAnimations 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300 dark:border-gray-500'
                    }`}>
                      {chartSettings.enableAnimations && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

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
