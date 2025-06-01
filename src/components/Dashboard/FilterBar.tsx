import React, { useState } from 'react';
import { useFilterStore } from '../../stores/filterStore';
import { Participant } from '../../types';
import { Calendar, Search, Users, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
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
    setSearchInput,
    toggleSender,
    toggleMessageType,
    resetFilters,
  } = useFilterStore();

  const [showSenderDropdown, setShowSenderDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const messageTypeOptions = [
    { id: 'text', label: 'Text', icon: '💬' },
    { id: 'media', label: 'Media', icon: '📷' },
    { id: 'call', label: 'Calls', icon: '📞' },
  ];

  const hasActiveFilters = selectedSenders.length > 0 || searchKeyword || messageTypes.length < 3;

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
                      checked={messageTypes.includes(type.id as any)}
                      onChange={() => toggleMessageType(type.id as any)}
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

        {/* Date Range Display */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {format(dateRange[0], 'MMM d, yyyy')} - {format(dateRange[1], 'MMM d, yyyy')}
          </span>
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
      {(showSenderDropdown || showTypeDropdown) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowSenderDropdown(false);
            setShowTypeDropdown(false);
          }}
        />
      )}
    </div>
  );
};