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
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsOverview analytics={analytics} metadata={metadata} />

      {/* Participant Statistics */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Participants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {participants.map((participant) => (
            <div
              key={participant.name}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {participant.name}
                  </h3>
                  <span
                    className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    {participant.messageCount.toLocaleString()} messages
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Media Shared
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {participant.mediaCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      First Message
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {participant.firstMessage.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Last Message
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {participant.lastMessage.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Days Active
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {Math.ceil((participant.lastMessage.getTime() - participant.firstMessage.getTime()) / (1000 * 60 * 60 * 24)).toLocaleString()}
                    </p>
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
