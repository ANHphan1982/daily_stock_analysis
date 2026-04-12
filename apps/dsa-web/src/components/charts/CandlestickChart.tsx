import { useMemo } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OHLCVBar, Period } from '../../types/ohlcv';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface CandlestickChartProps {
  data: OHLCVBar[];
  period?: Period;
  isLoading?: boolean;
  stockName?: string;
  onPeriodChange?: (period: Period) => void;
}

interface ChartRow {
  date: string;
  /** [min, max] of the candle body (open/close) — used by Bar */
  body: [number, number];
  /** Raw bar for coloring */
  close: number;
  open: number;
  high: number;
  low: number;
}

// ------------------------------------------------------------------
// Period config
// ------------------------------------------------------------------

const PERIODS: { label: string; value: Period; disabled?: boolean }[] = [
  { label: '4H', value: '4h', disabled: true },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
];

// ------------------------------------------------------------------
// Custom candlestick bar shape
// ------------------------------------------------------------------

interface CandlestickShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartRow;
}

function CandlestickShape({ x = 0, y = 0, width = 0, height = 0, payload }: CandlestickShapeProps) {
  if (!payload) return null;

  const isBullish = payload.close >= payload.open;
  const color = isBullish ? 'var(--color-bullish, #22c55e)' : 'var(--color-bearish, #ef4444)';

  // Body rectangle
  const bodyX = x;
  const bodyY = y;
  const bodyWidth = Math.max(width, 2);
  const bodyHeight = Math.max(Math.abs(height), 1);

  // Wick: centre of the bar horizontally
  const wickX = x + width / 2;

  // We need high/low in chart coordinate space.
  // Recharts passes y/height relative to the yAxis scale,
  // so we approximate wick extent from the body bounds.
  const bodyTop = bodyY;
  const bodyBottom = bodyY + bodyHeight;

  // Scale factor: how many px per unit of value?
  // high wick extends above the top of the body; low wick below.
  // Recharts doesn't give us the scale directly in the shape callback,
  // so the wicks are drawn as a proportion of the body height.
  const priceRange = Math.max(payload.high - payload.low, 1);
  const bodyRange = Math.abs(payload.close - payload.open);
  const pxPerUnit = bodyHeight / Math.max(bodyRange, 1);

  const highWickTop = bodyTop - (payload.high - Math.max(payload.close, payload.open)) * pxPerUnit;
  const lowWickBottom = bodyBottom + (Math.min(payload.close, payload.open) - payload.low) * pxPerUnit;

  // Guard: only draw wick if priceRange > 0
  const showWick = priceRange > 0 && bodyHeight > 0;

  return (
    <g>
      {/* Wick (shadow) */}
      {showWick && (
        <line
          x1={wickX}
          x2={wickX}
          y1={highWickTop}
          y2={lowWickBottom}
          stroke={color}
          strokeWidth={1}
        />
      )}
      {/* Candle body */}
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
}

// ------------------------------------------------------------------
// Skeleton
// ------------------------------------------------------------------

function ChartSkeleton() {
  return (
    <div data-testid="chart-skeleton" className="animate-pulse flex flex-col gap-2 h-full w-full p-4">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="flex-1 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
    </div>
  );
}

// ------------------------------------------------------------------
// Empty state
// ------------------------------------------------------------------

function ChartEmpty({ stockName }: { stockName?: string }) {
  return (
    <div
      data-testid="chart-empty"
      className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center overflow-hidden"
    >
      {/* Icon */}
      <svg
        className="h-8 w-8 text-muted-foreground/40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 3l18 18M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M13 5h2l4 4v4"
        />
      </svg>

      {/* Title */}
      <p
        data-testid="chart-empty-title"
        className="text-sm font-medium text-muted-foreground"
      >
        {stockName
          ? `Không có dữ liệu nến cho ${stockName}`
          : 'Không có dữ liệu nến'}
      </p>

      {/* Hint */}
      <p
        data-testid="chart-empty-hint"
        className="text-xs text-muted-foreground/60"
      >
        Cổ phiếu này chưa được hỗ trợ bởi nguồn dữ liệu hiện tại
      </p>

      {/* Action */}
      <p
        data-testid="chart-empty-action"
        className="text-xs text-muted-foreground/50"
      >
        Thử chọn cổ phiếu khác từ lịch sử phân tích
      </p>
    </div>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------

export function CandlestickChart({
  data,
  period = '1d',
  isLoading = false,
  stockName,
  onPeriodChange,
}: CandlestickChartProps) {
  const chartRows = useMemo<ChartRow[]>(
    () =>
      data.map((bar) => ({
        date: bar.date,
        body: [Math.min(bar.open, bar.close), Math.max(bar.open, bar.close)],
        close: bar.close,
        open: bar.open,
        high: bar.high,
        low: bar.low,
      })),
    [data],
  );

  return (
    <div data-testid="candlestick-chart" className="flex flex-col gap-2 w-full h-full">
      {/* Header row: name + period selector */}
      <div className="flex items-center justify-between px-1 gap-2">
        <div className="min-w-0 flex-1">
          {stockName ? (
            <span
              data-testid="chart-stock-name"
              className="truncate block text-sm font-medium text-foreground"
            >
              {stockName}
            </span>
          ) : (
            <span />
          )}
        </div>

        <div data-testid="chart-period-buttons" className="flex gap-1 flex-shrink-0">
          {PERIODS.map(({ label, value, disabled }) => (
            <button
              key={value}
              type="button"
              data-active={period === value}
              disabled={disabled}
              onClick={() => !disabled && onPeriodChange?.(value)}
              title={disabled ? 'Không có dữ liệu intraday' : undefined}
              className={[
                'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                disabled
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : period === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <ChartEmpty stockName={stockName} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #333)" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)} // MM-DD
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                width={60}
              />
              <Tooltip
                content={({ payload }) => {
                  const row = payload?.[0]?.payload as ChartRow | undefined;
                  if (!row) return null;
                  return (
                    <div className="bg-popover border border-border rounded p-2 text-xs space-y-0.5">
                      <div className="font-medium">{row.date}</div>
                      <div>O: {row.open.toLocaleString()}</div>
                      <div>H: {row.high.toLocaleString()}</div>
                      <div>L: {row.low.toLocaleString()}</div>
                      <div>C: {row.close.toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="body" shape={<CandlestickShape />}>
                {chartRows.map((row, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={row.close >= row.open ? 'var(--color-bullish, #22c55e)' : 'var(--color-bearish, #ef4444)'}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
