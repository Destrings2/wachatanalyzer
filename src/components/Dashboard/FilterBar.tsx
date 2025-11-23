import React, { useState, useRef, useEffect } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { Participant } from '../../types';
import { Calendar, Search, Users, X, Filter, HelpCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { DateRangePicker } from '../DateRangePicker/DateRangePicker';
import { validateSearchQuery, getSearchSuggestions } from '../../utils/searchParser';

interface FilterBarProps {
  participants: Participant[];
  dateRange: [Date, Date];
}

export const FilterBar: React.FC<FilterBarProps> = ({ participants, dateRange }) => {
  const {
    selectedSenders,
    searchInput,
    searchKeyword,
    messageTypes,
    dateRange: filterDateRange,
    setSearchInput,
    toggleSender,
    toggleMessageType,
    setDateRange,
    resetFilters,
  } = useFilterStore();

  const [showSenderDropdown, setShowSenderDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValidation, setSearchValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const messageTypeOptions = [
    { id: 'text', label: 'Text', icon: '💬' },
    { id: 'media', label: 'Media', icon: '📷' },
    { id: 'call', label: 'Calls', icon: '📞' },
  ];

  const hasActiveFilters = selectedSenders.length > 0 || searchKeyword || messageTypes.length < 3 || filterDateRange !== null;
  const suggestions = getSearchSuggestions(searchInput);

  // Quick filter shortcuts
  const quickFilters = [
    { id: 'today', label: 'Today', icon: '📅' },
    { id: 'week', label: 'This Week', icon: '📊' },
    { id: 'month', label: 'This Month', icon: '🗓️' },
  ];

  // Validate search query on input change
  useEffect(() => {
    if (searchInput.trim()) {
      const validation = validateSearchQuery(searchInput);
      setSearchValidation(validation);
    } else {
      setSearchValidation({ valid: true });
    }
  }, [searchInput]);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setSearchInput(suggestion);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  // Handle search input focus/blur
  const handleSearchFocus = () => {
    if (searchInput.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleSearchBlur = (e: React.FocusEvent) => {
    // Don't hide suggestions if clicking on a suggestion
    if (suggestionsRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    if (value.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleDateRangeApply = (range: [Date, Date]) => {
    setDateRange(range);
    setShowDatePicker(false);
  };

  const handleDateRangeReset = () => {
    setDateRange(null);
    setShowDatePicker(false);
  };

  const currentDateRange = filterDateRange || dateRange;

  const handleQuickFilter = (filterId: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filterId) {
      case 'today': {
        setDateRange([today, new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)]);
        break;
      }
      case 'week': {
        const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        setDateRange([weekStart, now]);
        break;
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateRange([monthStart, now]);
        break;
      }
    }
  };

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-white/20">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center mr-2">
          Quick filters:
        </span>
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => handleQuickFilter(filter.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-all touch-manipulation border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
          >
            <span>{filter.icon}</span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-0 lg:min-w-[200px]">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={handleSearchInputChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              className={clsx(
                "w-full pl-10 pr-12 py-3 lg:py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border rounded-xl focus:outline-none focus:ring-2 dark:text-white text-base lg:text-sm transition-all",
                searchValidation.valid
                  ? "border-gray-200 dark:border-gray-700 focus:ring-primary-500/50 focus:border-primary-500"
                  : "border-red-300 dark:border-red-600 focus:ring-red-500/50 focus:border-red-500"
              )}
            />

            {/* Search validation indicator */}
            <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
              {searchInput && (
                searchValidation.valid ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <div title={searchValidation.error}>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                )
              )}
            </div>

            {/* Help button */}
            <button
              onClick={() => setShowSearchHelp(!showSearchHelp)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
              title="Search help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Search suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full mt-2 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 max-h-64 overflow-y-auto custom-scrollbar"
              >
                <div className="p-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 px-2">Suggestions</div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search validation error */}
            {!searchValidation.valid && searchValidation.error && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-red-50/90 dark:bg-red-900/90 backdrop-blur-md border border-red-200 dark:border-red-800 rounded-xl p-3 z-20 shadow-lg animate-in fade-in slide-in-from-top-2">
                <div className="text-xs font-medium text-red-600 dark:text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {searchValidation.error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Buttons Row */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 lg:gap-4">
          {/* Sender Filter */}
          <div className="relative">
            <button
              onClick={() => setShowSenderDropdown(!showSenderDropdown)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 lg:py-2.5 rounded-xl border transition-all w-full sm:w-auto touch-manipulation font-medium text-sm',
                selectedSenders.length > 0
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>
                {selectedSenders.length === 0
                  ? 'All Participants'
                  : `${selectedSenders.length} Selected`}
              </span>
            </button>

            {showSenderDropdown && (
              <div className="absolute top-full mt-2 left-0 w-72 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-10 animate-in fade-in zoom-in-95">
                <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {participants.map((participant) => (
                    <label
                      key={participant.name}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer touch-manipulation transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSenders.includes(participant.name)}
                        onChange={() => toggleSender(participant.name)}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {participant.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {participant.messageCount} messages
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message Type Filter */}
          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 lg:py-2.5 rounded-xl border transition-all w-full sm:w-auto touch-manipulation font-medium text-sm',
                messageTypes.length < 3
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Filter className="w-4 h-4 flex-shrink-0" />
              <span>
                {messageTypes.length === 3
                  ? 'All Types'
                  : `${messageTypes.length} Types`}
              </span>
            </button>

            {showTypeDropdown && (
              <div className="absolute top-full mt-2 left-0 w-56 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-10 animate-in fade-in zoom-in-95">
                <div className="p-2">
                  {messageTypeOptions.map((type) => (
                    <label
                      key={type.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer touch-manipulation transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={messageTypes.includes(type.id as 'text' | 'media' | 'call')}
                        onChange={() => toggleMessageType(type.id as 'text' | 'media' | 'call')}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 w-4 h-4"
                      />
                      <span className="text-lg flex-shrink-0">{type.icon}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 lg:py-2.5 rounded-xl border transition-all w-full sm:w-auto touch-manipulation font-medium text-sm',
                filterDateRange !== null
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {format(currentDateRange[0], 'MMM d, yyyy')} - {format(currentDateRange[1], 'MMM d, yyyy')}
              </span>
            </button>

            {showDatePicker && (
              <DateRangePicker
                dateRange={dateRange}
                currentRange={filterDateRange}
                onApply={handleDateRangeApply}
                onReset={handleDateRangeReset}
              />
            )}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-2 px-4 py-3 lg:py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors w-full sm:w-auto touch-manipulation border border-red-100 dark:border-red-900/50"
            >
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Help Modal */}
      {showSearchHelp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-white/10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6 text-primary-500" />
                Advanced Search Help
              </h3>
              <button
                onClick={() => setShowSearchHelp(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 text-sm">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4" /> Basic Search
                </h4>
                <div className="space-y-2 text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-3">
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-primary-600 dark:text-primary-400">hello</code>
                    <span>Find messages containing "hello"</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-primary-600 dark:text-primary-400">"hello world"</code>
                    <span>Find exact phrase "hello world"</span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">Boolean Operators</h4>
                  <div className="space-y-2 text-gray-600 dark:text-gray-300">
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">hello AND world</code>
                      <span className="text-xs">Both terms must be present</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">hello OR world</code>
                      <span className="text-xs">Either term must be present</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">hello -world</code>
                      <span className="text-xs">Contains "hello" but not "world"</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3">Field Search</h4>
                  <div className="space-y-2 text-gray-600 dark:text-gray-300">
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">sender:john</code>
                      <span className="text-xs">Messages from John</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">content:hello</code>
                      <span className="text-xs">"hello" in content only</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-primary-600 dark:text-primary-400 w-fit">type:media</code>
                      <span className="text-xs">Media messages only</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showSenderDropdown || showTypeDropdown || showDatePicker) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowSenderDropdown(false);
            setShowTypeDropdown(false);
            setShowDatePicker(false);
          }}
        />
      )}
    </div>
  );
};
