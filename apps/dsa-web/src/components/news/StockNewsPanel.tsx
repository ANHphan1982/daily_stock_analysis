import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { stocksApi, type StockNewsItem } from '../../api/stocks';

interface Props {
  stockCode: string;
  stockName?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  'cafef.vn': 'CafeF',
  'vietstock.vn': 'Vietstock',
  'tinnhanhchungkhoan.vn': 'Tin nhanh CK',
  'vneconomy.vn': 'VnEconomy',
  'ndh.vn': 'NDH',
  'fireant.vn': 'FireAnt',
};

function sourceBadgeClass(source: string): string {
  const map: Record<string, string> = {
    'cafef.vn': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'vietstock.vn': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'tinnhanhchungkhoan.vn': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'vneconomy.vn': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return map[source] ?? 'bg-subtle text-muted-text';
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const NewsItemRow: React.FC<{ item: StockNewsItem }> = ({ item }) => {
  const label = SOURCE_LABELS[item.source] ?? item.source;
  const badgeClass = sourceBadgeClass(item.source);
  const dateText = formatDate(item.published_date);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 rounded-lg px-3 py-2.5 transition-colors hover:bg-hover"
    >
      <span className="text-sm font-medium text-foreground leading-snug group-hover:text-primary line-clamp-2">
        {item.title}
      </span>
      {item.snippet ? (
        <span className="text-xs text-secondary-text line-clamp-2">{item.snippet}</span>
      ) : null}
      <div className="flex items-center gap-2 mt-0.5">
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
          {label}
        </span>
        {dateText ? (
          <span className="text-[11px] text-muted-text">{dateText}</span>
        ) : null}
      </div>
    </a>
  );
};

const StockNewsPanel: React.FC<Props> = ({ stockCode, stockName }) => {
  const [items, setItems] = useState<StockNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await stocksApi.fetchStockNews(code, 15);
      setItems(data.items);
    } catch {
      setError('Không tải được tin tức. Vui lòng thử lại.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!stockCode) return;
    void load(stockCode);
  }, [stockCode, refreshKey, load]);

  const title = stockName ? `Tin tức ${stockName} (${stockCode})` : `Tin tức ${stockCode}`;

  return (
    <div className="dashboard-card mt-4 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="rounded p-1 text-secondary-text transition-colors hover:bg-hover hover:text-foreground disabled:opacity-40"
          title="Tải lại tin tức"
        >
          <svg
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col divide-y divide-border overflow-y-auto max-h-96">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-secondary-text">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Đang tải tin tức...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-8 text-danger">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-secondary-text">
            <svg className="h-8 w-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">Chưa có tin tức cho mã này</span>
          </div>
        ) : (
          items.map((item, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <NewsItemRow key={`${item.url}-${idx}`} item={item} />
          ))
        )}
      </div>
    </div>
  );
};

export default StockNewsPanel;
