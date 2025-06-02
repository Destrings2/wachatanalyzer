import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { clsx } from 'clsx';

export const FileUploader: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const { loadChatFile, isLoading, error } = useChatStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const txtFile = files.find(file => file.name.endsWith('.txt'));
    
    if (txtFile) {
      await loadChatFile(txtFile);
    }
  }, [loadChatFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.txt')) {
      await loadChatFile(file);
    }
  }, [loadChatFile]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6 lg:mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            WhatsApp Chat Analyzer
          </h1>
          <p className="text-base lg:text-lg text-gray-600 dark:text-gray-300 px-2">
            Upload your exported chat to get beautiful insights
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={clsx(
            'relative border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center transition-all duration-300 touch-manipulation',
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input
            type="file"
            accept=".txt"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="flex flex-col items-center space-y-4 lg:space-y-6">
            <div className={clsx(
              'p-4 lg:p-6 rounded-full transition-colors',
              isDragging 
                ? 'bg-blue-100 dark:bg-blue-800' 
                : 'bg-gray-100 dark:bg-gray-700'
            )}>
              {isLoading ? (
                <div className="w-10 h-10 lg:w-12 lg:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={clsx(
                  'w-10 h-10 lg:w-12 lg:h-12 transition-colors',
                  isDragging 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400'
                )} />
              )}
            </div>
            
            <div className="px-4">
              <p className="text-base lg:text-lg font-medium text-gray-900 dark:text-white mb-1">
                {isLoading ? 'Processing your chat...' : 'Drop your chat export here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                or tap to browse for a .txt file
              </p>
            </div>

            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>WhatsApp chat export (.txt)</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-6 lg:mt-8 text-center px-4">
          <h3 className="text-sm lg:text-base font-medium text-gray-900 dark:text-white mb-3 lg:mb-2">
            How to export your WhatsApp chat:
          </h3>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 lg:space-y-1 text-left lg:text-center max-w-md mx-auto">
            <li>1. Open the chat in WhatsApp</li>
            <li>2. Tap the menu (⋮) and select "More"</li>
            <li>3. Choose "Export chat"</li>
            <li>4. Select "Without media"</li>
            <li>5. Upload the generated .txt file here</li>
          </ol>
        </div>
      </div>
    </div>
  );
};