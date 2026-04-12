/**
 * TDD Sprint 1 (UI): Tests for CandlestickChart — empty state improvement.
 * Includes fixes for period rename (7D/30D/90D/1Y → 4H/1D/1W/1M).
 */

import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CandlestickChart } from '../CandlestickChart';
import type { OHLCVBar } from '../../../types/ohlcv';

// Mock Recharts — SVG rendering doesn't work in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-composed-chart">{children}</div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => <div data-testid="recharts-bar">{children}</div>,
  XAxis: () => <div data-testid="recharts-xaxis" />,
  YAxis: () => <div data-testid="recharts-yaxis" />,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}));

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const bullishBar: OHLCVBar = {
  date: '2024-01-01',
  open: 70000,
  high: 72000,
  low: 69000,
  close: 71500,
  volume: 1_200_000,
};

const bearishBar: OHLCVBar = {
  date: '2024-01-02',
  open: 71500,
  high: 73000,
  low: 70000,
  close: 70200,
  volume: 950_000,
};

const mockData: OHLCVBar[] = [bullishBar, bearishBar];

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('CandlestickChart', () => {
  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  it('renders the chart container', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument();
  });

  it('renders Recharts ComposedChart when data present', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByTestId('recharts-composed-chart')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Period selector — new buttons: 4H (disabled), 1D, 1W, 1M
  // ----------------------------------------------------------------

  it('renders 4H button as disabled', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByRole('button', { name: '4H' })).toBeDisabled();
  });

  it('renders 1D, 1W, 1M buttons as enabled', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByRole('button', { name: '1D' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '1W' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '1M' })).not.toBeDisabled();
  });

  it('defaults active period to 1D', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByRole('button', { name: '1D' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: '1W' })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('button', { name: '1M' })).toHaveAttribute('data-active', 'false');
  });

  it('marks the correct period button active when period prop set', () => {
    render(<CandlestickChart data={mockData} period="1w" />);
    expect(screen.getByRole('button', { name: '1W' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: '1D' })).toHaveAttribute('data-active', 'false');
  });

  it('calls onPeriodChange with correct period when 1W clicked', () => {
    const onPeriodChange = vi.fn();
    render(<CandlestickChart data={mockData} onPeriodChange={onPeriodChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1W' }));
    expect(onPeriodChange).toHaveBeenCalledWith('1w');
  });

  it('calls onPeriodChange with correct period when 1M clicked', () => {
    const onPeriodChange = vi.fn();
    render(<CandlestickChart data={mockData} onPeriodChange={onPeriodChange} />);
    fireEvent.click(screen.getByRole('button', { name: '1M' }));
    expect(onPeriodChange).toHaveBeenCalledWith('1m');
  });

  it('does NOT call onPeriodChange when 4H (disabled) clicked', () => {
    const onPeriodChange = vi.fn();
    render(<CandlestickChart data={mockData} onPeriodChange={onPeriodChange} />);
    fireEvent.click(screen.getByRole('button', { name: '4H' }));
    expect(onPeriodChange).not.toHaveBeenCalled();
  });

  it('does not crash when onPeriodChange is not provided', () => {
    render(<CandlestickChart data={mockData} />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: '1W' }))).not.toThrow();
  });

  // ----------------------------------------------------------------
  // Loading state
  // ----------------------------------------------------------------

  it('shows loading skeleton when isLoading=true', () => {
    render(<CandlestickChart data={[]} isLoading />);
    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
  });

  it('hides the chart when isLoading=true', () => {
    render(<CandlestickChart data={[]} isLoading />);
    expect(screen.queryByTestId('recharts-composed-chart')).not.toBeInTheDocument();
  });

  it('does not show skeleton when data is loaded', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.queryByTestId('chart-skeleton')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Empty state — Sprint 1 UI improvements
  // ----------------------------------------------------------------

  it('shows chart-empty container when data=[] and not loading', () => {
    render(<CandlestickChart data={[]} />);
    expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
  });

  it('does NOT show chart-empty when data is present', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.queryByTestId('chart-empty')).not.toBeInTheDocument();
  });

  it('does NOT show chart-empty while loading (skeleton takes priority)', () => {
    render(<CandlestickChart data={[]} isLoading />);
    expect(screen.queryByTestId('chart-empty')).not.toBeInTheDocument();
  });

  it('shows stock name in empty state title when stockName provided', () => {
    render(<CandlestickChart data={[]} stockName="Hòa Phát" />);
    expect(screen.getByTestId('chart-empty-title')).toHaveTextContent('Hòa Phát');
  });

  it('shows generic title in empty state when no stockName', () => {
    render(<CandlestickChart data={[]} />);
    expect(screen.getByTestId('chart-empty-title')).toBeInTheDocument();
  });

  it('shows data source hint in empty state', () => {
    render(<CandlestickChart data={[]} />);
    expect(screen.getByTestId('chart-empty-hint')).toBeInTheDocument();
  });

  it('shows actionable suggestion in empty state', () => {
    render(<CandlestickChart data={[]} />);
    expect(screen.getByTestId('chart-empty-action')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Stock name display
  // ----------------------------------------------------------------

  it('displays stock name in header when data is present', () => {
    render(<CandlestickChart data={mockData} stockName="Vinamilk" />);
    expect(screen.getByText('Vinamilk')).toBeInTheDocument();
  });

  it('renders without stockName gracefully', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByTestId('candlestick-chart')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Sprint 4: Mobile layout — stock name truncation & responsive header
  // ----------------------------------------------------------------

  it('stock name span has data-testid="chart-stock-name"', () => {
    render(<CandlestickChart data={mockData} stockName="Hòa Phát Group Tên Rất Dài" />);
    expect(screen.getByTestId('chart-stock-name')).toBeInTheDocument();
  });

  it('stock name span has truncate class to prevent overflow', () => {
    render(<CandlestickChart data={mockData} stockName="Hòa Phát Group Tên Rất Dài" />);
    expect(screen.getByTestId('chart-stock-name')).toHaveClass('truncate');
  });

  it('stock name wrapper has min-w-0 to allow flex truncation', () => {
    render(<CandlestickChart data={mockData} stockName="Test" />);
    expect(screen.getByTestId('chart-stock-name').parentElement).toHaveClass('min-w-0');
  });

  it('period buttons container has data-testid="chart-period-buttons"', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByTestId('chart-period-buttons')).toBeInTheDocument();
  });

  it('period buttons container has flex-shrink-0 to stay on one line', () => {
    render(<CandlestickChart data={mockData} />);
    expect(screen.getByTestId('chart-period-buttons')).toHaveClass('flex-shrink-0');
  });

  it('empty state has overflow-hidden to prevent content overflow on small screens', () => {
    render(<CandlestickChart data={[]} />);
    expect(screen.getByTestId('chart-empty')).toHaveClass('overflow-hidden');
  });
});
