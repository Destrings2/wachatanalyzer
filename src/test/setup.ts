import '@testing-library/jest-dom'

// Mock Web Workers since they're not available in jsdom
global.Worker = class Worker {
  constructor(public url: string | URL) {}
  
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  terminate() {}
} as unknown as typeof Worker

// Mock URL.createObjectURL for worker imports
global.URL.createObjectURL = vi.fn(() => 'mock-object-url')

// Mock performance.now for timing functions
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now())
  }
})

// Mock window.setTimeout for debouncing tests
global.setTimeout = vi.fn((fn) => {
  fn()
  return 1
}) as unknown as typeof setTimeout

global.clearTimeout = vi.fn()