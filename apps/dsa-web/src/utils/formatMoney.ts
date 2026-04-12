interface FormatMoneyOptions {
  /** When true (default), return "—" for zero values */
  zeroDash?: boolean;
}

/**
 * Format a monetary value with locale-aware separators.
 * - null / undefined / NaN → "--"
 * - 0 → "—" (em-dash) unless zeroDash=false
 * - VND: no decimal places
 * - Other currencies: 2 decimal places
 */
export function formatMoney(
  value: number | undefined | null,
  currency = 'VND',
  options: FormatMoneyOptions = {},
): string {
  const { zeroDash = true } = options;

  if (value == null || Number.isNaN(value)) return '--';
  if (zeroDash && value === 0) return '—';

  const isVnd = currency.toUpperCase() === 'VND';
  const formatted = Number(value).toLocaleString('vi-VN', {
    minimumFractionDigits: isVnd ? 0 : 2,
    maximumFractionDigits: isVnd ? 0 : 2,
  });
  return `${formatted} ${currency}`;
}
