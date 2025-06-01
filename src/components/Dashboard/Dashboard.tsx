import React, { useMemo } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useFilterStore } from '../../stores/filterStore';
import { StatsOverview } from './StatsOverview';
import { FilterBar } from './FilterBar';
import { ChartContainer } from './ChartContainer';
import { filterMessages, analyzeChat } from '../../utils/analyzer';
import { Moon, Sun, Menu, X } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { analytics, metadata, participants, rawMessages, rawCalls } = useChatStore();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const { selectedSenders, searchKeyword, messageTypes, dateRange } = useFilterStore();
  
  const [selectedChart, setSelectedChart] = React.useState('timeline');

  const chartTypes = [
    { id: 'timeline', name: 'Activity Timeline', icon: '📈' },
    { id: 'heatmap', name: 'Activity Heatmap', icon: '🔥' },
    { id: 'emoji', name: 'Emoji Analysis', icon: '😊' },
    { id: 'wordcloud', name: 'Word Cloud', icon: '💬' },
    { id: 'response', name: 'Response Patterns', icon: '↩️' },
    { id: 'network', name: 'Chat Network', icon: '🕸️' },
  ];

  // Compute filtered analytics
  const filteredAnalytics = useMemo(() => {
    if (!analytics || !metadata || !rawMessages) return analytics;
    
    const originalChat = {
      messages: rawMessages,
      calls: rawCalls || [],
      participants: participants || [],
      metadata
    };
    
    const filteredChat = filterMessages(originalChat, {
      selectedSenders,
      searchKeyword,
      messageTypes,
      dateRange
    });
    
    return analyzeChat(filteredChat);
  }, [analytics, metadata, rawMessages, rawCalls, participants, selectedSenders, searchKeyword, messageTypes, dateRange]);

  if (!analytics || !metadata) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside className={clsx(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className={clsx(
              'font-bold text-gray-900 dark:text-white transition-all duration-300',
              sidebarCollapsed ? 'text-sm' : 'text-xl'
            )}>
              {sidebarCollapsed ? 'CA' : 'Chat Analyzer'}
            </h1>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>

          <nav className="space-y-2">
            {chartTypes.map((chart) => (
              <button
                key={chart.id}
                onClick={() => setSelectedChart(chart.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
                  selectedChart === chart.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                )}
              >
                <span className="text-xl">{chart.icon}</span>
                {!sidebarCollapsed && (
                  <span className="font-medium">{chart.name}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {metadata.chatType === 'individual' ? 'Chat Analysis' : 'Group Chat Analysis'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {metadata.totalMessages.toLocaleString()} messages • {participants.length} participants
              </p>
            </div>
            
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Stats Overview */}
            <StatsOverview analytics={filteredAnalytics || analytics} metadata={metadata} />

            {/* Filter Bar */}
            <FilterBar 
              participants={participants}
              dateRange={[metadata.dateRange.start, metadata.dateRange.end]}
            />

            {/* Chart */}
            <ChartContainer 
              chartType={selectedChart}
              analytics={filteredAnalytics || analytics}
              messages={rawMessages} // Pass filtered messages if needed
            />
          </div>
        </div>
      </div>
    </div>
  );
};