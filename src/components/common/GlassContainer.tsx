import React from 'react';
import clsx from 'clsx';

interface GlassContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({ children, className }) => {
    return (
        <div className={clsx(
            "bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/20",
            className
        )}>
            {children}
        </div>
    );
};
