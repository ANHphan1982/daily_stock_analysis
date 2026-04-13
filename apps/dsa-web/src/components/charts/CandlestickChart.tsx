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
  error?: { status?: number; message?: string } | null;
  onPeriodChange?: (period: Period) => void;
  onRetry?: () => void;
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
// Error state
// ------------------------------------------------------------------

function ChartError({
  message,
  status,
  onRetry,
}: {
  message?: string;
  status?: number;
  onRetry?: () => void;
}) {
  const isRateLimit = status === 503 || !message || message.includes('tạm thời') || message.includes('503') || message.includes('429');
  return (
    <div
      data-testid="chart-error"
      className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center overflow-hidden"
    >
      <svg
        className="h-8 w-8 text-amber-500/60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
      <p className="text-sm font-medium text-muted-foreground">
        {isRateLimit ? 'Nguồn dữ liệu tạm thời không khả dụng' : 'Không tải được dữ liệu nến'}
      </p>
      <p className="text-xs text-muted-foreground/60">
        {isRateLimit
          ? 'API đang bị giới hạn tốc độ. Vui lòng thử lại sau vài phút.'
          : (message ?? 'Lỗi không xác định')}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-3 py-1 rounded text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Thử lại
        </button>
      )}
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
      <p
        data-testid="chart-empty-title"
        className="text-sm font-medium text-muted-foreground"
      >
        {stockName ? `Chưa có dữ liệu nến cho ${stockName}` : 'Chưa có dữ liệu nến'}
      </p>
      <p
        data-testid="chart-empty-hint"
        className="text-xs text-muted-foreground/60"
      >
        Mã này chưa có lịch sử giao dịch trong khoảng thời gian đã chọn.
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
  error,
  onPeriodChange,
  onRetry,
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
        ) : error ? (
          <ChartError message={error.message} status={error.status} onRetry={onRetry} />
        ) : data.length === 0 ? (
          <ChartEmpty stockName={stockName} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #333)" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5, 10)} // MM-DD from YYYY-MM-DD
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
