import apiClient from './index';
import type { OHLCVBar, OHLCVData, Period } from '../types/ohlcv';
import { PERIOD_FETCH_DAYS } from '../types/ohlcv';

// ------------------------------------------------------------------
// Aggregation helpers (daily → weekly / monthly)
// ------------------------------------------------------------------

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  // ISO week: Thursday-based week number
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function aggregateBars(bars: OHLCVBar[], keyFn: (d: string) => string): OHLCVBar[] {
  const groups = new Map<string, OHLCVBar[]>();
  for (const bar of bars) {
    const k = keyFn(bar.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(bar);
  }

  const result: OHLCVBar[] = [];
  for (const group of groups.values()) {
    if (group.length === 0) continue;
    const open  = group[0].open;
    const close = group[group.length - 1].close;
    const high  = Math.max(...group.map((b) => b.high));
    const low   = Math.min(...group.map((b) => b.low));
    const volume = group.reduce((s, b) => s + (b.volume ?? 0), 0);
    result.push({ date: group[0].date, open, high, low, close, volume });
  }
  return result;
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export async function fetchOHLCV(symbol: string, period: Period = '1d'): Promise<OHLCVData> {
  const fetchDays = PERIOD_FETCH_DAYS[period];

  // 4H: intraday not supported
  if (fetchDays === null) {
    return { stock_code: symbol, stock_name: null, period, data: [] };
  }

  const response = await apiClient.get(`/api/v1/stocks/${encodeURIComponent(symbol)}/ohlcv`, {
    params: { period: `${fetchDays}d` },
  });
  const raw = response.data as OHLCVData;

  if (period === '1w') {
    return { ...raw, period, data: aggregateBars(raw.data, isoWeekKey) };
  }
  if (period === '1m') {
    return { ...raw, period, data: aggregateBars(raw.data, monthKey) };
  }

  return { ...raw, period };
}
