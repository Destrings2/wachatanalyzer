import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useFilterStore } from '../../stores/filterStore';
import { StatsOverview } from './StatsOverview';
import { FilterBar } from './FilterBar';
import { ChartContainer } from './ChartContainer';
import { ProcessedAnalytics } from '../../types';
import { Moon, Sun, Menu, X } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { analytics, metadata, participants, rawMessages, rawCalls } = useChatStore();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const { selectedSenders, searchKeyword, messageTypes, dateRange, filterAndAnalyze, isFiltering, initializeIndices } = useFilterStore();
  
  const [selectedChart, setSelectedChart] = useState('timeline');
  const [filteredAnalytics, setFilteredAnalytics] = useState<ProcessedAnalytics | null>(null);
  const [indicesInitialized, setIndicesInitialized] = useState(false);

  const chartTypes = [
    { id: 'timeline', name: 'Activity Timeline', icon: '📈' },
    { id: 'radial', name: 'Activity Clock', icon: '🕐' },
    { id: 'heatmap', name: 'Activity Heatmap', icon: '🔥' },
    { id: 'emoji', name: 'Emoji Analysis', icon: '😊' },
    { id: 'wordcloud', name: 'Word Cloud', icon: '💬' },
    { id: 'response', name: 'Response Patterns', icon: '↩️' },
    { id: 'network', name: 'Chat Network', icon: '🕸️' },
  ];

  // Reset indices flag when data changes
  useEffect(() => {
    setIndicesInitialized(false);
  }, [rawMessages]);

  // Initialize indices when data is first loaded
  useEffect(() => {
    if (!indicesInitialized && analytics && metadata && rawMessages && rawMessages.length > 0) {
      const originalChat = {
        messages: rawMessages,
        calls: rawCalls || [],
        participants: participants || [],
        metadata
      };
      
      initializeIndices(originalChat)
        .then(() => {
          setIndicesInitialized(true);
        })
        .catch(console.error);
    }
  }, [analytics, metadata, rawMessages, rawCalls, participants, indicesInitialized, initializeIndices]);

  // Apply filters asynchronously when they change
  useEffect(() => {
    if (!analytics || !metadata || !rawMessages) {
      setFilteredAnalytics(null);
      return;
    }
    
    const originalChat = {
      messages: rawMessages,
      calls: rawCalls || [],
      participants: participants || [],
      metadata
    };
    
    // Always apply filters using worker for consistency
    filterAndAnalyze(originalChat)
      .then((analytics) => {
        // Small delay to ensure smooth loading transition
        requestAnimationFrame(() => {
          setFilteredAnalytics(analytics);
        });
      })
      .catch(console.error);
  }, [analytics, metadata, rawMessages, rawCalls, participants, selectedSenders, searchKeyword, messageTypes, dateRange, filterAndAnalyze]);

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
                {(filteredAnalytics?.messageStats.totalMessages || metadata.totalMessages).toLocaleString()} messages • {participants.length} participants
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
            {/* Filter Bar */}
            <FilterBar 
              participants={participants}
              dateRange={[metadata.dateRange.start, metadata.dateRange.end]}
            />

            {/* Stats Overview */}
            <StatsOverview analytics={filteredAnalytics || analytics} metadata={metadata} />

            {/* Chart */}
            <ChartContainer 
              chartType={selectedChart}
              analytics={filteredAnalytics || analytics}
              isLoading={isFiltering}
            />
          </div>
        </div>
      </div>
    </div>
  );
};