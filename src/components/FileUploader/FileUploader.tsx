import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { clsx } from 'clsx';

export const FileUploader: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const { loadChatFile, isLoading, error, progress } = useChatStore();

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
    <div className="min-h-dvh relative flex items-center justify-center p-4 lg:p-8 overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[100px] animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary-500/20 blur-[100px] animate-float" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8 lg:mb-12 space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl mb-4 animate-bounce">
            <span className="text-4xl">📊</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            WhatsApp Chat <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-secondary-500">Analyzer</span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
            Unlock insights from your conversations with beautiful, interactive visualizations.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={clsx(
            'relative group rounded-3xl p-1 transition-all duration-500',
            isDragging ? 'scale-105' : 'hover:scale-[1.02]'
          )}
        >
          {/* Glowing border effect */}
          <div className={clsx(
            "absolute inset-0 rounded-3xl bg-gradient-to-r from-primary-500 to-secondary-500 opacity-50 blur-lg transition-opacity duration-500",
            isDragging ? "opacity-100" : "group-hover:opacity-75"
          )} />

          <div className={clsx(
            'relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[22px] p-8 lg:p-16 text-center border border-white/20 shadow-2xl transition-all duration-300',
            isDragging && 'bg-white/90 dark:bg-gray-800/90'
          )}>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />

            <div className="flex flex-col items-center space-y-6 lg:space-y-8 relative z-10">
              <div className={clsx(
                'p-6 rounded-full transition-all duration-500',
                isDragging
                  ? 'bg-primary-100 dark:bg-primary-900/30 scale-110'
                  : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20'
              )}>
                {isLoading ? (
                  <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className={clsx(
                    'w-16 h-16 transition-colors duration-300',
                    isDragging
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500 group-hover:text-primary-500 dark:group-hover:text-primary-400'
                  )} />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                  {isLoading ? 'Analyzing your chat...' : 'Drop your chat file here'}
                </p>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {isLoading ? `${Math.round(progress)}% complete` : 'or click to browse'}
                </p>

                {/* Progress bar */}
                {isLoading && (
                  <div className="mt-6 w-full max-w-xs mx-auto">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-300 ease-out rounded-full relative"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isLoading && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <FileText className="w-3 h-3" />
                  <span>Supports .txt export from WhatsApp</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50/90 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-800 rounded-xl animate-shake" role="alert">
            <div className="flex items-center space-x-3 text-red-800 dark:text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center px-4">
          {[
            { step: 1, text: "Export chat from WhatsApp" },
            { step: 2, text: "Select 'Without Media'" },
            { step: 3, text: "Drop the .txt file above" }
          ].map((item) => (
            <div key={item.step} className="relative p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
                {item.step}
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-2">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
