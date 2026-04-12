/**
 * TDD Sprint 5 (UI): formatMoney — zero values → "—", VND locale.
 * Tests written FIRST (RED phase).
 */

import { describe, expect, it } from 'vitest';
import { formatMoney } from '../formatMoney';

describe('formatMoney', () => {

  // ----------------------------------------------------------------
  // Null / undefined / NaN → "--"
  // ----------------------------------------------------------------

  it('returns "--" for null', () => {
    expect(formatMoney(null)).toBe('--');
  });

  it('returns "--" for undefined', () => {
    expect(formatMoney(undefined)).toBe('--');
  });

  it('returns "--" for NaN', () => {
    expect(formatMoney(Number.NaN)).toBe('--');
  });

  // ----------------------------------------------------------------
  // Zero → "—" (em dash, not double-dash)
  // ----------------------------------------------------------------

  it('returns "—" for 0 by default', () => {
    expect(formatMoney(0)).toBe('—');
  });

  it('returns "—" for 0 with explicit VND', () => {
    expect(formatMoney(0, 'VND')).toBe('—');
  });

  it('returns "—" for 0 with CNY', () => {
    expect(formatMoney(0, 'CNY')).toBe('—');
  });

  it('does NOT return "—" for 0 when zeroDash=false', () => {
    expect(formatMoney(0, 'VND', { zeroDash: false })).not.toBe('—');
  });

  // ----------------------------------------------------------------
  // VND formatting — no decimal places, space + currency suffix
  // ----------------------------------------------------------------

  it('formats VND with no decimal places', () => {
    const result = formatMoney(28000, 'VND');
    expect(result).toContain('28');
    expect(result).toContain('VND');
    expect(result).not.toMatch(/,\d{2}/); // no decimal places (vi-VN: comma = decimal sep)
  });

  it('formats large VND with thousand separators', () => {
    const result = formatMoney(1500000, 'VND');
    // Should contain separator (dot or comma depending on locale)
    expect(result).toMatch(/1[.,\s]500[.,\s]?000/);
    expect(result).toContain('VND');
  });

  // ----------------------------------------------------------------
  // Non-VND — keeps 2 decimal places
  // ----------------------------------------------------------------

  it('formats CNY with 2 decimal places', () => {
    const result = formatMoney(28.5, 'CNY');
    expect(result).toContain('CNY');
    expect(result).toMatch(/28[.,]50/);
  });

  it('formats USD with 2 decimal places', () => {
    const result = formatMoney(100, 'USD');
    expect(result).toContain('USD');
    expect(result).toMatch(/100[.,]00/);
  });

  // ----------------------------------------------------------------
  // Default currency is VND
  // ----------------------------------------------------------------

  it('defaults to VND when currency not specified', () => {
    const result = formatMoney(5000);
    expect(result).toContain('VND');
  });
});
