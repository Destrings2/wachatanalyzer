import React, { useMemo, useState } from 'react';
import { format, startOfDay, eachDayOfInterval, isSameDay } from 'date-fns';
import { Message } from '../../types';
import { X, Calendar, Activity, ArrowLeft, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface DateNavigatorProps {
  messages: Message[];
  onDateSelect: (date: Date) => void;
  onClose: () => void;
  selectedDate?: Date | null;
}


export const DateNavigator: React.FC<DateNavigatorProps> = ({
  messages,
  onDateSelect,
  onClose,
  selectedDate
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  // Calculate daily activity for the calendar
  const dailyActivity = useMemo(() => {
    if (!messages.length) return [];

    const messagesByDate = new Map<string, number>();

    // Count messages per day
    messages.forEach(message => {
      const dateKey = format(startOfDay(message.datetime), 'yyyy-MM-dd');
      messagesByDate.set(dateKey, (messagesByDate.get(dateKey) || 0) + 1);
    });

    // Get the date range of all messages
    const sortedMessages = [...messages].sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    const startDate = startOfDay(sortedMessages[0].datetime);
    const endDate = startOfDay(sortedMessages[sortedMessages.length - 1].datetime);

    // Generate all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    return allDays.map(date => ({
      date,
      messageCount: messagesByDate.get(format(date, 'yyyy-MM-dd')) || 0,
      hasActivity: messagesByDate.has(format(date, 'yyyy-MM-dd'))
    }));
  }, [messages]);

  // Get activity for current month view
  const monthActivity = useMemo(() => {
    const monthStart = startOfDay(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    const monthEnd = startOfDay(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0));

    return dailyActivity.filter(day =>
      day.date >= monthStart && day.date <= monthEnd
    );
  }, [dailyActivity, currentMonth]);

  // Get top active days for quick navigation
  const topActiveDays = useMemo(() => {
    return [...dailyActivity]
      .filter(day => day.hasActivity)
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);
  }, [dailyActivity]);

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const getActivityIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count < 10) return 'bg-blue-200 dark:bg-blue-900/40';
    if (count < 50) return 'bg-blue-400 dark:bg-blue-700/60';
    if (count < 100) return 'bg-blue-600 dark:bg-blue-600/80';
    return 'bg-blue-800 dark:bg-blue-500';
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-20 dark:bg-black dark:bg-opacity-30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div className="p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Jump to Date
              </h3>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Navigation - Most Active Days */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Most Active Days
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {topActiveDays.map((day, index) => (
                    <button
                      key={format(day.date, 'yyyy-MM-dd')}
                      onClick={() => handleDateClick(day.date)}
                      className={clsx(
                        'w-full text-left p-3 rounded-lg border transition-colors',
                        selectedDate && isSameDay(selectedDate, day.date)
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {format(day.date, 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {format(day.date, 'EEEE')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            #{index + 1}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {day.messageCount} messages
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendar View */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h4>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mini Calendar */}
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-gray-500 dark:text-gray-400 font-medium">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {Array.from({ length: 42 }, (_, index) => {
                    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                    const startDate = new Date(monthStart);
                    startDate.setDate(startDate.getDate() - monthStart.getDay() + index);

                    const dayActivity = monthActivity.find(activity =>
                      isSameDay(activity.date, startDate)
                    );

                    const isCurrentMonth = startDate.getMonth() === currentMonth.getMonth();
                    const isSelected = selectedDate && isSameDay(selectedDate, startDate);
                    const hasMessages = dayActivity?.hasActivity;

                    return (
                      <button
                        key={index}
                        onClick={() => hasMessages && handleDateClick(startDate)}
                        disabled={!hasMessages}
                        className={clsx(
                          'p-2 text-center rounded transition-colors relative',
                          isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600',
                          hasMessages ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : 'cursor-not-allowed',
                          isSelected && 'ring-2 ring-blue-500 dark:ring-blue-400',
                          !isCurrentMonth && 'opacity-50'
                        )}
                        title={hasMessages ? `${dayActivity?.messageCount} messages` : 'No messages'}
                      >
                        <div className={clsx(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                          hasMessages ? getActivityIntensity(dayActivity?.messageCount || 0) : 'bg-transparent',
                          hasMessages && 'text-white'
                        )}>
                          {startDate.getDate()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded"></div>
                    <span>No messages</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-200 dark:bg-blue-900/40 rounded"></div>
                    <span>Low activity</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-600 dark:bg-blue-600/80 rounded"></div>
                    <span>High activity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
