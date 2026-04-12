/**
 * OHLCV candlestick chart types.
 * Aligned with GET /api/v1/stocks/{code}/ohlcv response schema.
 */

/** One candlestick bar (Open / High / Low / Close / Volume) */
export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  amount?: number | null;
  change_percent?: number | null;
}

/** Response envelope from /ohlcv endpoint */
export interface OHLCVData {
  stock_code: string;
  stock_name: string | null;
  period: string;
  data: OHLCVBar[];
}

/**
 * Candle timeframe selector.
 * - '4h' : 4-hour candles (intraday — disabled, no data source)
 * - '1d' : daily candles  (~90 bars fetched)
 * - '1w' : weekly candles (~104 bars aggregated from ~2y daily)
 * - '1m' : monthly candles (~60 bars aggregated from ~5y daily)
 */
export type Period = '4h' | '1d' | '1w' | '1m';

/** API fetch range corresponding to each candle timeframe */
export const PERIOD_FETCH_DAYS: Record<Period, number | null> = {
  '4h': null,   // intraday — not supported
  '1d': 90,
  '1w': 730,    // ~2 years → ~104 weekly candles
  '1m': 1825,   // ~5 years → ~60 monthly candles
};
