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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center mr-2">
          Quick filters:
        </span>
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => handleQuickFilter(filter.id)}
            className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-manipulation"
          >
            <span>{filter.icon}</span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-0 lg:min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={handleSearchInputChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              className={clsx(
                "w-full pl-10 pr-12 py-3 lg:py-2 bg-gray-50 dark:bg-gray-900 border rounded-lg focus:outline-none focus:ring-2 dark:text-white text-base lg:text-sm",
                searchValidation.valid
                  ? "border-gray-200 dark:border-gray-700 focus:ring-blue-500"
                  : "border-red-300 dark:border-red-600 focus:ring-red-500"
              )}
            />

            {/* Search validation indicator */}
            <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
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
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Search help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Search suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-48 overflow-y-auto"
              >
                <div className="p-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Search suggestions:</div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-mono"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search validation error */}
            {!searchValidation.valid && searchValidation.error && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 z-20">
                <div className="text-xs text-red-600 dark:text-red-400">
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
                'flex items-center gap-2 px-4 py-3 lg:py-2 rounded-lg border transition-colors w-full sm:w-auto touch-manipulation',
                selectedSenders.length > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Users className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm lg:text-sm">
                {selectedSenders.length === 0
                  ? 'All Participants'
                  : `${selectedSenders.length} Selected`}
              </span>
            </button>

            {showSenderDropdown && (
              <div className="absolute top-full mt-2 left-0 w-64 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="p-2 max-h-64 overflow-y-auto">
                  {participants.map((participant) => (
                    <label
                      key={participant.name}
                      className="flex items-center gap-3 px-3 py-3 lg:py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer touch-manipulation"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSenders.includes(participant.name)}
                        onChange={() => toggleSender(participant.name)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 w-4 h-4"
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
                'flex items-center gap-2 px-4 py-3 lg:py-2 rounded-lg border transition-colors w-full sm:w-auto touch-manipulation',
                messageTypes.length < 3
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Filter className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm lg:text-sm">
                {messageTypes.length === 3
                  ? 'All Types'
                  : `${messageTypes.length} Types`}
              </span>
            </button>

            {showTypeDropdown && (
              <div className="absolute top-full mt-2 left-0 w-48 sm:w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="p-2">
                  {messageTypeOptions.map((type) => (
                    <label
                      key={type.id}
                      className="flex items-center gap-3 px-3 py-3 lg:py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer touch-manipulation"
                    >
                      <input
                        type="checkbox"
                        checked={messageTypes.includes(type.id as 'text' | 'media' | 'call')}
                        onChange={() => toggleMessageType(type.id as 'text' | 'media' | 'call')}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 w-4 h-4"
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
                'flex items-center gap-2 px-4 py-3 lg:py-2 rounded-lg border transition-colors w-full sm:w-auto touch-manipulation',
                filterDateRange !== null
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm truncate">
                {format(currentDateRange[0], 'MMM d, yyyy')} - {format(currentDateRange[1], 'MMM d, yyyy')}
              </span>
            </button>

            {showDatePicker && (
              <DateRangePicker
                dateRange={dateRange}
                currentRange={filterDateRange}
                onApply={handleDateRangeApply}
                onReset={handleDateRangeReset}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-2 px-4 py-3 lg:py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors w-full sm:w-auto touch-manipulation"
            >
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Help Modal */}
      {showSearchHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Search Help</h3>
              <button
                onClick={() => setShowSearchHelp(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Basic Search</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">hello</code> - Find messages containing "hello"</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">"hello world"</code> - Find exact phrase "hello world"</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Boolean Operators</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">hello AND world</code> - Both terms must be present</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">hello OR world</code> - Either term must be present</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">hello -world</code> - Contains "hello" but not "world"</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">(john OR mary) AND meeting</code> - Grouping with parentheses</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Field Search</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">sender:john</code> - Messages from John</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">content:hello</code> - "hello" in message content only</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">type:media</code> - Media messages only</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Wildcards and Patterns</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">hello*</code> - Words starting with "hello"</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">*world</code> - Words ending with "world"</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">/\d{3}-\d{3}-\d{4}/</code> - Regular expression patterns</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Examples</h4>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">sender:alice "thank you"</code> - Alice saying "thank you"</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">type:media (john OR mary)</code> - Media from John or Mary</div>
                  <div><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">meeting AND -cancelled</code> - "meeting" but not "cancelled"</div>
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
