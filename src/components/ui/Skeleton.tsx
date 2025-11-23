import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  animate?: boolean;
  as?: React.ElementType;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  animate = true,
  as: Component = 'div',
  ...props
}) => {
  return (
    <Component
      role="status"
      aria-label="Loading..."
      className={clsx(
        'bg-gray-200 dark:bg-gray-700 rounded',
        animate && 'animate-pulse',
        className
      )}
      {...props}
    />
  );
};

// Specific skeleton components for different UI elements
export const MessageSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={clsx('space-y-2 p-3', className)}>
      <div className="flex items-start space-x-2">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: number; className?: string }> = ({ height = 400, className = '' }) => {
  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-200 dark:border-gray-700', className)}>
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className={`w-full`} style={{ height: `${height}px` }} />
      <div className="flex justify-center mt-4">
        <Skeleton className="h-12 w-full max-w-lg" />
      </div>
    </div>
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3 lg:mb-4">
        <Skeleton className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg" />
      </div>
      <Skeleton className="h-8 lg:h-10 w-16 mb-2" />
      <Skeleton className="h-4 w-20 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
};

export const StatsOverviewSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 lg:gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
};

export const FilterBarSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-4">
        {/* Search Input Skeleton */}
        <div className="flex-1 min-w-0 lg:min-w-[200px]">
          <Skeleton className="h-12 lg:h-10 w-full rounded-lg" />
        </div>
        
        {/* Filter Buttons Skeleton */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 lg:gap-4">
          <Skeleton className="h-12 lg:h-10 w-full sm:w-32 rounded-lg" />
          <Skeleton className="h-12 lg:h-10 w-full sm:w-24 rounded-lg" />
          <Skeleton className="h-12 lg:h-10 w-full sm:w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export const DashboardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={clsx('min-h-screen bg-gray-50 dark:bg-gray-900 flex lg:flex-row flex-col', className)}>
      {/* Sidebar Skeleton */}
      <aside className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-64 hidden lg:block">
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Skeleton */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 lg:px-6 py-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </header>

        {/* Content Skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            <FilterBarSkeleton />
            <StatsOverviewSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
};

export const FileUploaderSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6 lg:mb-8">
          <Skeleton className="h-10 lg:h-12 w-64 mx-auto mb-2" />
          <Skeleton className="h-6 w-80 mx-auto" />
        </div>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 lg:p-12 text-center">
          <div className="flex flex-col items-center space-y-4 lg:space-y-6">
            <Skeleton className="w-16 h-16 lg:w-20 lg:h-20 rounded-full" />
            <div className="px-4">
              <Skeleton className="h-6 lg:h-7 w-64 mb-2 mx-auto" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        <div className="mt-6 lg:mt-8 text-center px-4">
          <Skeleton className="h-5 w-48 mx-auto mb-3" />
          <div className="space-y-2 max-w-md mx-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};