import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { measureAsync, measureSync, performanceMonitor } from './performance';

// Store original timers
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

describe('performance utils', () => {
  beforeAll(() => {
    // Restore real timers for performance tests
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  });

  afterAll(() => {
    // Reset to mocked timers after tests (for other test files)
    (globalThis as any).setTimeout = vi.fn((fn: Function) => {
      fn();
      return 1;
    });
    (globalThis as any).clearTimeout = vi.fn();
  });

  beforeEach(() => {
    // Clear performance monitor metrics
    performanceMonitor.clear();
  });

  describe('measureAsync function', () => {
    it('measures real asynchronous function execution time', async () => {
      // Create a real async function that takes measurable time
      const asyncFunction = async () => {
        // Simulate work with a small delay
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      };
      
      const result = await measureAsync('async-test', asyncFunction);
      
      expect(result).toBe('async result');
      
      const stats = performanceMonitor.getStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.operationsByType['async-test']).toBe(1);
      expect(stats.averageDurationByType['async-test']).toBeDefined();
      
      // Verify that real time was measured (should be at least 10ms)
      expect(stats.averageDurationByType['async-test']).toBeGreaterThanOrEqual(10);
      expect(stats.averageDurationByType['async-test']).toBeLessThan(50); // Reasonable upper bound
    });

    it('handles async function errors while still measuring', async () => {
      const errorFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('Test error');
      };
      
      await expect(measureAsync('error-test', errorFunction)).rejects.toThrow('Test error');
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['error-test']).toBe(1);
      expect(stats.averageDurationByType['error-test']).toBeGreaterThan(0);
    });

    it('accurately measures multiple async operations', async () => {
      const delays = [5, 10, 15];
      
      for (const delay of delays) {
        await measureAsync('multi-async', async () => {
          await new Promise(resolve => setTimeout(resolve, delay));
        });
      }
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['multi-async']).toBe(3);
      
      // Average should be reasonable
      const avgDuration = stats.averageDurationByType['multi-async'];
      expect(avgDuration).toBeGreaterThanOrEqual(5);
      expect(avgDuration).toBeLessThan(20);
    });
  });

  describe('measureSync function', () => {
    it('measures real synchronous function execution time', () => {
      // Create a sync function that does measurable work
      const syncFunction = () => {
        // Do some CPU-intensive work
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      };
      
      const result = measureSync('sync-test', syncFunction);
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['sync-test']).toBe(1);
      expect(stats.averageDurationByType['sync-test']).toBeGreaterThan(0);
    });

    it('handles sync function errors while still measuring', () => {
      const errorFunction = () => {
        // Do some work before throwing
        for (let i = 0; i < 100000; i++) {
          Math.sqrt(i);
        }
        throw new Error('Sync error');
      };
      
      expect(() => measureSync('sync-error', errorFunction)).toThrow('Sync error');
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['sync-error']).toBe(1);
      expect(stats.averageDurationByType['sync-error']).toBeGreaterThan(0);
    });
  });

  describe('performanceMonitor methods', () => {
    it('tracks measurements with metadata', async () => {
      const measurement = performanceMonitor.startMeasurement('manual-test');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 20));
      
      performanceMonitor.endMeasurement(measurement, { itemCount: 100 });
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['manual-test']).toBe(1);
      expect(stats.averageDurationByType['manual-test']).toBeGreaterThanOrEqual(20);
    });

    it('provides accurate statistics for multiple operations', async () => {
      // Perform different operations
      await measureAsync('op1', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      measureSync('op2', () => {
        let sum = 0;
        for (let i = 0; i < 500000; i++) {
          sum += i;
        }
        return sum;
      });
      
      const stats = performanceMonitor.getStats();
      expect(stats.totalOperations).toBe(2);
      expect(Object.keys(stats.operationsByType)).toHaveLength(2);
      expect(stats.operationsByType['op1']).toBe(1);
      expect(stats.operationsByType['op2']).toBe(1);
    });

    it('calculates cache hit rates correctly', () => {
      // Simulate cache operations
      const measurement1 = performanceMonitor.startMeasurement('cache-op');
      performanceMonitor.endMeasurement(measurement1, { cacheHit: true });
      
      const measurement2 = performanceMonitor.startMeasurement('cache-op');
      performanceMonitor.endMeasurement(measurement2, { cacheHit: false });
      
      const measurement3 = performanceMonitor.startMeasurement('cache-op');
      performanceMonitor.endMeasurement(measurement3, { cacheHit: true });
      
      const stats = performanceMonitor.getStats();
      expect(stats.cacheHitRate).toBe(0.67); // 2/3 cache hits
    });

    it('identifies slow operations', async () => {
      // Fast operation
      await measureAsync('fast-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });
      
      // Slow operation
      await measureAsync('slow-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const insights = performanceMonitor.getInsights();
      const slowOpInsight = insights.find(i => i.includes('slow-op'));
      expect(slowOpInsight).toBeDefined();
      expect(slowOpInsight).toContain('slow');
    });

    it('clears all metrics', async () => {
      await measureAsync('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      let stats = performanceMonitor.getStats();
      expect(stats.totalOperations).toBeGreaterThan(0);
      
      performanceMonitor.clear();
      
      stats = performanceMonitor.getStats();
      expect(stats.totalOperations).toBe(0);
      expect(Object.keys(stats.operationsByType)).toHaveLength(0);
    });

    it('handles concurrent measurements correctly', async () => {
      const promises = [];
      
      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        promises.push(
          measureAsync('concurrent-op', async () => {
            await new Promise(resolve => setTimeout(resolve, 10 + i * 5));
          })
        );
      }
      
      await Promise.all(promises);
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['concurrent-op']).toBe(5);
      expect(stats.averageDurationByType['concurrent-op']).toBeGreaterThan(0);
    });
  });

  describe('real-world usage patterns', () => {
    it('measures file parsing performance', async () => {
      const parseFile = async (content: string) => {
        // Simulate parsing work
        const lines = content.split('\n');
        await new Promise(resolve => setTimeout(resolve, 1));
        
        return lines.map(line => ({
          parsed: line.trim(),
          length: line.length
        }));
      };
      
      const testContent = Array(1000).fill('Test line content').join('\n');
      
      const result = await measureAsync('file-parse', () => parseFile(testContent));
      
      expect(result).toHaveLength(1000);
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['file-parse']).toBe(1);
      expect(stats.averageDurationByType['file-parse']).toBeGreaterThan(0);
    });

    it('measures filtering performance with cache', () => {
      const cache = new Map<string, string[]>();
      
      const filterMessages = (messages: string[], keyword: string) => {
        const cacheKey = keyword;
        const measurement = performanceMonitor.startMeasurement('filter');
        
        if (cache.has(cacheKey)) {
          performanceMonitor.endMeasurement(measurement, { cacheHit: true });
          return cache.get(cacheKey)!;
        }
        
        // Simulate filtering work
        const filtered = messages.filter(m => {
          // Some CPU work
          for (let i = 0; i < 1000; i++) {
            Math.sqrt(i);
          }
          return m.includes(keyword);
        });
        
        cache.set(cacheKey, filtered);
        performanceMonitor.endMeasurement(measurement, { 
          cacheHit: false,
          resultCount: filtered.length 
        });
        
        return filtered;
      };
      
      const messages = Array(100).fill('test message');
      
      // First call - cache miss
      filterMessages(messages, 'test');
      
      // Second call - cache hit
      filterMessages(messages, 'test');
      
      const stats = performanceMonitor.getStats();
      expect(stats.operationsByType['filter']).toBe(2);
      expect(stats.cacheHitRate).toBe(0.5);
    });
  });
});