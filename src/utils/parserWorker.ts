import { ParsedChat, Message, Call, Participant, ChatMetadata } from '../types';

export function parseWhatsAppChatWithWorker(
  content: string, 
  onProgress?: (progress: number) => void
): Promise<ParsedChat> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/parser.worker.ts', import.meta.url),
      { type: 'module' }
    );
    
    // Accumulate chunks
    const messages: Message[] = [];
    const calls: Call[] = [];
    let participants: Participant[] = [];
    let metadata: ChatMetadata | null = null;
    
    worker.onmessage = (event) => {
      const { type, data, result, error, progress } = event.data;
      
      switch (type) {
        case 'chunk':
          // Accumulate chunks
          messages.push(...data.messages);
          calls.push(...data.calls);
          break;
          
        case 'complete':
          // Final data with participants and metadata
          participants = result.participants;
          metadata = result.metadata;
          
          worker.terminate();
          
          // Resolve with complete data
          resolve({
            messages,
            calls,
            participants,
            metadata: metadata!
          });
          break;
          
        case 'error':
          worker.terminate();
          reject(new Error(error));
          break;
          
        case 'progress':
          // Emit progress events to callback
          onProgress?.(progress);
          break;
      }
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };
    
    // Start parsing
    worker.postMessage({ type: 'parse', content });
  });
}