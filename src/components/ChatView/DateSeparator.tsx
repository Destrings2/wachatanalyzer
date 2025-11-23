import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { Calendar } from 'lucide-react';
import clsx from 'clsx';
import React from "react";

interface DateSeparatorProps {
  date: Date;
  className?: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date, className }) => {
  const formatDate = () => {
    if (isToday(date)) {
      return 'Today';
    }

    if (isYesterday(date)) {
      return 'Yesterday';
    }

    // Show day of week for recent dates, full date for older ones
    if (isThisYear(date)) {
      return format(date, 'EEEE, MMMM d'); // e.g., "Monday, March 15"
    }

    return format(date, 'EEEE, MMMM d, yyyy'); // e.g., "Monday, March 15, 2023"
  };

  return (
    <div className={clsx(
      'flex items-center justify-center py-4 px-4',
      'sticky top-0 z-10 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm',
      className
    )}>
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDate()}
        </span>
      </div>
    </div>
  );
};
