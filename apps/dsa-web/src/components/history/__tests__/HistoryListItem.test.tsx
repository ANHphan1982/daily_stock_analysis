/**
 * TDD Sprint 2 (UI): HistoryListItem — sidebar UX improvements.
 * Tests written FIRST (RED phase).
 *
 * Improvements:
 * - data-sentiment attribute on badge (bullish / neutral / bearish)
 * - Compact date format dd/MM
 * - data-testid attributes for key elements
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryListItem } from '../HistoryListItem';
import type { HistoryItem } from '../../../types/analysis';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const baseProps = {
  isViewing: false,
  isChecked: false,
  isDeleting: false,
  onToggleChecked: vi.fn(),
  onClick: vi.fn(),
};

function makeItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 1,
    queryId: 'q-1',
    stockCode: 'VNM',
    stockName: 'Vinamilk',
    sentimentScore: 75,
    operationAdvice: 'Mua tích lũy',
    createdAt: '2026-03-15T08:30:00Z',
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('HistoryListItem', () => {

  // ----------------------------------------------------------------
  // Stock code display
  // ----------------------------------------------------------------

  it('renders stock code with data-testid', () => {
    render(<HistoryListItem {...baseProps} item={makeItem()} />);
    expect(screen.getByTestId('history-item-stock-code')).toBeInTheDocument();
    expect(screen.getByTestId('history-item-stock-code')).toHaveTextContent('VNM');
  });

  it('renders stock code prominently (not hidden)', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ stockCode: 'HPG' })} />);
    expect(screen.getByTestId('history-item-stock-code')).toBeVisible();
    expect(screen.getByTestId('history-item-stock-code')).toHaveTextContent('HPG');
  });

  // ----------------------------------------------------------------
  // Sentiment badge — color semantics
  // ----------------------------------------------------------------

  it('badge has data-sentiment="bullish" when score >= 70', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 70 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'bullish');
  });

  it('badge has data-sentiment="bullish" when score = 85', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 85 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'bullish');
  });

  it('badge has data-sentiment="neutral" when score is 40–69', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 55 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'neutral');
  });

  it('badge has data-sentiment="neutral" when score = 40', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 40 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'neutral');
  });

  it('badge has data-sentiment="bearish" when score < 40', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 25 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'bearish');
  });

  it('badge has data-sentiment="bearish" when score = 0', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 0 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveAttribute('data-sentiment', 'bearish');
  });

  it('badge displays score number', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: 78 })} />);
    expect(screen.getByTestId('history-item-badge')).toHaveTextContent('78');
  });

  it('does not render badge when sentimentScore is undefined', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ sentimentScore: undefined })} />);
    expect(screen.queryByTestId('history-item-badge')).not.toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // Compact date format — dd/MM
  // ----------------------------------------------------------------

  it('renders date element with data-testid', () => {
    render(<HistoryListItem {...baseProps} item={makeItem()} />);
    expect(screen.getByTestId('history-item-date')).toBeInTheDocument();
  });

  it('displays date in compact dd/MM format', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ createdAt: '2026-03-15T08:30:00Z' })} />);
    const dateEl = screen.getByTestId('history-item-date');
    // Should contain day/month — NOT full year or seconds
    expect(dateEl.textContent).toMatch(/\d{2}\/\d{2}/);
    expect(dateEl.textContent).not.toMatch(/2026/);
  });

  it('shows — for missing date', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ createdAt: undefined as unknown as string })} />);
    expect(screen.getByTestId('history-item-date')).toHaveTextContent('—');
  });

  // ----------------------------------------------------------------
  // Operation advice
  // ----------------------------------------------------------------

  it('renders advice text with data-testid', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ operationAdvice: 'Mua tích lũy' })} />);
    expect(screen.getByTestId('history-item-advice')).toBeInTheDocument();
  });

  it('maps Chinese advice to Vietnamese label', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ operationAdvice: '买入布局' })} />);
    expect(screen.getByTestId('history-item-advice')).toHaveTextContent('Mua');
  });

  it('maps 观望 advice to Quan sát', () => {
    render(<HistoryListItem {...baseProps} item={makeItem({ operationAdvice: '观望等待' })} />);
    expect(screen.getByTestId('history-item-advice')).toHaveTextContent('Quan sát');
  });

  // ----------------------------------------------------------------
  // Interactions
  // ----------------------------------------------------------------

  it('calls onClick with item id when button clicked', () => {
    const onClick = vi.fn();
    render(<HistoryListItem {...baseProps} item={makeItem({ id: 42 })} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /VNM/i }));
    expect(onClick).toHaveBeenCalledWith(42);
  });

  it('applies selected style when isViewing=true', () => {
    render(<HistoryListItem {...baseProps} item={makeItem()} isViewing />);
    const btn = screen.getByRole('button', { name: /VNM/i });
    expect(btn.className).toContain('home-history-item-selected');
  });
});
