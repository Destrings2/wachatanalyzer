import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface MetricCardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    color: string;
    description?: string;
    trend?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    icon: Icon,
    label,
    value,
    color,
    description,
    trend
}) => {
    return (
        <Tooltip content={description || label}>
            <div className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/20 hover:shadow-md transition-all duration-300 group hover:-translate-y-1`}>
                <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`h-5 w-5 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    {trend && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded-lg">
                            <TrendingUp className="h-3 w-3" />
                            {trend}
                        </span>
                    )}
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
                </div>
            </div>
        </Tooltip>
    );
};
