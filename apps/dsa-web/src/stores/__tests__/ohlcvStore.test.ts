/**
 * TDD Sprint 4: Tests for useOHLCVStore (Zustand).
 * Written FIRST (RED phase) before implementation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock so it is available before module import
const { mockFetchOHLCV } = vi.hoisted(() => ({
  mockFetchOHLCV: vi.fn(),
}));

vi.mock('../../api/ohlcv', () => ({
  fetchOHLCV: mockFetchOHLCV,
}));

import { useOHLCVStore } from '../ohlcvStore';
import type { OHLCVBar, OHLCVData } from '../../types/ohlcv';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const mockBars: OHLCVBar[] = [
  { date: '2024-01-01', open: 70000, high: 72000, low: 69000, close: 71500, volume: 1_200_000 },
  { date: '2024-01-02', open: 71500, high: 73000, low: 70000, close: 70200, volume: 950_000 },
];

const mockOHLCVData: OHLCVData = {
  stock_code: 'VNM',
  stock_name: 'Vinamilk',
  period: '1d',
  data: mockBars,
};

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('useOHLCVStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOHLCVStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------
  // Initial state
  // ----------------------------------------------------------------

  it('starts with null data, not loading, no error', () => {
    const { data, isLoading, error, symbol, period } = useOHLCVStore.getState();
    expect(data).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
    expect(symbol).toBeNull();
    expect(period).toBe('1d');
  });

  // ----------------------------------------------------------------
  // fetchData — happy path
  // ----------------------------------------------------------------

  it('sets isLoading=true while fetching', async () => {
    let resolvePromise!: (value: OHLCVData) => void;
    mockFetchOHLCV.mockImplementationOnce(
      () => new Promise<OHLCVData>((res) => { resolvePromise = res; }),
    );

    const fetchPromise = useOHLCVStore.getState().fetchData('VNM', '1d');
    expect(useOHLCVStore.getState().isLoading).toBe(true);

    resolvePromise(mockOHLCVData);
    await fetchPromise;
  });

  it('stores data and clears loading/error after successful fetch', async () => {
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);

    await useOHLCVStore.getState().fetchData('VNM', '1d');

    const state = useOHLCVStore.getState();
    expect(state.data).toEqual(mockBars);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('records symbol and period after successful fetch', async () => {
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);

    await useOHLCVStore.getState().fetchData('VNM', '1w');

    const state = useOHLCVStore.getState();
    expect(state.symbol).toBe('VNM');
    expect(state.period).toBe('1w');
  });

  it('calls fetchOHLCV with correct arguments', async () => {
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);

    await useOHLCVStore.getState().fetchData('VNM', '1d');

    expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', '1d');
  });

  it('uses current store period when none provided to fetchData', async () => {
    useOHLCVStore.setState({ period: '1m' });
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);

    await useOHLCVStore.getState().fetchData('VNM');

    expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', '1m');
  });

  // ----------------------------------------------------------------
  // fetchData — error path
  // ----------------------------------------------------------------

  it('sets error and clears loading after fetch failure', async () => {
    mockFetchOHLCV.mockRejectedValueOnce(new Error('Network error'));

    await useOHLCVStore.getState().fetchData('VNM', '1d');

    const state = useOHLCVStore.getState();
    expect(state.error).not.toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('preserves stale data when a refetch fails', async () => {
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);
    await useOHLCVStore.getState().fetchData('VNM', '1d');

    mockFetchOHLCV.mockRejectedValueOnce(new Error('timeout'));
    await useOHLCVStore.getState().fetchData('VNM', '1d');

    // data should still be from the first successful fetch
    expect(useOHLCVStore.getState().data).toEqual(mockBars);
    expect(useOHLCVStore.getState().error).not.toBeNull();
  });

  it('clears previous error on a new successful fetch', async () => {
    mockFetchOHLCV.mockRejectedValueOnce(new Error('fail'));
    await useOHLCVStore.getState().fetchData('VNM', '1d');
    expect(useOHLCVStore.getState().error).not.toBeNull();

    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);
    await useOHLCVStore.getState().fetchData('VNM', '1d');
    expect(useOHLCVStore.getState().error).toBeNull();
  });

  // ----------------------------------------------------------------
  // setPeriod
  // ----------------------------------------------------------------

  it('setPeriod updates the period in state', () => {
    useOHLCVStore.getState().setPeriod('1d');
    expect(useOHLCVStore.getState().period).toBe('1d');
  });

  it('setPeriod triggers a refetch when a symbol is loaded', async () => {
    // Pre-load a symbol
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);
    await useOHLCVStore.getState().fetchData('VNM', '1d');
    vi.clearAllMocks();

    mockFetchOHLCV.mockResolvedValueOnce({ ...mockOHLCVData, period: '1d' });
    useOHLCVStore.getState().setPeriod('1d');

    // Wait a tick for the async refetch
    await new Promise((r) => setTimeout(r, 0));

    expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', '1d');
  });

  it('setPeriod does NOT fetch when no symbol is loaded', () => {
    useOHLCVStore.getState().setPeriod('1d');
    expect(mockFetchOHLCV).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // reset
  // ----------------------------------------------------------------

  it('reset clears all state back to initial values', async () => {
    mockFetchOHLCV.mockResolvedValueOnce(mockOHLCVData);
    await useOHLCVStore.getState().fetchData('VNM', '1d');

    useOHLCVStore.getState().reset();

    const state = useOHLCVStore.getState();
    expect(state.data).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.symbol).toBeNull();
    expect(state.period).toBe('1d');
  });
});
