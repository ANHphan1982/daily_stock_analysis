/**
 * TDD Sprint 5 (UI): StockChipInput — stock pool as chips.
 * Tests written FIRST (RED phase).
 *
 * Improvements:
 * - Comma-separated stock codes rendered as visual chip tags
 * - Each chip has an X button to remove the code
 * - Input field to add new stock codes (Enter or comma to confirm)
 * - Serializes back to comma-separated string via onChange
 * - Empty / whitespace codes are filtered out
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StockChipInput } from '../StockChipInput';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const THREE_STOCKS = 'VNM,HPG,FPT';

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('StockChipInput', () => {

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------

  it('renders a chip for each stock code', () => {
    render(<StockChipInput value={THREE_STOCKS} onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-VNM')).toBeInTheDocument();
    expect(screen.getByTestId('chip-HPG')).toBeInTheDocument();
    expect(screen.getByTestId('chip-FPT')).toBeInTheDocument();
  });

  it('renders chip label text', () => {
    render(<StockChipInput value="VNM" onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-label-VNM')).toHaveTextContent('VNM');
  });

  it('renders remove button on each chip', () => {
    render(<StockChipInput value={THREE_STOCKS} onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-remove-VNM')).toBeInTheDocument();
    expect(screen.getByTestId('chip-remove-HPG')).toBeInTheDocument();
  });

  it('renders input field for adding new codes', () => {
    render(<StockChipInput value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-input')).toBeInTheDocument();
  });

  it('renders empty state with no chips when value is empty string', () => {
    render(<StockChipInput value="" onChange={vi.fn()} />);
    expect(screen.queryAllByTestId(/^chip-[A-Z]/)).toHaveLength(0);
  });

  it('trims whitespace from stock codes', () => {
    render(<StockChipInput value=" VNM , HPG " onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-VNM')).toBeInTheDocument();
    expect(screen.getByTestId('chip-HPG')).toBeInTheDocument();
  });

  it('filters out empty codes between commas', () => {
    render(<StockChipInput value="VNM,,FPT" onChange={vi.fn()} />);
    expect(screen.getByTestId('chip-VNM')).toBeInTheDocument();
    expect(screen.getByTestId('chip-FPT')).toBeInTheDocument();
    // no empty chip
    expect(screen.queryAllByTestId(/^chip-[A-Z]/)).toHaveLength(2);
  });

  // ----------------------------------------------------------------
  // Remove chip
  // ----------------------------------------------------------------

  it('calls onChange without removed code when X button clicked', () => {
    const onChange = vi.fn();
    render(<StockChipInput value={THREE_STOCKS} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('chip-remove-HPG'));
    expect(onChange).toHaveBeenCalledWith('VNM,FPT');
  });

  it('calls onChange with empty string when last chip removed', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="VNM" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('chip-remove-VNM'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  // ----------------------------------------------------------------
  // Add new chip via Enter key
  // ----------------------------------------------------------------

  it('adds new code and calls onChange when Enter pressed', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="VNM" onChange={onChange} />);
    const input = screen.getByTestId('chip-input');
    fireEvent.change(input, { target: { value: 'MWG' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('VNM,MWG');
  });

  it('clears the input after adding a code', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="VNM" onChange={onChange} />);
    const input = screen.getByTestId('chip-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'MWG' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
  });

  it('adds new code when comma is typed', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="VNM" onChange={onChange} />);
    const input = screen.getByTestId('chip-input');
    fireEvent.change(input, { target: { value: 'MWG,' } });
    expect(onChange).toHaveBeenCalledWith('VNM,MWG');
  });

  it('does not add duplicate codes', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="VNM" onChange={onChange} />);
    const input = screen.getByTestId('chip-input');
    fireEvent.change(input, { target: { value: 'VNM' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // onChange not called for duplicate
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uppercases input before adding', () => {
    const onChange = vi.fn();
    render(<StockChipInput value="" onChange={onChange} />);
    const input = screen.getByTestId('chip-input');
    fireEvent.change(input, { target: { value: 'vnm' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('VNM');
  });

  // ----------------------------------------------------------------
  // Disabled state
  // ----------------------------------------------------------------

  it('remove buttons are disabled when disabled prop is true', () => {
    render(<StockChipInput value={THREE_STOCKS} onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('chip-remove-VNM')).toBeDisabled();
    expect(screen.getByTestId('chip-remove-HPG')).toBeDisabled();
  });

  it('input is disabled when disabled prop is true', () => {
    render(<StockChipInput value="" onChange={vi.fn()} disabled />);
    expect(screen.getByTestId('chip-input')).toBeDisabled();
  });
});
