/**
 * TDD Sprint 5: Integration tests for CandlestickChart inside HomePage.
 * Written FIRST (RED phase) before implementation.
 *
 * Strategy: mock ohlcvStore and CandlestickChart to focus on
 * the wiring (when to show the chart, when to fetch) not the chart itself.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { historyApi } from '../../api/history';
import { useStockPoolStore } from '../../stores';
import { useOHLCVStore } from '../../stores/ohlcvStore';
import HomePage from '../HomePage';

// ------------------------------------------------------------------
// Module mocks
// ------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../api/history', () => ({
  historyApi: {
    getList: vi.fn(),
    getDetail: vi.fn(),
    deleteRecords: vi.fn(),
    getNews: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    getMarkdown: vi.fn().mockResolvedValue('# report'),
  },
}));

vi.mock('../../api/analysis', async () => {
  const actual = await vi.importActual<typeof import('../../api/analysis')>('../../api/analysis');
  return { ...actual, analysisApi: { analyzeAsync: vi.fn() } };
});

vi.mock('../../hooks/useTaskStream', () => ({
  useTaskStream: vi.fn(),
}));

// Mock CandlestickChart — Sprint 3 already tests it in isolation
vi.mock('../../components/charts/CandlestickChart', () => ({
  CandlestickChart: ({
    data,
    isLoading,
    stockName,
    period,
    onPeriodChange,
  }: {
    data: unknown[];
    isLoading?: boolean;
    stockName?: string;
    period?: string;
    onPeriodChange?: (p: string) => void;
  }) => (
    <div data-testid="candlestick-chart-mock">
      {isLoading && <span data-testid="chart-loading">loading</span>}
      {stockName && <span data-testid="chart-stock-name">{stockName}</span>}
      <span data-testid="chart-period">{period}</span>
      <span data-testid="chart-data-length">{data.length}</span>
      <button onClick={() => onPeriodChange?.('7d')}>change-period</button>
    </div>
  ),
}));

// Mock fetchOHLCV used by ohlcvStore
const { mockFetchOHLCV } = vi.hoisted(() => ({ mockFetchOHLCV: vi.fn() }));
vi.mock('../../api/ohlcv', () => ({ fetchOHLCV: mockFetchOHLCV }));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const historyReport = {
  meta: {
    id: 1,
    queryId: 'q-1',
    stockCode: 'VNM',
    stockName: 'Vinamilk',
    reportType: 'detailed' as const,
    reportLanguage: 'zh' as const,
    createdAt: '2026-03-18T08:00:00Z',
  },
  summary: {
    analysisSummary: 'Xu hướng tăng mạnh',
    operationAdvice: 'Có thể mua',
    trendPrediction: 'Ngắn hạn tích cực',
    sentimentScore: 78,
  },
};

const mockOHLCVData = {
  stock_code: 'VNM',
  stock_name: 'Vinamilk',
  period: '30d',
  data: [
    { date: '2024-01-01', open: 70000, high: 72000, low: 69000, close: 71500, volume: 1200000 },
  ],
};

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('HomePage + CandlestickChart integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStockPoolStore.getState().resetDashboardState();
    useOHLCVStore.getState().reset();

    vi.mocked(historyApi.getList).mockResolvedValue({
      total: 0, page: 1, limit: 20, items: [],
    });
  });

  // ----------------------------------------------------------------
  // Chart visibility
  // ----------------------------------------------------------------

  it('does NOT render the chart when no report is selected', async () => {
    renderHomePage();
    await screen.findByTestId('home-dashboard');
    expect(screen.queryByTestId('candlestick-chart-mock')).not.toBeInTheDocument();
  });

  it('renders the chart when a report is selected', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });

    renderHomePage();

    expect(await screen.findByTestId('candlestick-chart-mock')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------

  it('fetches OHLCV data when a report is selected', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    await waitFor(() => {
      expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', expect.any(String));
    });
  });

  it('passes stockName to the chart', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    expect(await screen.findByTestId('chart-stock-name')).toHaveTextContent('Vinamilk');
  });

  it('shows chart in loading state while OHLCV is fetching', async () => {
    // Keep fetchOHLCV pending
    mockFetchOHLCV.mockImplementation(() => new Promise(() => {}));

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
    });
  });

  it('passes loaded bars to the chart', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    await waitFor(() => {
      expect(screen.getByTestId('chart-data-length')).toHaveTextContent('1');
    });
  });

  // ----------------------------------------------------------------
  // Period change
  // ----------------------------------------------------------------

  it('re-fetches when period changes via the chart', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    await screen.findByTestId('candlestick-chart-mock');
    vi.clearAllMocks();

    mockFetchOHLCV.mockResolvedValue({ ...mockOHLCVData, period: '7d' });

    // Simulate period change button click inside chart mock
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: 'change-period' }));

    await waitFor(() => {
      expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', '7d');
    });
  });

  // ----------------------------------------------------------------
  // Report switch
  // ----------------------------------------------------------------

  it('re-fetches OHLCV when selected stock code changes', async () => {
    mockFetchOHLCV.mockResolvedValue(mockOHLCVData);

    useStockPoolStore.setState({ selectedReport: historyReport });
    renderHomePage();

    await waitFor(() => expect(mockFetchOHLCV).toHaveBeenCalledWith('VNM', expect.any(String)));
    vi.clearAllMocks();

    const secondReport = {
      ...historyReport,
      meta: { ...historyReport.meta, stockCode: 'HPG', stockName: 'Hoa Phat' },
    };
    mockFetchOHLCV.mockResolvedValue({ ...mockOHLCVData, stock_code: 'HPG' });

    useStockPoolStore.setState({ selectedReport: secondReport });

    await waitFor(() => {
      expect(mockFetchOHLCV).toHaveBeenCalledWith('HPG', expect.any(String));
    });
  });
});
