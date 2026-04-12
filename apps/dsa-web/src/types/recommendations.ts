/**
 * Recommendation-related type definitions.
 * Aligned with api/v1/schemas/recommendations.py
 */

// ─────────────────────────────────────────────
// Score breakdown
// ─────────────────────────────────────────────

export interface ScoreBreakdown {
  /** Nhóm A — Xu hướng (0–25) */
  trend: number;
  /** Nhóm B — Khối lượng (0–25) */
  volume: number;
  /** Nhóm C — Momentum (0–20) */
  momentum: number;
  /** Nhóm D — Ngành & Thị trường (0–15) */
  sector: number;
  /** Nhóm E — Rủi ro & Điểm vào (0–15) */
  risk: number;
  /** Tổng điểm (0–100) */
  total: number;
}

// ─────────────────────────────────────────────
// Signal metadata (from GET /signals)
// ─────────────────────────────────────────────

export type SignalCategory = 'trend' | 'reversal' | 'momentum';

export interface SignalMeta {
  id: string;
  name: string;
  description: string;
  baseScore: number;
  category: SignalCategory;
}

// ─────────────────────────────────────────────
// Stock recommendation
// ─────────────────────────────────────────────

export type RecommendationRating = 'BUY' | 'WATCH' | 'SKIP' | 'VETO';
export type SignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';

export interface StockRecommendation {
  stockCode: string;
  stockName?: string;
  sector?: string;
  sectorRank?: number;

  rating: RecommendationRating;
  score: number;
  scoreBreakdown?: ScoreBreakdown;

  triggerSignal: string;
  signalStrength: SignalStrength;

  currentPrice?: number;
  changePct?: number;
  volumeRatio?: number;

  entryLow?: number;
  entryHigh?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  riskReward?: number;

  buyReason?: string;
  riskWarning?: string;
}

// ─────────────────────────────────────────────
// Market context
// ─────────────────────────────────────────────

export type MarketStatus = 'BULL' | 'NEUTRAL' | 'BEAR' | 'SECTOR_HOT';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SectorSummary {
  name: string;
  changePct?: number;
  rank: number;
}

export interface MarketContext {
  marketStatus: MarketStatus;
  vnIndexChangePct?: number;
  marketBreadthPct?: number;
  totalLiquidityBn?: number;
  topSectors: SectorSummary[];
  weakSectors: SectorSummary[];
  overallStrategy?: string;
  riskLevel: RiskLevel;
}

// ─────────────────────────────────────────────
// Request / Response
// ─────────────────────────────────────────────

export interface DailyRecommendationsRequest {
  date?: string;
  minScore?: number;
  ratingFilter?: Array<'BUY' | 'WATCH'>;
  sectorFilter?: string[];
  signalFilter?: string[];
  limit?: number;
  includeMarketContext?: boolean;
}

export interface DailyRecommendationsResponse {
  date: string;
  generatedAt: string;
  marketContext?: MarketContext;
  buyList: StockRecommendation[];
  watchList: StockRecommendation[];
  totalScanned: number;
  totalCandidates: number;
  disclaimer: string;
}
