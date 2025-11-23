import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  subDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  subMonths as dateSubMonths
} from 'date-fns';
import clsx from 'clsx';

interface DateRangePickerProps {
  dateRange: [Date, Date];
  currentRange: [Date, Date] | null;
  onApply: (range: [Date, Date]) => void;
  onReset: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  currentRange,
  onApply,
  onReset
}) => {
  const [currentViewDate, setCurrentViewDate] = useState(
    currentRange ? new Date(currentRange[0]) : new Date(dateRange[0])
  );
  const [tempStartDateObj, setTempStartDateObj] = useState<Date | null>(
    currentRange ? currentRange[0] : null
  );
  const [tempEndDateObj, setTempEndDateObj] = useState<Date | null>(
    currentRange ? currentRange[1] : null
  );
  const [isSelectingStart, setIsSelectingStart] = useState(true);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' ? addMonths(currentViewDate, 1) : subMonths(currentViewDate, 1);
    setCurrentViewDate(newDate);
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' ? addYears(currentViewDate, 1) : subYears(currentViewDate, 1);
    setCurrentViewDate(newDate);
  };

  const applyQuickRange = (type: 'thisYear' | 'lastYear' | 'last6months' | 'last30days' | 'last7days') => {
    let start: Date, end: Date;
    const today = new Date();
    const todayEnd = endOfDay(today);

    switch (type) {
      case 'thisYear':
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case 'lastYear':
        start = startOfYear(subYears(today, 1));
        end = endOfYear(subYears(today, 1));
        break;
      case 'last6months':
        start = startOfDay(dateSubMonths(today, 6));
        end = todayEnd;
        break;
      case 'last30days':
        start = startOfDay(subDays(today, 29)); // 29 days ago + today = 30 days total
        end = todayEnd;
        break;
      case 'last7days':
        start = startOfDay(subDays(today, 6)); // 6 days ago + today = 7 days total
        end = todayEnd;
        break;
    }

    // Clamp to available range
    const clampedStart = start < dateRange[0] ? dateRange[0] : start;
    const clampedEnd = end > dateRange[1] ? dateRange[1] : end;

    setTempStartDateObj(clampedStart);
    setTempEndDateObj(clampedEnd);
    setCurrentViewDate(clampedStart);
  };

  // Calendar helper functions
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentViewDate);
    const monthEnd = endOfMonth(currentViewDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const handleDateClick = (date: Date) => {
    // Only allow dates within the available range
    if (date < dateRange[0] || date > dateRange[1]) return;

    if (isSelectingStart || !tempStartDateObj) {
      setTempStartDateObj(date);
      setTempEndDateObj(null);
      setIsSelectingStart(false);
    } else {
      if (date < tempStartDateObj) {
        // If clicked date is before start, make it the new start
        setTempStartDateObj(date);
      } else {
        // Set as end date
        setTempEndDateObj(date);
        setIsSelectingStart(true);
      }
    }
  };

  const getDateClassName = (date: Date) => {
    const isCurrentMonth = isSameMonth(date, currentViewDate);
    const isInRange = date >= dateRange[0] && date <= dateRange[1];
    const isSelected = (tempStartDateObj && isSameDay(date, tempStartDateObj)) ||
                     (tempEndDateObj && isSameDay(date, tempEndDateObj));
    const isInSelectedRange = tempStartDateObj && tempEndDateObj &&
                             isWithinInterval(date, { start: tempStartDateObj, end: tempEndDateObj });

    return clsx(
      'w-8 h-8 flex items-center justify-center text-sm rounded cursor-pointer transition-colors',
      {
        'text-gray-400 dark:text-gray-600': !isCurrentMonth,
        'text-gray-900 dark:text-white': isCurrentMonth && isInRange,
        'text-gray-300 dark:text-gray-700 cursor-not-allowed': !isInRange,
        'bg-blue-600 text-white': isSelected,
        'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100': isInSelectedRange && !isSelected,
        'hover:bg-gray-100 dark:hover:bg-gray-700': isInRange && !isSelected && !isInSelectedRange,
      }
    );
  };

  const handleApply = () => {
    if (tempStartDateObj && tempEndDateObj) {
      const start = startOfDay(tempStartDateObj);
      const end = endOfDay(tempEndDateObj);

      if (start <= end) {
        onApply([start, end]);
      }
    } else if (tempStartDateObj) {
      // If only start date is selected, use it as both start and end
      const date = startOfDay(tempStartDateObj);
      onApply([date, endOfDay(tempStartDateObj)]);
    }
  };

  const handleReset = () => {
    setTempStartDateObj(null);
    setTempEndDateObj(null);
    setIsSelectingStart(true);
    onReset();
  };

  return (
    <div className="absolute top-full mt-2 right-0 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Select Date Range</h3>

        {/* Quick Range Buttons */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Select</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyQuickRange('last7days')}
              className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => applyQuickRange('last30days')}
              className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => applyQuickRange('last6months')}
              className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              Last 6 months
            </button>
            <button
              onClick={() => applyQuickRange('thisYear')}
              className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              This year
            </button>
          </div>
        </div>

        {/* Month/Year Navigation */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Navigate</div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[100px] text-center">
                {format(currentViewDate, 'MMM yyyy')}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateYear('prev')}
                className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Previous year"
              >
                ← Year
              </button>
              <button
                onClick={() => navigateYear('next')}
                className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Next year"
              >
                Year →
              </button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {isSelectingStart ? 'Select start date' : 'Select end date'}
            {tempStartDateObj && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                Start: {format(tempStartDateObj, 'MMM d, yyyy')}
              </span>
            )}
            {tempEndDateObj && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                End: {format(tempEndDateObj, 'MMM d, yyyy')}
              </span>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            {/* Week headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="w-8 h-6 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {getCalendarDays().map(date => (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateClick(date)}
                  className={getDateClassName(date)}
                  disabled={date < dateRange[0] || date > dateRange[1]}
                >
                  {format(date, 'd')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
