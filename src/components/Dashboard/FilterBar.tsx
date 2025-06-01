import React, { useState } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { Participant } from '../../types';
import { Calendar, Search, Users, X, Filter } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import clsx from 'clsx';

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
  const [tempStartDate, setTempStartDate] = useState(
    filterDateRange ? format(filterDateRange[0], 'yyyy-MM-dd') : format(dateRange[0], 'yyyy-MM-dd')
  );
  const [tempEndDate, setTempEndDate] = useState(
    filterDateRange ? format(filterDateRange[1], 'yyyy-MM-dd') : format(dateRange[1], 'yyyy-MM-dd')
  );

  const messageTypeOptions = [
    { id: 'text', label: 'Text', icon: '💬' },
    { id: 'media', label: 'Media', icon: '📷' },
    { id: 'call', label: 'Calls', icon: '📞' },
  ];

  const hasActiveFilters = selectedSenders.length > 0 || searchKeyword || messageTypes.length < 3 || filterDateRange !== null;

  const handleDateRangeApply = () => {
    const start = startOfDay(new Date(tempStartDate));
    const end = endOfDay(new Date(tempEndDate));
    
    if (start <= end) {
      setDateRange([start, end]);
      setShowDatePicker(false);
    }
  };

  const handleDateRangeReset = () => {
    setDateRange(null);
    setTempStartDate(format(dateRange[0], 'yyyy-MM-dd'));
    setTempEndDate(format(dateRange[1], 'yyyy-MM-dd'));
    setShowDatePicker(false);
  };

  const currentDateRange = filterDateRange || dateRange;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>
        </div>

        {/* Sender Filter */}
        <div className="relative">
          <button
            onClick={() => setShowSenderDropdown(!showSenderDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
              selectedSenders.length > 0
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Users className="w-4 h-4" />
            <span>
              {selectedSenders.length === 0
                ? 'All Participants'
                : `${selectedSenders.length} Selected`}
            </span>
          </button>

          {showSenderDropdown && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="p-2 max-h-64 overflow-y-auto">
                {participants.map((participant) => (
                  <label
                    key={participant.name}
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSenders.includes(participant.name)}
                      onChange={() => toggleSender(participant.name)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
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
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
              messageTypes.length < 3
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Filter className="w-4 h-4" />
            <span>
              {messageTypes.length === 3
                ? 'All Types'
                : `${messageTypes.length} Types`}
            </span>
          </button>

          {showTypeDropdown && (
            <div className="absolute top-full mt-2 left-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="p-2">
                {messageTypeOptions.map((type) => (
                  <label
                    key={type.id}
                    className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={messageTypes.includes(type.id as 'text' | 'media' | 'call')}
                      onChange={() => toggleMessageType(type.id as 'text' | 'media' | 'call')}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-lg">{type.icon}</span>
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
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
              filterDateRange !== null
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm">
              {format(currentDateRange[0], 'MMM d, yyyy')} - {format(currentDateRange[1], 'MMM d, yyyy')}
            </span>
          </button>

          {showDatePicker && (
            <div className="absolute top-full mt-2 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Select Date Range</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={tempStartDate}
                      min={format(dateRange[0], 'yyyy-MM-dd')}
                      max={format(dateRange[1], 'yyyy-MM-dd')}
                      onChange={(e) => setTempStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={tempEndDate}
                      min={format(dateRange[0], 'yyyy-MM-dd')}
                      max={format(dateRange[1], 'yyyy-MM-dd')}
                      onChange={(e) => setTempEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleDateRangeApply}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Apply
                  </button>
                  <button
                    onClick={handleDateRangeReset}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Clear</span>
          </button>
        )}
      </div>

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