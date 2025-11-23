import React from 'react';

interface ChartControlsProps {
    separateBySender?: boolean;
    onSeparateBySenderChange?: (checked: boolean) => void;
    children?: React.ReactNode;
}

export const ChartControls: React.FC<ChartControlsProps> = ({
    separateBySender,
    onSeparateBySenderChange,
    children
}) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50/50 dark:bg-gray-800/50 p-2 rounded-xl border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
                {children}
            </div>

            {onSeparateBySenderChange && (
                <div className="flex items-center gap-3 px-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Separate by Sender</span>
                    <label className="cursor-pointer relative inline-flex items-center">
                        <input
                            type="checkbox"
                            checked={separateBySender}
                            onChange={(e) => onSeparateBySenderChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>
            )}
        </div>
    );
};
