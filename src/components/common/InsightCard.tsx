import React from 'react';
import clsx from 'clsx';

interface InsightCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export const InsightCard: React.FC<InsightCardProps> = ({ title, icon, children, className }) => {
    return (
        <div className={clsx(
            "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-sm border border-white/20 p-6 hover:shadow-md transition-all duration-300 hover:-translate-y-1",
            className
        )}>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/50 dark:bg-gray-800/50 rounded-xl shadow-sm">
                    {icon}
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">{title}</h4>
            </div>
            {children}
        </div>
    );
};
