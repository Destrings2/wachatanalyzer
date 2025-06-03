import React from 'react';
import { AlertCircle, FileX, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

interface EmptyStateProps {
  type?: 'no-data' | 'no-results' | 'error' | 'no-filters';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  title,
  description,
  action,
  icon,
  className = ''
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'no-results':
        return <Search className="w-12 h-12" />;
      case 'error':
        return <AlertCircle className="w-12 h-12" />;
      case 'no-filters':
        return <Filter className="w-12 h-12" />;
      default:
        return <FileX className="w-12 h-12" />;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'no-results':
        return 'text-blue-500 dark:text-blue-400';
      case 'no-filters':
        return 'text-purple-500 dark:text-purple-400';
      default:
        return 'text-gray-400 dark:text-gray-500';
    }
  };

  return (
    <div className={clsx(
      'flex flex-col items-center justify-center p-8 lg:p-12 text-center',
      className
    )}>
      <div className={clsx('mb-4', getColorClasses())}>
        {icon || getDefaultIcon()}
      </div>
      
      <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      
      <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {description}
      </p>
      
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

// Specific empty state components
export const NoDataState: React.FC<{ onUpload?: () => void }> = ({ onUpload }) => (
  <EmptyState
    type="no-data"
    title="No data available"
    description="Upload a WhatsApp chat export to start analyzing your conversations."
    action={onUpload ? {
      label: "Upload Chat Export",
      onClick: onUpload
    } : undefined}
  />
);

export const NoResultsState: React.FC<{ onClearFilters?: () => void }> = ({ onClearFilters }) => (
  <EmptyState
    type="no-results"
    title="No results found"
    description="Try adjusting your search terms or filters to find what you're looking for."
    action={onClearFilters ? {
      label: "Clear Filters",
      onClick: onClearFilters
    } : undefined}
  />
);

export const ErrorState: React.FC<{ onRetry?: () => void; error?: string }> = ({ onRetry, error }) => (
  <EmptyState
    type="error"
    title="Something went wrong"
    description={error || "We encountered an error while processing your data. Please try again."}
    action={onRetry ? {
      label: "Try Again",
      onClick: onRetry
    } : undefined}
  />
);

export const NoFiltersState: React.FC<{ onApplyFilters?: () => void }> = ({ onApplyFilters }) => (
  <EmptyState
    type="no-filters"
    title="Apply filters to view data"
    description="Select participants, date ranges, or message types to filter your chat analysis."
    action={onApplyFilters ? {
      label: "Apply Filters",
      onClick: onApplyFilters
    } : undefined}
  />
);