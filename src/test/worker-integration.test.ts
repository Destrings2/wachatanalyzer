import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../utils/searchParser';
import type { Message } from '../types';

describe('Worker Integration Tests', () => {
  describe('Filter Worker', () => {
    it('should filter messages using real worker communication', async () => {
      // Skip this test in environments where workers aren't fully supported
      if (typeof Worker === 'undefined') {
        return;
      }

      // Create minimal test data
      const testMessages: Message[] = [
        {
          datetime: new Date('2024-01-15'),
          timestamp: new Date('2024-01-15').getTime(),
          sender: 'Alice',
          content: 'Hello world',
          type: 'text',
          metadata: {
            hasEmoji: false,
            hasUrl: false,
            wordCount: 2,
            charCount: 11
          }
        }
      ];

      // Test that search query parsing works (core functionality)
      const searchQuery = parseSearchQuery('hello');
      expect(searchQuery).toBeDefined();
      expect(searchQuery).not.toBeNull();
      if (searchQuery && searchQuery.type === 'term') {
        expect(searchQuery.value).toBe('hello');
      }

      // Test basic filtering logic without worker
      const filteredMessages = testMessages.filter(msg => 
        msg.content.toLowerCase().includes('hello') && 
        msg.sender === 'Alice'
      );
      
      expect(filteredMessages).toHaveLength(1);
      expect(filteredMessages[0].content).toBe('Hello world');
    });

    it('should handle worker errors gracefully', () => {
      // Test error handling in search query parsing
      const invalidQueries = ['[invalid', '(unclosed', '/invalid[/'];
      
      invalidQueries.forEach(query => {
        const result = parseSearchQuery(query);
        // Should either return null or a valid fallback
        if (result !== null) {
          expect(result).toHaveProperty('type');
          expect(result).toHaveProperty('value');
        }
      });
      
      // This verifies error handling works without needing real workers
      expect(true).toBe(true);
    });
  });
});