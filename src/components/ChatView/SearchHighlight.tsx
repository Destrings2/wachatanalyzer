import React from 'react';
import { Search, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filterStore';
import clsx from 'clsx';

interface SearchHighlightProps {
  query: string;
  resultCount: number;
  className?: string;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({
  query,
  resultCount,
  className
}) => {
  const { setSearchKeyword } = useFilterStore();
  
  const clearSearch = () => setSearchKeyword('');

  if (!query.trim()) return null;

  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm',
      className
    )}>
      <Search className="w-3 h-3" />
      <span className="font-medium">
        "{query}"
      </span>
      <span className="text-xs opacity-75">
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>
      <button
        onClick={clearSearch}
        className="p-0.5 hover:bg-yellow-200 dark:hover:bg-yellow-800/50 rounded transition-colors"
        title="Clear search"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};