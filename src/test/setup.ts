import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Web Workers since they're not available in jsdom
Object.defineProperty(globalThis, 'Worker', {
  value: class Worker {
    constructor(public url: string | URL) {}
    
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  }
})

// Mock URL.createObjectURL for worker imports
if (typeof URL !== 'undefined' && URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'mock-object-url')
}

// Mock performance.now for timing functions
Object.defineProperty(globalThis, 'performance', {
  value: {
    now: vi.fn(() => Date.now())
  }
})

// Mock window.setTimeout for debouncing tests
Object.defineProperty(globalThis, 'setTimeout', {
  value: vi.fn((fn) => {
    fn()
    return 1
  })
})

Object.defineProperty(globalThis, 'clearTimeout', {
  value: vi.fn()
})

// Mock window.matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})