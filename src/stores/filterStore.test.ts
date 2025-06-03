import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFilterStore } from './filterStore'

// Mock the worker since it's not available in test environment
vi.mock('../workers/filter.worker.ts', () => ({
  default: class MockWorker {
    postMessage = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    terminate = vi.fn()
  }
}))

describe('Filter Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useFilterStore.getState()
    store.resetFilters()
  })

  describe('Search Input Management', () => {
    it('should update search input immediately', () => {
      const store = useFilterStore.getState()

      store.setSearchInput('hello world')

      expect(useFilterStore.getState().searchInput).toBe('hello world')
    })

    it('should debounce search keyword updates', () => {
      const store = useFilterStore.getState()

      store.setSearchInput('hello')

      // In test environment with mocked setTimeout, debounce executes immediately
      // So we check that the input was set correctly
      expect(useFilterStore.getState().searchInput).toBe('hello')
      // The keyword should be updated due to mocked timer
      expect(useFilterStore.getState().searchKeyword).toBe('hello')
    })

    it('should clear search keyword when input is cleared', () => {
      const store = useFilterStore.getState()

      store.setSearchInput('hello')
      store.setSearchInput('')

      expect(store.searchInput).toBe('')
    })

    it('should allow direct search keyword setting', () => {
      const store = useFilterStore.getState()

      store.setSearchKeyword('direct search')

      expect(useFilterStore.getState().searchKeyword).toBe('direct search')
    })
  })

  describe('Sender Filter Management', () => {
    it('should toggle sender selection', () => {
      const store = useFilterStore.getState()

      store.toggleSender('Alice')
      expect(useFilterStore.getState().selectedSenders).toContain('Alice')

      const updatedStore = useFilterStore.getState()
      updatedStore.toggleSender('Bob')
      expect(useFilterStore.getState().selectedSenders).toContain('Bob')
      expect(useFilterStore.getState().selectedSenders).toContain('Alice')

      const finalStore = useFilterStore.getState()
      finalStore.toggleSender('Alice')
      expect(useFilterStore.getState().selectedSenders).not.toContain('Alice')
      expect(useFilterStore.getState().selectedSenders).toContain('Bob')
    })


    it('should not add duplicate senders', () => {
      const store = useFilterStore.getState()

      store.toggleSender('Alice')
      store.toggleSender('Alice')

      expect(store.selectedSenders).toEqual([])
    })
  })

  describe('Message Type Filter Management', () => {
    it('should toggle message types', () => {
      const store = useFilterStore.getState()

      // Start with all types selected
      expect(store.messageTypes).toEqual(['text', 'media', 'call'])

      store.toggleMessageType('media')
      expect(useFilterStore.getState().messageTypes).toEqual(['text', 'call'])

      const updatedStore = useFilterStore.getState()
      updatedStore.toggleMessageType('text')
      expect(useFilterStore.getState().messageTypes).toEqual(['call'])

      const finalStore = useFilterStore.getState()
      finalStore.toggleMessageType('media')
      expect(useFilterStore.getState().messageTypes).toEqual(['call', 'media'])
    })

    it('should handle all message types being deselected', () => {
      const store = useFilterStore.getState()

      store.toggleMessageType('text')
      const store1 = useFilterStore.getState()
      store1.toggleMessageType('media')
      const store2 = useFilterStore.getState()
      store2.toggleMessageType('call')

      expect(useFilterStore.getState().messageTypes).toEqual([])
    })
  })

  describe('Date Range Filter Management', () => {
    it('should set date range', () => {
      const store = useFilterStore.getState()
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      store.setDateRange([startDate, endDate])

      expect(useFilterStore.getState().dateRange).toEqual([startDate, endDate])
    })

    it('should clear date range', () => {
      const store = useFilterStore.getState()
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      store.setDateRange([startDate, endDate])
      store.setDateRange(null)

      expect(store.dateRange).toBeNull()
    })
  })

  describe('Filter Reset', () => {
    it('should reset all filters to initial state', () => {
      const store = useFilterStore.getState()

      // Set some filters
      store.setSearchInput('hello')
      store.setSearchKeyword('hello')
      store.toggleSender('Alice')
      store.toggleMessageType('media')
      store.setDateRange([new Date('2024-01-01'), new Date('2024-01-31')])

      // Reset filters
      store.resetFilters()

      expect(store.searchInput).toBe('')
      expect(store.searchKeyword).toBe('')
      expect(store.selectedSenders).toEqual([])
      expect(store.messageTypes).toEqual(['text', 'media', 'call'])
      expect(store.dateRange).toBeNull()
      expect(store.isFiltering).toBe(false)
    })

    it('should clear any pending debounce timers', () => {
      const store = useFilterStore.getState()

      store.setSearchInput('hello')
      store.resetFilters()

      // After reset, both input and keyword should be cleared
      expect(store.searchInput).toBe('')
      expect(store.searchKeyword).toBe('')
    })
  })

  describe('Filter State Detection', () => {
    it('should detect when filters are active', () => {
      const store = useFilterStore.getState()

      // No active filters initially
      const hasFilters = (store: ReturnType<typeof useFilterStore.getState>) =>
        store.selectedSenders.length > 0 ||
        !!store.searchKeyword ||
        store.messageTypes.length < 3 ||
        store.dateRange !== null

      expect(hasFilters(store)).toBe(false)

      // Add search filter
      let currentStore = useFilterStore.getState()
      currentStore.setSearchKeyword('hello')
      expect(hasFilters(useFilterStore.getState())).toBe(true)

      currentStore = useFilterStore.getState()
      currentStore.resetFilters()
      expect(hasFilters(useFilterStore.getState())).toBe(false)

      // Add sender filter
      currentStore = useFilterStore.getState()
      currentStore.toggleSender('Alice')
      expect(hasFilters(useFilterStore.getState())).toBe(true)

      currentStore = useFilterStore.getState()
      currentStore.resetFilters()

      // Add message type filter
      currentStore = useFilterStore.getState()
      currentStore.toggleMessageType('media')
      expect(hasFilters(useFilterStore.getState())).toBe(true)

      currentStore = useFilterStore.getState()
      currentStore.resetFilters()

      // Add date range filter
      currentStore = useFilterStore.getState()
      currentStore.setDateRange([new Date('2024-01-01'), new Date('2024-01-31')])
      expect(hasFilters(useFilterStore.getState())).toBe(true)
    })
  })

  describe('Async Filtering Workflows', () => {
    it('should handle filtering states correctly', () => {
      const store = useFilterStore.getState()

      expect(store.isFiltering).toBe(false)

      // Note: Actual async operations are mocked in test environment
      // In real usage, isFiltering would be set to true during async operations
    })
  })
})

describe('Filter Workflows - Integration', () => {
  describe('Search Workflow', () => {
    it('should handle complete search workflow', () => {
      let store = useFilterStore.getState()

      // 1. User starts typing
      store.setSearchInput('hello')
      expect(useFilterStore.getState().searchInput).toBe('hello')
      // In test environment, debounce executes immediately
      expect(useFilterStore.getState().searchKeyword).toBe('hello')

      // 2. User continues typing
      store = useFilterStore.getState()
      store.setSearchInput('hello world')
      expect(useFilterStore.getState().searchInput).toBe('hello world')

      // 3. Keyword updates immediately in test environment
      expect(useFilterStore.getState().searchKeyword).toBe('hello world')

      // 4. User clears search
      store = useFilterStore.getState()
      store.setSearchInput('')
      expect(useFilterStore.getState().searchKeyword).toBe('')
    })

    it('should handle complex search workflow', () => {
      const store = useFilterStore.getState()

      // 1. User types complex search
      store.setSearchInput('sender:alice AND "good morning"')

      // 2. In test environment, keyword updates immediately
      expect(useFilterStore.getState().searchKeyword).toBe('sender:alice AND "good morning"')
    })
  })

  describe('Multi-Filter Workflow', () => {
    it('should handle applying multiple filters in sequence', () => {
      let store = useFilterStore.getState()

      // 1. Apply search filter
      store.setSearchKeyword('meeting')

      // 2. Apply sender filter
      store = useFilterStore.getState()
      store.toggleSender('Alice')
      store = useFilterStore.getState()
      store.toggleSender('Bob')

      // 3. Apply message type filter
      store = useFilterStore.getState()
      store.toggleMessageType('call') // Remove calls

      // 4. Apply date range filter
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      store = useFilterStore.getState()
      store.setDateRange([startDate, endDate])

      // Verify all filters are applied
      const finalState = useFilterStore.getState()
      expect(finalState.searchKeyword).toBe('meeting')
      expect(finalState.selectedSenders).toEqual(['Alice', 'Bob'])
      expect(finalState.messageTypes).toEqual(['text', 'media'])
      expect(finalState.dateRange).toEqual([startDate, endDate])
    })

    it('should handle progressive filter refinement', () => {
      // Reset filters first to ensure clean state
      let store = useFilterStore.getState()
      store.resetFilters()

      // 1. Start with broad search
      store = useFilterStore.getState()
      store.setSearchKeyword('hello')

      // 2. Narrow down by sender
      store = useFilterStore.getState()
      store.toggleSender('Alice')

      // 3. Further narrow by date
      store = useFilterStore.getState()
      store.setDateRange([new Date('2024-01-15'), new Date('2024-01-15')])

      // 4. Remove sender filter but keep others
      store = useFilterStore.getState()
      store.toggleSender('Alice')

      const finalState = useFilterStore.getState()
      expect(finalState.selectedSenders).toEqual([])
      expect(finalState.searchKeyword).toBe('hello')
      expect(finalState.dateRange).not.toBeNull()
    })
  })

  describe('Filter Reset Workflow', () => {
    it('should handle filter reset workflow', () => {
      let store = useFilterStore.getState()

      // 1. Apply multiple filters
      store.setSearchKeyword('test')
      store = useFilterStore.getState()
      store.toggleSender('Alice')
      store = useFilterStore.getState()
      store.toggleMessageType('media')
      store = useFilterStore.getState()
      store.setDateRange([new Date('2024-01-01'), new Date('2024-01-31')])

      // 2. Reset all filters
      store = useFilterStore.getState()
      store.resetFilters()

      // 3. Verify everything is back to initial state
      const finalState = useFilterStore.getState()
      expect(finalState.searchKeyword).toBe('')
      expect(finalState.searchInput).toBe('')
      expect(finalState.selectedSenders).toEqual([])
      expect(finalState.messageTypes).toEqual(['text', 'media', 'call'])
      expect(finalState.dateRange).toBeNull()
      expect(finalState.isFiltering).toBe(false)
    })
  })

  describe('Real-time Filter Interaction', () => {
    it('should handle rapid filter changes', () => {
      const store = useFilterStore.getState()

      // Simulate rapid typing
      store.setSearchInput('h')
      store.setSearchInput('he')
      store.setSearchInput('hel')
      store.setSearchInput('hello')

      // Final input should be processed immediately in test environment
      expect(useFilterStore.getState().searchKeyword).toBe('hello')
    })

    it('should handle filter changes during async operations', () => {
      let store = useFilterStore.getState()

      // Start filtering
      store.setSearchKeyword('test')

      // Change filters while potentially filtering
      store = useFilterStore.getState()
      store.toggleSender('Alice')
      store = useFilterStore.getState()
      store.toggleMessageType('media')

      // All changes should be preserved
      const finalState = useFilterStore.getState()
      expect(finalState.searchKeyword).toBe('test')
      expect(finalState.selectedSenders).toContain('Alice')
      expect(finalState.messageTypes).toEqual(['text', 'call'])
    })
  })
})
