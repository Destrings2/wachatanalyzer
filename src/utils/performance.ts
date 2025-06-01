interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  cacheHit?: boolean;
  dataSize?: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000;
  private static instance: PerformanceMonitor;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start a performance measurement
  startMeasurement(name: string): { name: string; startTime: number } {
    return {
      name,
      startTime: performance.now(),
    };
  }

  // End a performance measurement
  endMeasurement(
    measurement: { name: string; startTime: number },
    metadata?: {
      cacheHit?: boolean;
      dataSize?: number;
      [key: string]: unknown;
    }
  ): void {
    const duration = performance.now() - measurement.startTime;
    
    this.addMetric({
      name: measurement.name,
      duration,
      timestamp: Date.now(),
      cacheHit: metadata?.cacheHit,
      dataSize: metadata?.dataSize,
      metadata: metadata ? { ...metadata } : undefined,
    });
  }

  // Add a metric directly
  addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Get performance statistics
  getStats(timeRangeMs = 60000): {
    totalOperations: number;
    averageDuration: number;
    cacheHitRate: number;
    slowestOperations: PerformanceMetric[];
    operationsByType: Record<string, number>;
    averageDurationByType: Record<string, number>;
  } {
    const cutoff = Date.now() - timeRangeMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        cacheHitRate: 0,
        slowestOperations: [],
        operationsByType: {},
        averageDurationByType: {},
      };
    }

    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const cacheHits = recentMetrics.filter(m => m.cacheHit === true).length;
    const cacheableOperations = recentMetrics.filter(m => m.cacheHit !== undefined).length;

    const operationsByType: Record<string, number> = {};
    const durationByType: Record<string, number[]> = {};

    recentMetrics.forEach(metric => {
      operationsByType[metric.name] = (operationsByType[metric.name] || 0) + 1;
      if (!durationByType[metric.name]) {
        durationByType[metric.name] = [];
      }
      durationByType[metric.name].push(metric.duration);
    });

    const averageDurationByType: Record<string, number> = {};
    Object.entries(durationByType).forEach(([type, durations]) => {
      averageDurationByType[type] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    return {
      totalOperations: recentMetrics.length,
      averageDuration: totalDuration / recentMetrics.length,
      cacheHitRate: cacheableOperations > 0 ? cacheHits / cacheableOperations : 0,
      slowestOperations: recentMetrics
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
      operationsByType,
      averageDurationByType,
    };
  }

  // Get recent metrics
  getRecentMetrics(count = 50): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
  }

  // Log performance warning for slow operations
  checkPerformance(metric: PerformanceMetric, thresholdMs = 1000): void {
    if (metric.duration > thresholdMs) {
      console.warn(
        `Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`,
        { metric }
      );
    }
  }

  // Get performance insights
  getInsights(): string[] {
    const stats = this.getStats();
    const insights: string[] = [];

    if (stats.cacheHitRate > 0) {
      insights.push(`Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);
    }

    if (stats.averageDuration > 100) {
      insights.push(`Average operation time is high: ${stats.averageDuration.toFixed(1)}ms`);
    }

    const slowOperations = Object.entries(stats.averageDurationByType)
      .filter(([, duration]) => duration > 500)
      .sort((a, b) => b[1] - a[1]);

    if (slowOperations.length > 0) {
      insights.push(`Slowest operations: ${slowOperations.map(([op, time]) => 
        `${op} (${time.toFixed(1)}ms)`).join(', ')}`);
    }

    return insights;
  }
}

// Convenience wrapper for measuring async functions
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const monitor = PerformanceMonitor.getInstance();
  const measurement = monitor.startMeasurement(name);
  
  try {
    const result = await fn();
    monitor.endMeasurement(measurement, metadata);
    return result;
  } catch (error) {
    monitor.endMeasurement(measurement, { ...metadata, error: true });
    throw error;
  }
}

// Convenience wrapper for measuring sync functions
export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const monitor = PerformanceMonitor.getInstance();
  const measurement = monitor.startMeasurement(name);
  
  try {
    const result = fn();
    monitor.endMeasurement(measurement, metadata);
    return result;
  } catch (error) {
    monitor.endMeasurement(measurement, { ...metadata, error: true });
    throw error;
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();