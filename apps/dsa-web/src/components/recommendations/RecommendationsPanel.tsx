import React, { useState, useCallback } from 'react';
import { Card } from '../common';
import { DashboardPanelHeader } from '../dashboard';
import { recommendationsApi } from '../../api/recommendations';
import type {
  DailyRecommendationsResponse,
  StockRecommendation,
  MarketContext,
  RecommendationRating,
  MarketStatus,
  RiskLevel,
} from '../../types/recommendations';

// ─────────────────────────────────────────────
// Helpers & constants
// ─────────────────────────────────────────────

const RATING_CONFIG: Record<
  Exclude<RecommendationRating, 'SKIP' | 'VETO'>,
  { label: string; dotClass: string; badgeClass: string }
> = {
  BUY: {
    label: 'MUA',
    dotClass: 'bg-[var(--home-strategy-buy)]',
    badgeClass:
      'bg-[hsl(149_100%_42%/0.12)] text-[var(--home-strategy-buy)] border border-[hsl(149_100%_42%/0.25)]',
  },
  WATCH: {
    label: 'THEO DÕI',
    dotClass: 'bg-[var(--home-strategy-take)]',
    badgeClass:
      'bg-[hsl(38_100%_52%/0.12)] text-[var(--home-strategy-take)] border border-[hsl(38_100%_52%/0.25)]',
  },
};

const MARKET_STATUS_CONFIG: Record<
  MarketStatus,
  { label: string; color: string; bg: string }
> = {
  BULL:        { label: 'TĂNG',     color: 'text-[var(--home-strategy-buy)]',  bg: 'bg-[hsl(149_100%_42%/0.1)]' },
  NEUTRAL:     { label: 'ĐI NGANG', color: 'text-[var(--home-strategy-take)]', bg: 'bg-[hsl(38_100%_52%/0.1)]'  },
  BEAR:        { label: 'GIẢM',     color: 'text-[var(--home-strategy-stop)]', bg: 'bg-[hsl(346_100%_63%/0.1)]' },
  SECTOR_HOT:  { label: 'NGÀNH NÓNG', color: 'text-[hsl(var(--primary))]',    bg: 'bg-[hsl(var(--primary)/0.1)]' },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string }> = {
  LOW:    { label: 'Thấp',     color: 'text-[var(--home-strategy-buy)]' },
  MEDIUM: { label: 'Trung bình', color: 'text-[var(--home-strategy-take)]' },
  HIGH:   { label: 'Cao',      color: 'text-[var(--home-strategy-stop)]' },
};

const SIGNAL_DISPLAY: Record<string, string> = {
  volume_breakout:   'Phá vỡ KL',
  shrink_pullback:   'Hồi về KL',
  bottom_volume:     'Đáy tăng KL',
  ma_golden_cross:   'MA Golden Cross',
  multi_ma_alignment: 'MA Đa tầng',
  dragon_head:       'Dẫn đầu ngành',
  emotion_bottom:    'Đáy cảm xúc',
};

function formatPrice(price?: number): string {
  if (price == null) return '—';
  return price.toLocaleString('vi-VN') + ' ₫';
}

function formatPct(pct?: number): string {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface ScoreBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, value, max, color }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-20 shrink-0 text-muted-text">{label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-[var(--border-dim)] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
    <span className="w-8 text-right font-mono tabular-nums text-foreground">{value}</span>
  </div>
);

interface RecommendationCardProps {
  rec: StockRecommendation;
  onAnalyze?: (stockCode: string) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ rec, onAnalyze }) => {
  const [expanded, setExpanded] = useState(false);
  const rating = rec.rating as Exclude<RecommendationRating, 'SKIP' | 'VETO'>;
  const cfg = RATING_CONFIG[rating];

  const changePctColor =
    rec.changePct == null
      ? 'text-muted-text'
      : rec.changePct >= 0
      ? 'text-[var(--home-price-up)]'
      : 'text-[var(--home-price-down)]';

  return (
    <div className="home-subpanel rounded-xl p-3 flex flex-col gap-2.5 transition-all">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground font-mono">
              {rec.stockCode.replace('VN:', '')}
            </span>
            {rec.stockName && (
              <span className="text-xs text-muted-text truncate max-w-[120px]">
                {rec.stockName}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${cfg.badgeClass}`}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {rec.currentPrice != null && (
              <span className="text-xs font-mono text-foreground">
                {formatPrice(rec.currentPrice)}
              </span>
            )}
            {rec.changePct != null && (
              <span className={`text-xs font-mono font-semibold ${changePctColor}`}>
                {formatPct(rec.changePct)}
              </span>
            )}
            {rec.sector && (
              <span className="text-xs text-secondary-text">
                {rec.sector}
                {rec.sectorRank != null && ` #${rec.sectorRank}`}
              </span>
            )}
          </div>
        </div>

        {/* Score circle */}
        <div className="flex flex-col items-center shrink-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
            style={{
              background:
                rec.score >= 75
                  ? 'hsl(149 100% 42% / 0.15)'
                  : 'hsl(38 100% 52% / 0.15)',
              color:
                rec.score >= 75
                  ? 'var(--home-strategy-buy)'
                  : 'var(--home-strategy-take)',
              border:
                rec.score >= 75
                  ? '1.5px solid hsl(149 100% 42% / 0.35)'
                  : '1.5px solid hsl(38 100% 52% / 0.35)',
            }}
          >
            {rec.score}
          </div>
          <span className="text-[10px] text-muted-text mt-0.5">/100</span>
        </div>
      </div>

      {/* Signal badge + volume ratio */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'hsl(var(--primary)/0.1)',
            color: 'hsl(var(--primary))',
            border: '1px solid hsl(var(--primary)/0.2)',
          }}
        >
          {SIGNAL_DISPLAY[rec.triggerSignal] ?? rec.triggerSignal}
        </span>
        {rec.volumeRatio != null && (
          <span className="text-xs text-muted-text">
            KL: <span className="font-mono text-foreground">{rec.volumeRatio.toFixed(1)}×</span>
          </span>
        )}
        {rec.riskReward != null && (
          <span className="text-xs text-muted-text">
            R/R: <span className="font-mono text-foreground">1:{rec.riskReward.toFixed(1)}</span>
          </span>
        )}
      </div>

      {/* Price levels — compact grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rec.entryLow != null && rec.entryHigh != null && (
          <div>
            <span className="text-muted-text">Vùng mua </span>
            <span className="font-mono text-[var(--home-strategy-secondary)]">
              {formatPrice(rec.entryLow)} – {formatPrice(rec.entryHigh)}
            </span>
          </div>
        )}
        {rec.stopLoss != null && (
          <div>
            <span className="text-muted-text">Dừng lỗ </span>
            <span className="font-mono text-[var(--home-strategy-stop)]">
              {formatPrice(rec.stopLoss)}
            </span>
          </div>
        )}
        {rec.target1 != null && (
          <div>
            <span className="text-muted-text">Mục tiêu 1 </span>
            <span className="font-mono text-[var(--home-strategy-buy)]">
              {formatPrice(rec.target1)}
            </span>
          </div>
        )}
        {rec.target2 != null && (
          <div>
            <span className="text-muted-text">Mục tiêu 2 </span>
            <span className="font-mono text-[var(--home-strategy-take)]">
              {formatPrice(rec.target2)}
            </span>
          </div>
        )}
      </div>

      {/* Expandable detail */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-xs text-secondary-text hover:text-foreground transition-colors self-start"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 pt-1 border-t border-[var(--border-dim)]">
          {/* Score breakdown bars */}
          {rec.scoreBreakdown && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-text uppercase tracking-wide">
                Điểm chi tiết
              </span>
              <ScoreBar label="Xu hướng" value={rec.scoreBreakdown.trend}    max={25} color="hsl(var(--primary))" />
              <ScoreBar label="Khối lượng" value={rec.scoreBreakdown.volume}  max={25} color="hsl(149 100% 42%)" />
              <ScoreBar label="Momentum" value={rec.scoreBreakdown.momentum} max={20} color="hsl(247 84% 66%)" />
              <ScoreBar label="Ngành"    value={rec.scoreBreakdown.sector}   max={15} color="hsl(38 100% 52%)" />
              <ScoreBar label="Rủi ro"   value={rec.scoreBreakdown.risk}     max={15} color="hsl(193 100% 43%)" />
            </div>
          )}

          {/* Buy reason */}
          {rec.buyReason && (
            <div>
              <span className="text-xs font-medium text-muted-text uppercase tracking-wide">
                Lý do khuyến nghị
              </span>
              <p className="mt-1 text-xs text-foreground leading-relaxed">{rec.buyReason}</p>
            </div>
          )}

          {/* Risk warning */}
          {rec.riskWarning && (
            <div className="rounded-lg p-2 bg-[hsl(346_100%_63%/0.08)] border border-[hsl(346_100%_63%/0.2)]">
              <span className="text-xs font-medium text-[var(--home-strategy-stop)]">
                ⚠ Cảnh báo
              </span>
              <p className="mt-0.5 text-xs text-foreground leading-relaxed">{rec.riskWarning}</p>
            </div>
          )}

          {/* Analyze button */}
          {onAnalyze && (
            <button
              type="button"
              onClick={() => onAnalyze(rec.stockCode)}
              className="self-start text-xs px-3 py-1 rounded-lg transition-colors"
              style={{
                background: 'hsl(var(--primary)/0.1)',
                color: 'hsl(var(--primary))',
                border: '1px solid hsl(var(--primary)/0.2)',
              }}
            >
              Phân tích sâu →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface MarketContextBadgeProps {
  context: MarketContext;
}

const MarketContextBadge: React.FC<MarketContextBadgeProps> = ({ context }) => {
  const statusCfg = MARKET_STATUS_CONFIG[context.marketStatus];
  const riskCfg = RISK_CONFIG[context.riskLevel];

  return (
    <div className="home-subpanel rounded-xl p-3 flex flex-col gap-2">
      {/* Row 1: status + risk + VN-Index */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color}`}
        >
          {statusCfg.label}
        </span>
        <span className={`text-xs ${riskCfg.color}`}>
          Rủi ro: <span className="font-semibold">{riskCfg.label}</span>
        </span>
        {context.vnIndexChangePct != null && (
          <span
            className={`text-xs font-mono font-semibold ${
              context.vnIndexChangePct >= 0
                ? 'text-[var(--home-price-up)]'
                : 'text-[var(--home-price-down)]'
            }`}
          >
            VN-Index {formatPct(context.vnIndexChangePct)}
          </span>
        )}
        {context.marketBreadthPct != null && (
          <span className="text-xs text-muted-text">
            Độ rộng: <span className="font-mono text-foreground">{context.marketBreadthPct.toFixed(0)}%</span>
          </span>
        )}
      </div>

      {/* Row 2: top sectors */}
      {context.topSectors.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-text shrink-0">Ngành dẫn đầu:</span>
          {context.topSectors.map((s) => (
            <span
              key={s.name}
              className="text-xs px-1.5 py-0.5 rounded-md bg-[hsl(149_100%_42%/0.1)] text-[var(--home-strategy-buy)]"
            >
              {s.name}
              {s.changePct != null && (
                <span className="ml-1 opacity-70">{formatPct(s.changePct)}</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Row 3: strategy text */}
      {context.overallStrategy && (
        <p className="text-xs text-secondary-text leading-relaxed">{context.overallStrategy}</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

interface RecommendationsPanelProps {
  /** Callback khi nhấn "Phân tích sâu" trên 1 mã cụ thể */
  onAnalyzeStock?: (stockCode: string) => void;
  className?: string;
}

type TabType = 'buy' | 'watch';
type LoadState = 'idle' | 'loading' | 'success' | 'error';

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  onAnalyzeStock,
  className = '',
}) => {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [data, setData] = useState<DailyRecommendationsResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('buy');

  const handleGenerate = useCallback(async () => {
    setLoadState('loading');
    setErrorMsg(null);
    try {
      const result = await recommendationsApi.generate({
        minScore: 60,
        limit: 10,
        includeMarketContext: true,
      });
      setData(result);
      setLoadState('success');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tạo khuyến nghị. Kiểm tra kết nối AI.';
      setErrorMsg(msg);
      setLoadState('error');
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoadState('loading');
    setErrorMsg(null);
    try {
      const result = await recommendationsApi.getToday({ limit: 10 });
      setData(result);
      setLoadState('success');
    } catch {
      // Nếu không có cache, sinh mới
      await handleGenerate();
    }
  }, [handleGenerate]);

  const totalBuy = data?.buyList.length ?? 0;
  const totalWatch = data?.watchList.length ?? 0;
  const activeList = activeTab === 'buy' ? data?.buyList : data?.watchList;

  return (
    <Card variant="bordered" padding="md" className={`home-panel-card ${className}`}>
      {/* Panel header */}
      <DashboardPanelHeader
        eyebrow="Tín hiệu thị trường VN"
        title="Cổ phiếu khuyến nghị hôm nay"
        className="mb-3"
        actions={
          data ? (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadState === 'loading'}
              className="flex items-center gap-1 text-xs text-secondary-text hover:text-foreground transition-colors disabled:opacity-50"
              title="Làm mới danh sách"
            >
              <svg
                className={`h-3.5 w-3.5 ${loadState === 'loading' ? 'animate-spin' : ''}`}
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
              Làm mới
            </button>
          ) : undefined
        }
      />

      {/* Idle / CTA state */}
      {loadState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'hsl(var(--primary)/0.1)' }}
          >
            <svg
              className="h-6 w-6"
              style={{ color: 'hsl(var(--primary))' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Quét tín hiệu thị trường</p>
            <p className="text-xs text-muted-text mt-0.5">
              Phân tích 7 tín hiệu kỹ thuật, chấm điểm 100 điểm
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Quét thị trường hôm nay
          </button>
        </div>
      )}

      {/* Loading state */}
      {loadState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <svg
            className="h-8 w-8 animate-spin"
            style={{ color: 'hsl(var(--primary))' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Đang quét thị trường...</p>
            <p className="text-xs text-muted-text">Chạy vn_market_scan + chấm điểm 100 điểm</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <p className="text-sm text-[var(--home-strategy-stop)]">{errorMsg}</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-dim)] hover:border-[var(--border-hover)] text-foreground transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Success state */}
      {loadState === 'success' && data && (
        <div className="flex flex-col gap-3">
          {/* Market context */}
          {data.marketContext && <MarketContextBadge context={data.marketContext} />}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-text flex-wrap">
            <span>
              Quét: <span className="font-mono text-foreground">{data.totalScanned.toLocaleString()}</span> mã
            </span>
            <span>
              Ứng viên: <span className="font-mono text-foreground">{data.totalCandidates}</span>
            </span>
            <span className="text-[var(--home-strategy-buy)] font-semibold">
              {totalBuy} MUA
            </span>
            <span className="text-[var(--home-strategy-take)] font-semibold">
              {totalWatch} THEO DÕI
            </span>
            <span className="ml-auto text-[10px]">
              {new Date(data.generatedAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* Tabs */}
          {(totalBuy > 0 || totalWatch > 0) && (
            <>
              <div className="flex border-b border-[var(--border-dim)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('buy')}
                  className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === 'buy'
                      ? 'border-[var(--home-strategy-buy)] text-[var(--home-strategy-buy)]'
                      : 'border-transparent text-muted-text hover:text-foreground'
                  }`}
                >
                  🟢 MUA ({totalBuy})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('watch')}
                  className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === 'watch'
                      ? 'border-[var(--home-strategy-take)] text-[var(--home-strategy-take)]'
                      : 'border-transparent text-muted-text hover:text-foreground'
                  }`}
                >
                  🟡 THEO DÕI ({totalWatch})
                </button>
              </div>

              {/* Recommendation list */}
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-0.5">
                {activeList && activeList.length > 0 ? (
                  activeList.map((rec) => (
                    <RecommendationCard
                      key={rec.stockCode}
                      rec={rec}
                      onAnalyze={onAnalyzeStock}
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted-text text-center py-4">
                    Không có cổ phiếu trong danh sách này hôm nay.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Empty result */}
          {totalBuy === 0 && totalWatch === 0 && (
            <div className="text-center py-6">
              <p className="text-sm font-medium text-foreground">Không có tín hiệu đủ mạnh hôm nay</p>
              <p className="text-xs text-muted-text mt-1">
                Thị trường chưa có cơ hội rõ ràng — kiên nhẫn chờ tín hiệu tốt hơn.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-text leading-relaxed border-t border-[var(--border-dim)] pt-2">
            {data.disclaimer}
          </p>
        </div>
      )}
    </Card>
  );
};

export default RecommendationsPanel;
