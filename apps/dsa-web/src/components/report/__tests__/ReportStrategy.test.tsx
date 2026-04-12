/**
 * TDD Sprint 3 (UI): ReportStrategy score cards redesign.
 * Tests written FIRST (RED phase).
 *
 * Improvements:
 * - data-testid per card for testability
 * - data-card-type attribute (buy / secondary / stop / take)
 * - N/A-equivalent values ("Không áp dụng", "不适用", "N/A") collapse to "—"
 * - zero / empty string also collapse to "—"
 * - Color tone follows card type (semantic CSS variable)
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportStrategy } from '../ReportStrategy';
import type { ReportStrategy as ReportStrategyType } from '../../../types/analysis';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const fullStrategy: ReportStrategyType = {
  idealBuy: '27.50',
  secondaryBuy: '26.80',
  stopLoss: '25.00',
  takeProfit: '31.00',
};

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ReportStrategy', () => {

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  it('renders nothing when strategy is undefined', () => {
    const { container } = render(<ReportStrategy />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 strategy cards when all values provided', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-card-idealBuy')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-card-secondaryBuy')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-card-stopLoss')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-card-takeProfit')).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // data-card-type semantic attribute
  // ----------------------------------------------------------------

  it('idealBuy card has data-card-type="buy"', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-card-idealBuy')).toHaveAttribute('data-card-type', 'buy');
  });

  it('secondaryBuy card has data-card-type="secondary"', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-card-secondaryBuy')).toHaveAttribute('data-card-type', 'secondary');
  });

  it('stopLoss card has data-card-type="stop"', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-card-stopLoss')).toHaveAttribute('data-card-type', 'stop');
  });

  it('takeProfit card has data-card-type="take"', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-card-takeProfit')).toHaveAttribute('data-card-type', 'take');
  });

  // ----------------------------------------------------------------
  // Value display
  // ----------------------------------------------------------------

  it('displays value correctly when provided', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-value-idealBuy')).toHaveTextContent('27.50');
    expect(screen.getByTestId('strategy-value-stopLoss')).toHaveTextContent('25.00');
  });

  it('shows "—" when value is undefined', () => {
    render(<ReportStrategy strategy={{ idealBuy: undefined }} />);
    expect(screen.getByTestId('strategy-value-idealBuy')).toHaveTextContent('—');
  });

  it('shows "—" when value is empty string', () => {
    render(<ReportStrategy strategy={{ idealBuy: '' }} />);
    expect(screen.getByTestId('strategy-value-idealBuy')).toHaveTextContent('—');
  });

  it('collapses Vietnamese N/A text to "—"', () => {
    render(<ReportStrategy strategy={{ idealBuy: 'Không áp dụng' }} />);
    expect(screen.getByTestId('strategy-value-idealBuy')).toHaveTextContent('—');
  });

  it('collapses Chinese N/A text to "—"', () => {
    render(<ReportStrategy strategy={{ idealBuy: '不适用' }} />);
    expect(screen.getByTestId('strategy-value-idealBuy')).toHaveTextContent('—');
  });

  it('collapses "N/A" literal to "—"', () => {
    render(<ReportStrategy strategy={{ stopLoss: 'N/A' }} />);
    expect(screen.getByTestId('strategy-value-stopLoss')).toHaveTextContent('—');
  });

  it('collapses case-insensitive n/a to "—"', () => {
    render(<ReportStrategy strategy={{ takeProfit: 'n/a' }} />);
    expect(screen.getByTestId('strategy-value-takeProfit')).toHaveTextContent('—');
  });

  // ----------------------------------------------------------------
  // Label display (i18n)
  // ----------------------------------------------------------------

  it('renders Vietnamese labels by default', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-label-idealBuy')).toHaveTextContent('Mua lý tưởng');
    expect(screen.getByTestId('strategy-label-stopLoss')).toHaveTextContent('Cắt lỗ');
  });

  it('renders English labels when language="en"', () => {
    render(<ReportStrategy strategy={fullStrategy} language="en" />);
    expect(screen.getByTestId('strategy-label-idealBuy')).toHaveTextContent('Ideal Entry');
    expect(screen.getByTestId('strategy-label-stopLoss')).toHaveTextContent('Stop Loss');
  });

  // ----------------------------------------------------------------
  // Section header
  // ----------------------------------------------------------------

  it('renders section header', () => {
    render(<ReportStrategy strategy={fullStrategy} />);
    expect(screen.getByTestId('strategy-header')).toBeInTheDocument();
  });
});
