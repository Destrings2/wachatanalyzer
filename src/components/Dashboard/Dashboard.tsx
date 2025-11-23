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
    { id: 'wordcloud', name: 'Word Cloud', icon: '📝' },
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
    <div className="min-h-screen flex lg:flex-row flex-col lg:h-screen lg:overflow-hidden bg-transparent">
      {/* Skip to content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-primary-300"
      >
        Skip to main content
      </a>

      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden min-h-screen"
          onClick={toggleSidebar}
          style={{ minHeight: '100dvh' }}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'lg:relative lg:translate-x-0 lg:flex-shrink-0 lg:m-4 lg:rounded-2xl',
        // Glassmorphism style
        'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 shadow-xl',
        // Desktop behavior
        'lg:flex lg:flex-col lg:h-[calc(100vh-2rem)]',
        sidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
        // Mobile behavior
        'fixed top-0 left-0 min-h-screen h-dvh z-50 lg:z-auto w-72',
        sidebarCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
      )}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-6">
          <div className={clsx(
            'flex items-center mb-8 px-4',
            sidebarCollapsed ? 'justify-center' : 'justify-between'
          )}>
            {sidebarCollapsed ? (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Menu className="w-6 h-6" />
              </button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                    WA
                  </div>
                  <h1 className="font-bold text-gray-900 dark:text-white text-xl tracking-tight">
                    Analyzer
                  </h1>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          <nav className="space-y-1 px-3">
            {chartTypes.map((chart, index) => (
              <button
                key={chart.id}
                onClick={() => {
                  setSelectedChart(chart.id);
                  if (window.innerWidth < 1024) {
                    toggleSidebar();
                  }
                }}
                className={clsx(
                  'w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative overflow-hidden',
                  sidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3',
                  selectedChart === chart.id
                    ? 'bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {selectedChart === chart.id && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-500 to-secondary-500 rounded-r-full" />
                )}
                <span className="text-xl flex-shrink-0 transition-transform duration-200 group-hover:scale-110 relative z-10">
                  {chart.icon}
                </span>
                {(!sidebarCollapsed || window.innerWidth < 1024) && (
                  <span className="relative z-10">{chart.name}</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
          <button
            onClick={toggleTheme}
            className={clsx(
              "w-full flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-gray-100/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400",
              sidebarCollapsed && "justify-center"
            )}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
            {(!sidebarCollapsed || window.innerWidth < 1024) && (
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 lg:pt-4 lg:pr-4">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b lg:border border-white/20 lg:rounded-2xl shadow-sm px-4 lg:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  <span className="uppercase tracking-wider">Dashboard</span>
                  <span>/</span>
                  <span className="text-primary-600 dark:text-primary-400">
                    {chartTypes.find(chart => chart.id === selectedChart)?.name}
                  </span>
                </div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  {metadata.chatType === 'individual' ? 'Chat Analysis' : 'Group Chat Analysis'}
                </h2>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {participants.length} Participants
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(filteredAnalytics?.messageStats.totalMessages || metadata.totalMessages).toLocaleString()} Messages
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6 pb-20 lg:pb-0">
            {/* Filter Bar */}
            <FilterBar
              participants={participants}
              dateRange={[metadata.dateRange.start, metadata.dateRange.end]}
            />

            {/* Content based on selected view */}
            <div className="animate-fade-in">
              {selectedChart === 'home' ? (
                <Home
                  analytics={filteredAnalytics || analytics}
                  metadata={metadata}
                  participants={participants}
                />
              ) : selectedChart === 'messages' ? (
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 overflow-hidden h-[calc(100vh-300px)]">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
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
          </div>
        </main>
      </div>
    </div>
  );
};
