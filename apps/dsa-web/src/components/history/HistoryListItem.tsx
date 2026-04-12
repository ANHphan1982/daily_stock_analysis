import type React from 'react';
import type { HistoryItem } from '../../types/analysis';
import { getSentimentColor } from '../../types/analysis';
import { formatDateCompact } from '../../utils/format';

interface HistoryListItemProps {
  item: HistoryItem;
  isViewing: boolean;
  isChecked: boolean;
  isDeleting: boolean;
  onToggleChecked: (recordId: number) => void;
  onClick: (recordId: number) => void;
}

const getOperationBadgeLabel = (advice?: string) => {
  const normalized = advice?.trim();
  if (!normalized) return 'Tâm lý';
  if (normalized.includes('减仓')) return 'Giảm vị thế';
  if (normalized.includes('卖')) return 'Bán';
  if (normalized.includes('观望') || normalized.includes('等待')) return 'Quan sát';
  if (normalized.includes('买') || normalized.includes('布局')) return 'Mua';
  return normalized.split(/[，。；、\s]/)[0] || 'Khuyến nghị';
};

/** Map score to semantic sentiment tier */
const getSentimentTier = (score: number): 'bullish' | 'neutral' | 'bearish' => {
  if (score >= 70) return 'bullish';
  if (score >= 40) return 'neutral';
  return 'bearish';
};

export const HistoryListItem: React.FC<HistoryListItemProps> = ({
  item,
  isViewing,
  isChecked,
  isDeleting,
  onToggleChecked,
  onClick,
}) => {
  return (
    <div className="flex items-start gap-2 group">
      <div className="pt-5">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggleChecked(item.id)}
          disabled={isDeleting}
          className="h-3.5 w-3.5 cursor-pointer rounded border-subtle-hover bg-transparent text-[var(--home-accent-text)] focus:ring-[color:var(--home-accent-border-hover)] disabled:opacity-50"
        />
      </div>
      <button
        type="button"
        onClick={() => onClick(item.id)}
        className={`home-history-item flex-1 text-left p-2.5 group/item ${
          isViewing ? 'home-history-item-selected' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 relative z-10">
          {item.sentimentScore !== undefined && (
            <div
              className="w-1 h-8 rounded-full flex-shrink-0"
              style={{
                backgroundColor: getSentimentColor(item.sentimentScore),
                boxShadow: `0 0 10px ${getSentimentColor(item.sentimentScore)}40`,
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  data-testid="history-item-stock-code"
                  className="truncate text-sm font-semibold text-foreground tracking-tight font-mono"
                >
                  {item.stockCode}
                </span>
              </div>
              {item.sentimentScore !== undefined && (
                <span
                  data-testid="history-item-badge"
                  data-sentiment={getSentimentTier(item.sentimentScore)}
                  className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none"
                  style={{
                    color: getSentimentColor(item.sentimentScore),
                    borderColor: `${getSentimentColor(item.sentimentScore)}30`,
                    backgroundColor: `${getSentimentColor(item.sentimentScore)}10`,
                  }}
                >
                  <span data-testid="history-item-advice">
                    {getOperationBadgeLabel(item.operationAdvice)}
                  </span>
                  {' '}{item.sentimentScore}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span data-testid="history-item-date" className="text-[11px] text-muted-text">
                {formatDateCompact(item.createdAt)}
              </span>
              {item.currentPrice != null && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-mono text-foreground">
                    {item.currentPrice >= 1000
                      ? item.currentPrice.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
                      : item.currentPrice.toFixed(2)}
                  </span>
                  {item.changePct != null && (
                    <span
                      className="text-[10px] font-mono font-semibold"
                      style={{ color: item.changePct > 0 ? 'var(--home-price-up)' : item.changePct < 0 ? 'var(--home-price-down)' : undefined }}
                    >
                      {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
