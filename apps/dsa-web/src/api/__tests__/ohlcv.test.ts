/**
 * TDD Sprint 2: Tests for OHLCV API client + types.
 * Written FIRST (RED phase) before implementation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock apiClient before importing the module under test
vi.mock('../index', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '../index';
import { fetchOHLCV } from '../ohlcv';
import type { OHLCVBar, OHLCVData, Period } from '../../types/ohlcv';

const mockGet = vi.mocked(apiClient.get);

const mockBars: OHLCVBar[] = [
  { date: '2024-01-01', open: 70000, high: 72000, low: 69000, close: 71500, volume: 1200000 },
  { date: '2024-01-02', open: 71500, high: 73000, low: 70000, close: 70200, volume: 950000 },
];

const mockOHLCVData: OHLCVData = {
  stock_code: 'VNM',
  stock_name: 'Vinamilk',
  period: '1d',
  data: mockBars,
};

describe('fetchOHLCV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // Happy path
  // ------------------------------------------------------------------

  it('calls the correct endpoint with stock code and period', async () => {
    mockGet.mockResolvedValueOnce({ data: mockOHLCVData });

    await fetchOHLCV('VNM', '1d');

    // '1d' timeframe maps to '90d' fetch range
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/stocks/VNM/ohlcv',
      expect.objectContaining({ params: { period: '90d' } }),
    );
  });

  it('encodes stock code in the URL', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...mockOHLCVData, stock_code: 'VN:VNM' } });

    await fetchOHLCV('VN:VNM', '1d');

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/stocks/VN%3AVNM/ohlcv',
      expect.anything(),
    );
  });

  it('returns OHLCVData with correct shape', async () => {
    mockGet.mockResolvedValueOnce({ data: mockOHLCVData });

    const result = await fetchOHLCV('VNM', '1d');

    expect(result).toEqual(mockOHLCVData);
    expect(result.stock_code).toBe('VNM');
    expect(result.period).toBe('1d');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('each bar has required OHLCV fields', async () => {
    mockGet.mockResolvedValueOnce({ data: mockOHLCVData });

    const result = await fetchOHLCV('VNM', '1d');

    for (const bar of result.data) {
      expect(bar).toHaveProperty('date');
      expect(bar).toHaveProperty('open');
      expect(bar).toHaveProperty('high');
      expect(bar).toHaveProperty('low');
      expect(bar).toHaveProperty('close');
      expect(bar).toHaveProperty('volume');
    }
  });

  it('maps 1d timeframe to 90d API fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...mockOHLCVData, period: '90d' } });
    await fetchOHLCV('VNM', '1d');
    expect(mockGet).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { period: '90d' } }),
    );
  });

  it('maps 1w timeframe to 730d API fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...mockOHLCVData, period: '730d' } });
    await fetchOHLCV('VNM', '1w');
    expect(mockGet).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { period: '730d' } }),
    );
  });

  it('maps 1m timeframe to 1825d API fetch', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...mockOHLCVData, period: '1825d' } });
    await fetchOHLCV('VNM', '1m');
    expect(mockGet).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { period: '1825d' } }),
    );
  });

  it('returns empty data for 4h (intraday not supported)', async () => {
    const result = await fetchOHLCV('VNM', '4h');
    expect(mockGet).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(0);
  });

  it('defaults to 1d timeframe (90d fetch) when no period specified', async () => {
    mockGet.mockResolvedValueOnce({ data: mockOHLCVData });

    await fetchOHLCV('VNM');

    expect(mockGet).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: { period: '90d' } }),
    );
  });

  it('returns empty data array when API returns empty list', async () => {
    mockGet.mockResolvedValueOnce({
      data: { stock_code: 'VNM', stock_name: null, period: '1d', data: [] },
    });

    const result = await fetchOHLCV('VNM', '1d');

    expect(result.data).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // Error propagation
  // ------------------------------------------------------------------

  it('propagates network errors to the caller', async () => {
    const networkError = new Error('Network Error');
    mockGet.mockRejectedValueOnce(networkError);

    await expect(fetchOHLCV('VNM', '1d')).rejects.toThrow('Network Error');
  });

  it('propagates HTTP 422 errors from invalid period', async () => {
    const axiosError = Object.assign(new Error('Request failed with status code 422'), {
      response: { status: 422, data: { error: 'invalid_period', message: "period '5y' không hợp lệ" } },
    });
    mockGet.mockRejectedValueOnce(axiosError);

    await expect(fetchOHLCV('VNM', '1d')).rejects.toMatchObject({
      response: { status: 422 },
    });
  });
});

// ------------------------------------------------------------------
// Type-level tests (compile-time checks via TypeScript)
// ------------------------------------------------------------------

describe('OHLCVBar type shape', () => {
  it('accepts valid OHLCV bar', () => {
    const bar: OHLCVBar = {
      date: '2024-01-01',
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 500000,
    };
    expect(bar.date).toBe('2024-01-01');
  });

  it('allows optional fields to be undefined', () => {
    const bar: OHLCVBar = {
      date: '2024-01-01',
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: null,
      change_percent: undefined,
    };
    expect(bar.volume).toBeNull();
    expect(bar.change_percent).toBeUndefined();
  });
});

describe('Period type', () => {
  it('valid periods compile without error', () => {
    const periods: Period[] = ['1d', '1d', '1w', '1m'];
    expect(periods).toHaveLength(4);
  });
});
