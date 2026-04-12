# -*- coding: utf-8 -*-
"""
===================================
Dịch vụ khuyến nghị cổ phiếu
===================================

Điều phối toàn bộ pipeline:
  1. Lấy bối cảnh thị trường (sector rankings, VN-Index)
  2. Chạy vn_market_scan để quét và lọc ứng viên
  3. Chấm điểm từng ứng viên theo bảng 100 điểm
  4. Phân loại BUY / WATCH / SKIP
  5. Tính các mức giá (vào, dừng lỗ, mục tiêu)
  6. Trả về DailyRecommendationsResponse có cấu trúc

Cache đơn giản trong bộ nhớ theo ngày — tránh chạy lại AI
nhiều lần trong cùng phiên giao dịch.
"""

import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Cache bộ nhớ đơn giản: { "YYYY-MM-DD": DailyRecommendationsResponse }
_daily_cache: Dict[str, Any] = {}


class RecommendationService:
    """
    Dịch vụ sinh danh sách khuyến nghị cổ phiếu hàng ngày.

    Sử dụng AnalysisService để chạy hai chiến lược:
    - vn_market_scan       : quét toàn thị trường, lọc ứng viên
    - vn_recommendation_engine : chấm điểm, phân loại, tính điểm giá
    """

    def __init__(self, config=None):
        self._config = config

    # ─────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────

    def generate_daily_recommendations(
        self,
        analysis_date: str,
        min_score: int = 60,
        rating_filter: Optional[List[str]] = None,
        sector_filter: Optional[List[str]] = None,
        signal_filter: Optional[List[str]] = None,
        limit: int = 10,
        include_market_context: bool = True,
    ):
        """
        Tạo danh sách khuyến nghị ngày, lưu cache, trả về kết quả.

        Args:
            analysis_date: Ngày phân tích (YYYY-MM-DD)
            min_score: Điểm tối thiểu để xuất hiện trong danh sách
            rating_filter: Lọc theo rating (BUY/WATCH)
            sector_filter: Lọc theo ngành
            signal_filter: Lọc theo tín hiệu
            limit: Số lượng tối đa
            include_market_context: Có kèm bối cảnh thị trường không

        Returns:
            DailyRecommendationsResponse
        """
        from api.v1.schemas.recommendations import DailyRecommendationsResponse

        logger.info("Generating recommendations for %s", analysis_date)

        # Lấy bối cảnh thị trường
        market_ctx = self._fetch_market_context() if include_market_context else None

        # Quét ứng viên qua vn_market_scan
        candidates = self._scan_candidates(market_ctx)

        # Chấm điểm qua vn_recommendation_engine
        scored = self._score_candidates(candidates, market_ctx)

        # Áp dụng filter
        scored = self._apply_filters(
            scored,
            min_score=min_score,
            sector_filter=sector_filter,
            signal_filter=signal_filter,
        )

        # Phân loại và giới hạn số lượng
        buy_list, watch_list = self._classify_and_limit(scored, limit=limit)

        # Lọc rating nếu có
        if rating_filter:
            if "BUY" not in rating_filter:
                buy_list = []
            if "WATCH" not in rating_filter:
                watch_list = []

        response = DailyRecommendationsResponse(
            date=analysis_date,
            generated_at=datetime.now().isoformat(),
            market_context=market_ctx,
            buy_list=buy_list,
            watch_list=watch_list,
            total_scanned=self._get_total_scanned(),
            total_candidates=len(candidates),
        )

        # Lưu vào cache
        _daily_cache[analysis_date] = response
        logger.info(
            "Recommendations generated: %d BUY, %d WATCH (scanned %d, candidates %d)",
            len(buy_list),
            len(watch_list),
            response.total_scanned,
            response.total_candidates,
        )
        return response

    def load_cached(self, analysis_date: str):
        """
        Tải khuyến nghị đã tạo trong ngày từ cache bộ nhớ.

        Returns:
            DailyRecommendationsResponse hoặc None nếu chưa có.
        """
        return _daily_cache.get(analysis_date)

    # ─────────────────────────────────────────────
    # Private helpers — Market context
    # ─────────────────────────────────────────────

    def _fetch_market_context(self):
        """
        Lấy bối cảnh thị trường: trạng thái VN-Index và bảng xếp hạng ngành.

        Cố gắng lấy dữ liệu thực từ data_provider. Nếu không khả dụng,
        trả về bối cảnh mặc định NEUTRAL để không làm hỏng toàn bộ luồng.
        """
        from api.v1.schemas.recommendations import MarketContext, SectorSummary

        try:
            sector_data = self._get_sector_rankings()
            vn_trend = self._get_vn_index_trend()

            market_status = self._determine_market_status(vn_trend, sector_data)
            risk_level = self._determine_risk_level(market_status, vn_trend)
            overall_strategy = self._build_strategy_text(market_status)

            top_sectors = [
                SectorSummary(name=s["name"], change_pct=s.get("change_pct"), rank=i + 1)
                for i, s in enumerate(sector_data.get("top", [])[:3])
            ]
            weak_sectors = [
                SectorSummary(name=s["name"], change_pct=s.get("change_pct"), rank=i + 1)
                for i, s in enumerate(sector_data.get("bottom", [])[:3])
            ]

            return MarketContext(
                market_status=market_status,
                vn_index_change_pct=vn_trend.get("change_pct"),
                market_breadth_pct=vn_trend.get("breadth_pct"),
                total_liquidity_bn=vn_trend.get("total_liquidity_bn"),
                top_sectors=top_sectors,
                weak_sectors=weak_sectors,
                overall_strategy=overall_strategy,
                risk_level=risk_level,
            )

        except Exception as exc:
            logger.warning("Could not fetch market context, using defaults: %s", exc)
            return MarketContext(
                market_status="NEUTRAL",
                risk_level="MEDIUM",
                overall_strategy="Không thể lấy dữ liệu thị trường. Thận trọng và kiểm tra thủ công.",
            )

    def _get_sector_rankings(self) -> Dict[str, Any]:
        """Lấy bảng xếp hạng ngành từ data_provider."""
        try:
            from data_provider.base import get_data_provider

            provider = get_data_provider()
            if hasattr(provider, "get_sector_rankings"):
                return provider.get_sector_rankings() or {}
        except Exception as exc:
            logger.debug("Sector rankings unavailable: %s", exc)
        return {}

    def _get_vn_index_trend(self) -> Dict[str, Any]:
        """Lấy xu hướng VN-Index từ data_provider."""
        try:
            from data_provider.base import get_data_provider

            provider = get_data_provider()
            # Thử lấy quote VN-Index (mã VNINDEX hoặc VN:VNINDEX)
            for code in ("VN:VNINDEX", "VNINDEX", "^VNINDEX"):
                if hasattr(provider, "get_realtime_quote"):
                    quote = provider.get_realtime_quote(code)
                    if quote:
                        return {
                            "change_pct": quote.get("change_pct"),
                            "breadth_pct": None,
                            "total_liquidity_bn": None,
                        }
        except Exception as exc:
            logger.debug("VN-Index trend unavailable: %s", exc)
        return {}

    def _determine_market_status(
        self, vn_trend: Dict[str, Any], sector_data: Dict[str, Any]
    ) -> str:
        """Xác định trạng thái thị trường dựa trên dữ liệu."""
        change_pct = vn_trend.get("change_pct")
        breadth = vn_trend.get("breadth_pct")
        top_sectors = sector_data.get("top", [])

        # Kiểm tra SECTOR_HOT: 1–2 ngành tăng đột biến > 3%
        if top_sectors and top_sectors[0].get("change_pct", 0) > 3:
            return "SECTOR_HOT"

        if change_pct is None:
            return "NEUTRAL"

        if change_pct >= 0.5 and (breadth is None or breadth >= 55):
            return "BULL"
        if change_pct <= -0.5 and (breadth is None or breadth <= 45):
            return "BEAR"
        return "NEUTRAL"

    def _determine_risk_level(self, market_status: str, vn_trend: Dict) -> str:
        """Xác định mức rủi ro tổng thể."""
        if market_status == "BEAR":
            return "HIGH"
        if market_status == "BULL":
            return "LOW"
        return "MEDIUM"

    def _build_strategy_text(self, market_status: str) -> str:
        """Tạo mô tả chiến lược tổng thể theo trạng thái thị trường."""
        strategies = {
            "BULL": (
                "Thị trường tăng — tập trung vào breakout và hồi về MA "
                "trong ngành dẫn đầu. Có thể tăng tỷ trọng."
            ),
            "NEUTRAL": (
                "Thị trường đi ngang — ưu tiên hồi về giảm KL và golden cross. "
                "Kiểm soát vị thế, ưu tiên chọn lọc."
            ),
            "BEAR": (
                "Thị trường giảm — hạn chế mua mới, chỉ xem xét đảo chiều "
                "đáy KL với vị thế nhỏ. Ưu tiên bảo toàn vốn."
            ),
            "SECTOR_HOT": (
                "Ngành nóng — tập trung vào cổ phiếu dẫn đầu ngành đang "
                "trong chu kỳ luân chuyển. Quản lý chặt dừng lỗ."
            ),
        }
        return strategies.get(market_status, "Phân tích thêm trước khi quyết định.")

    # ─────────────────────────────────────────────
    # Private helpers — Scanning & Scoring
    # ─────────────────────────────────────────────

    def _scan_candidates(self, market_ctx) -> List[Dict[str, Any]]:
        """
        Quét ứng viên bằng cách chạy AnalysisService với chiến lược vn_market_scan.

        Hiện tại trả về danh sách rỗng (framework sẵn sàng cho tích hợp AI).
        Khi AnalysisService hỗ trợ chế độ "market scan", hàm này sẽ gọi:
            service.run_market_scan(strategy="vn_market_scan")
        và parse danh sách mã ra từ kết quả.
        """
        logger.info("Running vn_market_scan — scanning market candidates")
        # TODO: Tích hợp với AnalysisService khi có API market scan
        return []

    def _score_candidates(
        self,
        candidates: List[Dict[str, Any]],
        market_ctx,
    ) -> List[Dict[str, Any]]:
        """
        Chấm điểm từng ứng viên theo bảng 100 điểm của vn_recommendation_engine.

        Với mỗi ứng viên:
        - Gọi AnalysisService.analyze_stock() để lấy dữ liệu kỹ thuật
        - Áp dụng bảng điểm 5 nhóm (xu hướng, khối lượng, momentum, ngành, rủi ro)
        - Tính điểm vào / dừng lỗ / mục tiêu
        - Xây dựng StockRecommendation

        TODO: Kết nối với AnalysisService.analyze_stock() thực sự.
        """
        scored = []
        for candidate in candidates:
            try:
                rec = self._score_single_candidate(candidate, market_ctx)
                if rec:
                    scored.append(rec)
            except Exception as exc:
                logger.warning(
                    "Scoring failed for %s: %s",
                    candidate.get("stock_code", "?"),
                    exc,
                )
        return scored

    def _score_single_candidate(
        self, candidate: Dict[str, Any], market_ctx
    ):
        """
        Tính điểm tổng hợp 100 điểm cho 1 ứng viên và xây dựng StockRecommendation.

        Nguồn dữ liệu: candidate dict từ vn_market_scan với các trường:
        - stock_code, stock_name, sector, trigger_signal
        - base_signal_score (điểm cơ sở từ tín hiệu kích hoạt)
        - trend_data, volume_data, momentum_data, sector_data, risk_data
          (từ AnalysisService.analyze_stock())
        """
        from api.v1.schemas.recommendations import (
            StockRecommendation,
            ScoreBreakdown,
        )

        stock_code = candidate.get("stock_code", "")
        trigger = candidate.get("trigger_signal", "unknown")

        # Tính điểm từng nhóm
        trend_score = self._score_trend(candidate)
        volume_score = self._score_volume(candidate)
        momentum_score = self._score_momentum(candidate)
        sector_score = self._score_sector(candidate, market_ctx)
        risk_score = self._score_risk(candidate)

        total = trend_score + volume_score + momentum_score + sector_score + risk_score
        total = min(100, max(0, total))

        # Xác định rating
        has_veto = candidate.get("has_veto", False)
        if has_veto:
            rating = "VETO"
        elif total >= 75:
            rating = "BUY"
        elif total >= 60:
            rating = "WATCH"
        else:
            rating = "SKIP"

        if rating in ("SKIP", "VETO"):
            return None

        # Tính signal strength
        signal_strength = (
            "STRONG" if total >= 80
            else "MEDIUM" if total >= 65
            else "WEAK"
        )

        # Tính các mức giá
        current_price = candidate.get("current_price")
        entry_low, entry_high, stop_loss, target_1, target_2, rr = (
            self._calculate_price_levels(candidate)
        )

        return StockRecommendation(
            stock_code=stock_code,
            stock_name=candidate.get("stock_name"),
            sector=candidate.get("sector"),
            sector_rank=candidate.get("sector_rank"),
            rating=rating,
            score=total,
            score_breakdown=ScoreBreakdown(
                trend=trend_score,
                volume=volume_score,
                momentum=momentum_score,
                sector=sector_score,
                risk=risk_score,
                total=total,
            ),
            trigger_signal=trigger,
            signal_strength=signal_strength,
            current_price=current_price,
            change_pct=candidate.get("change_pct"),
            volume_ratio=candidate.get("volume_ratio"),
            entry_low=entry_low,
            entry_high=entry_high,
            stop_loss=stop_loss,
            target_1=target_1,
            target_2=target_2,
            risk_reward=rr,
            buy_reason=candidate.get("buy_reason"),
            risk_warning=candidate.get("risk_warning"),
        )

    # ─────────────────────────────────────────────
    # Bảng điểm 5 nhóm
    # ─────────────────────────────────────────────

    def _score_trend(self, c: Dict) -> int:
        """Nhóm A — Xu hướng (0–25đ)."""
        ma = c.get("ma_alignment", "unknown")
        slope_up = c.get("ma20_slope_up", False)

        score = 0
        if ma == "perfect":        # MA5 > MA10 > MA20 > MA60
            score = 25
        elif ma == "basic":        # MA5 > MA10 > MA20
            score = 18
        elif ma == "weak":         # MA5 > MA10, MA20 flat
            score = 10
        elif ma == "reversal":     # Giá dưới MA20, đang hồi
            score = 5
        elif ma == "bearish":
            score = max(0, score - 10)

        if slope_up:
            score = min(25, score + 3)
        if c.get("trend_days", 0) > 20:
            score = min(25, score + 2)

        return min(25, max(0, score))

    def _score_volume(self, c: Dict) -> int:
        """Nhóm B — Khối lượng (0–25đ)."""
        vr = c.get("volume_ratio", 1.0)
        price_up = c.get("price_up", True)
        trigger = c.get("trigger_signal", "")

        if trigger == "volume_breakout" and vr >= 2.0 and price_up:
            return 25
        if vr >= 1.5 and price_up:
            return 18
        if vr >= 1.2 and price_up:
            return 12
        if trigger == "shrink_pullback" and vr < 0.7:
            return 15
        if trigger == "emotion_bottom" and vr < 0.5:
            return 10
        if 0.7 <= vr <= 1.2:
            return 8
        if not price_up and vr >= 1.5:
            return max(0, 8 - 5)   # divergence penalty
        if not price_up and vr >= 3.0:
            return 0               # sell-off
        return 8

    def _score_momentum(self, c: Dict) -> int:
        """Nhóm C — Momentum (0–20đ)."""
        score = 0
        macd = c.get("macd_status", "")
        rsi = c.get("rsi_14", 50.0)
        candle = c.get("candle_pattern", "")

        # MACD
        if macd == "golden_cross_above_zero":
            score += 8
        elif macd == "golden_cross_below_zero":
            score += 5
        elif macd == "histogram_rising":
            score += 3
        elif macd == "bearish_divergence":
            score -= 8

        # RSI
        if 40 <= rsi <= 65:
            score += 5
        elif 65 < rsi <= 70:
            score += 2
        elif rsi < 40:
            score += 3
        elif rsi > 70:
            score -= 5

        # Nến K
        if candle in ("bullish_marubozu", "strong_bullish"):
            score += 4
        elif candle in ("hammer", "shooting_star", "doji_reversal"):
            score += 2

        return min(20, max(0, score))

    def _score_sector(self, c: Dict, market_ctx) -> int:
        """Nhóm D — Ngành & Thị trường (0–15đ)."""
        sector_rank = c.get("sector_rank")
        relative_strength = c.get("relative_strength_vs_sector", 0.0)
        market_status = getattr(market_ctx, "market_status", "NEUTRAL") if market_ctx else "NEUTRAL"

        score = 0
        if sector_rank is not None:
            if sector_rank <= 3:
                score = 15
            elif sector_rank <= 6:
                score = 10
            else:
                score = 5

        if relative_strength > 2.0:
            score = min(18, score + 3)   # bonus relative strength

        if sector_rank is not None and sector_rank > 20:
            score = max(0, score - 8)    # ngành yếu

        if market_status == "BEAR":
            score = max(0, score - 5)

        return min(15, max(0, score))

    def _score_risk(self, c: Dict) -> int:
        """Nhóm E — Rủi ro & Điểm vào (0–15đ)."""
        has_veto = c.get("has_veto", False)
        if has_veto:
            return -99   # sẽ dẫn đến VETO

        score = 0
        if not c.get("has_bad_news", False):
            score += 5
        if c.get("has_positive_catalyst", False):
            score += 5

        rr = c.get("risk_reward_estimate", 0.0)
        if rr >= 3.0:
            score += 5
        elif rr >= 2.0:
            score += 3

        deviation = c.get("deviation_from_ma5_pct", 5.0)
        if 0 <= deviation <= 3:
            score += 3    # điểm vào tối ưu

        if c.get("has_minor_bad_news", False):
            score -= 5
        if rr < 1.5:
            score -= 8
        if c.get("gain_20d_pct", 0) > 30:
            score -= 10

        return min(15, max(-99, score))

    # ─────────────────────────────────────────────
    # Tính mức giá
    # ─────────────────────────────────────────────

    def _calculate_price_levels(self, c: Dict):
        """
        Tính entry zone, stop loss, target 1&2 và R/R ratio.

        Returns:
            (entry_low, entry_high, stop_loss, target_1, target_2, risk_reward)
        """
        price = c.get("current_price")
        if not price:
            return None, None, None, None, None, None

        ma5 = c.get("ma5", price)
        ma20 = c.get("ma20", price * 0.93)
        resistance = c.get("resistance_1", price * 1.10)
        resistance_2 = c.get("resistance_2", price * 1.20)
        support = c.get("support_1", ma20)

        # Entry zone: gần MA5 ±1.5%
        entry_low = round(ma5 * 0.985, 0)
        entry_high = round(ma5 * 1.015, 0)

        # Stop loss: dưới MA20 × 3% hoặc dưới support
        stop_from_ma20 = round(ma20 * 0.97, 0)
        stop_from_support = round(support * 0.98, 0)
        stop_loss = max(stop_from_ma20, stop_from_support)
        # Giới hạn dừng lỗ tối đa 7% từ điểm vào trung bình
        entry_mid = (entry_low + entry_high) / 2
        max_stop = round(entry_mid * 0.93, 0)
        stop_loss = max(stop_loss, max_stop)

        # Targets
        target_1 = round(resistance, 0)
        target_2 = round(resistance_2, 0)

        # R/R: dùng entry_mid
        risk = entry_mid - stop_loss
        reward = target_1 - entry_mid
        rr = round(reward / risk, 2) if risk > 0 else None

        return entry_low, entry_high, stop_loss, target_1, target_2, rr

    # ─────────────────────────────────────────────
    # Filter & classify helpers
    # ─────────────────────────────────────────────

    def _apply_filters(
        self,
        scored: List,
        min_score: int,
        sector_filter: Optional[List[str]],
        signal_filter: Optional[List[str]],
    ) -> List:
        """Áp dụng filter điểm, ngành và tín hiệu."""
        result = [r for r in scored if r.score >= min_score]

        if sector_filter:
            sectors_lower = [s.lower() for s in sector_filter]
            result = [
                r for r in result
                if r.sector and r.sector.lower() in sectors_lower
            ]

        if signal_filter:
            signals_lower = [s.lower() for s in signal_filter]
            result = [
                r for r in result
                if r.trigger_signal.lower() in signals_lower
            ]

        return result

    def _classify_and_limit(
        self, scored: List, limit: int
    ):
        """Phân loại BUY / WATCH và giới hạn số lượng."""
        buy_list = sorted(
            [r for r in scored if r.rating == "BUY"],
            key=lambda x: x.score,
            reverse=True,
        )
        watch_list = sorted(
            [r for r in scored if r.rating == "WATCH"],
            key=lambda x: x.score,
            reverse=True,
        )

        # Ưu tiên BUY, còn lại dành cho WATCH
        buy_list = buy_list[:limit]
        remaining = limit - len(buy_list)
        watch_list = watch_list[:remaining]

        return buy_list, watch_list

    def _get_total_scanned(self) -> int:
        """Trả về tổng số cổ phiếu đã quét (placeholder)."""
        # TODO: Lấy từ data_provider khi có market scan thực
        return 0
