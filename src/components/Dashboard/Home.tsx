import React from 'react';
import { ProcessedAnalytics, ChatMetadata, Participant } from '../../types';
import { StatsOverview } from './StatsOverview';

interface HomeProps {
  analytics: ProcessedAnalytics;
  metadata: ChatMetadata;
  participants: Participant[];
}

export const Home: React.FC<HomeProps> = ({ analytics, metadata, participants }) => {
  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <StatsOverview analytics={analytics} metadata={metadata} />

      {/* Participant Statistics */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <span className="w-1 h-8 rounded-full bg-gradient-to-b from-primary-500 to-secondary-500 block" />
          Participants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {participants.map((participant, index) => (
            <div
              key={participant.name}
              className="group relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-sm border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-secondary-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                      {participant.name.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                      {participant.name}
                    </h3>
                  </div>
                  <span
                    className="px-3 py-1 text-xs font-bold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                    {participant.messageCount.toLocaleString()} msgs
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Media Shared
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {participant.mediaCount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Days Active
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {Math.ceil((participant.lastMessage.getTime() - participant.firstMessage.getTime()) / (1000 * 60 * 60 * 24)).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        First Message
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {participant.firstMessage.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        Last Message
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {participant.lastMessage.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
