import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { useFilterStore } from '../../stores/filterStore';
import { Home } from './Home';
import { FilterBar } from './FilterBar';
import { ChartContainer } from './ChartContainer';
import { ProcessedAnalytics, Message } from '../../types';
import { Moon, Sun, Menu, X, Loader2 } from 'lucide-react';
import { DashboardSkeleton } from '../ui/Skeleton';
import clsx from 'clsx';

// Lazy load ChatView
const ChatView = lazy(() => import('../ChatView/ChatView').then(m => ({ default: m.ChatView })));

export const Dashboard: React.FC = () => {
  const { analytics, metadata, participants, rawMessages, rawCalls } = useChatStore();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const { selectedSenders, searchKeyword, messageTypes, dateRange, filterAndAnalyze, isFiltering, initializeIndices } = useFilterStore();

  const [selectedChart, setSelectedChart] = useState('home');
  const [filteredAnalytics, setFilteredAnalytics] = useState<ProcessedAnalytics | null>(null);
  const [filteredMessages, setFilteredMessages] = useState<Message[] | null>(null);
  const [indicesInitialized, setIndicesInitialized] = useState(false);

  const chartTypes = [
    { id: 'home', name: 'Overview', icon: '🏠' },
    { id: 'search-insights', name: 'Search Insights', icon: '🔍' },
    { id: 'timeline', name: 'Activity Timeline', icon: '📈' },
    { id: 'radial', name: 'Activity Clock', icon: '🕐' },
    { id: 'calls', name: 'Call Analysis', icon: '📞' },
    { id: 'heatmap', name: 'Activity Heatmap', icon: '🔥' },
    { id: 'messages', name: 'Chat Messages', icon: '💬' },
    { id: 'emoji', name: 'Emoji Analysis', icon: '😊' },
    {id: 'wordcloud', name: 'Word Cloud', icon: '📝'},
    { id: 'response', name: 'Response Patterns', icon: '↩️' },
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
      .then((result) => {
        // Small delay to ensure smooth loading transition
        requestAnimationFrame(() => {
          setFilteredAnalytics(result.analytics);
          setFilteredMessages(result.filteredChat.messages);
        });
      })
      .catch(console.error);
  }, [analytics, metadata, rawMessages, rawCalls, participants, selectedSenders, searchKeyword, messageTypes, dateRange, filterAndAnalyze]);

  if (!analytics || !metadata) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex lg:flex-row flex-col">
      {/* Skip to content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        Skip to main content
      </a>

      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden min-h-screen"
          onClick={toggleSidebar}
          style={{ minHeight: '100dvh' }}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
        'lg:relative lg:translate-x-0',
        // Desktop behavior
        'lg:flex lg:flex-col lg:h-full',
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64',
        // Mobile behavior
        'fixed top-0 left-0 min-h-screen h-dvh z-50 lg:z-auto',
        sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0 w-64'
      )}
      style={{ height: '100dvh', minHeight: '100vh' }}>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className={clsx(
              'font-bold text-gray-900 dark:text-white transition-all duration-300',
              sidebarCollapsed ? 'text-sm lg:block hidden' : 'text-xl'
            )}>
              {sidebarCollapsed ? 'CA' : 'Chat Analyzer'}
            </h1>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>
          </div>

          <nav className="space-y-2" role="navigation" aria-label="Chart selection">
            {chartTypes.map((chart, index) => (
              <button
                key={chart.id}
                onClick={() => {
                  setSelectedChart(chart.id);
                  // Auto-close sidebar on mobile after selection
                  if (window.innerWidth < 1024) {
                    toggleSidebar();
                  }
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-3 lg:py-2 rounded-lg transition-all duration-200 touch-manipulation slide-in-left group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                  selectedChart === chart.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 scale-in'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:translate-x-1'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                aria-pressed={selectedChart === chart.id}
                aria-label={`View ${chart.name} chart`}
              >
                <span className="text-xl flex-shrink-0 transition-transform duration-200 group-hover:scale-110">{chart.icon}</span>
                {(!sidebarCollapsed || window.innerWidth < 1024) && (
                  <span className="font-medium transition-colors duration-200">{chart.name}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 lg:px-6 py-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 lg:gap-0 lg:block">
                {/* Mobile menu button */}
                <button
                  onClick={toggleSidebar}
                  className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Toggle navigation menu"
                  aria-expanded={!sidebarCollapsed}
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Dashboard</span>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {chartTypes.find(chart => chart.id === selectedChart)?.name || 'Timeline'}
                    </span>
                  </div>

                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {metadata.chatType === 'individual' ? 'Chat Analysis' : 'Group Chat Analysis'}
                  </h2>
                  <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(filteredAnalytics?.messageStats.totalMessages || metadata.totalMessages).toLocaleString()} messages • {participants.length} participants
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation flex-shrink-0"
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
        <main id="main-content" className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 min-h-full">
            {/* Filter Bar */}
            <FilterBar
              participants={participants}
              dateRange={[metadata.dateRange.start, metadata.dateRange.end]}
            />

            {/* Content based on selected view */}
            {selectedChart === 'home' ? (
              <Home
                analytics={filteredAnalytics || analytics}
                metadata={metadata}
                participants={participants}
              />
            ) : selectedChart === 'messages' ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height: 'calc(100vh - 300px)' }}>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-64 lg:h-96 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-sm font-medium">Loading chat...</span>
                      </div>
                    </div>
                  }
                >
                  <ChatView messages={filteredMessages || rawMessages} />
                </Suspense>
              </div>
            ) : (
              <ChartContainer
                chartType={selectedChart}
                analytics={filteredAnalytics || analytics}
                messages={filteredMessages || rawMessages}
                isLoading={isFiltering}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
