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

import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Cache bộ nhớ đơn giản: { "YYYY-MM-DD": DailyRecommendationsResponse }
_daily_cache: Dict[str, Any] = {}

# Số cổ phiếu VN hàng đầu để quét (theo điểm phổ biến trong stocks.index.json)
_SCAN_TOP_N = 60
# Số worker song song khi fetch lịch sử (1 = tuần tự để không bị rate-limit VCI)
_SCAN_WORKERS = 1
# Số phiên lịch sử tối thiểu để tính chỉ báo
_MIN_HISTORY_DAYS = 25
# Delay tối thiểu (giây) giữa các lần fetch để tránh 429
_FETCH_DELAY = 1.0


class RecommendationService:
    """
    Dịch vụ sinh danh sách khuyến nghị cổ phiếu hàng ngày.

    Sử dụng AnalysisService để chạy hai chiến lược:
    - vn_market_scan       : quét toàn thị trường, lọc ứng viên
    - vn_recommendation_engine : chấm điểm, phân loại, tính điểm giá
    """

    def __init__(self, config=None):
        self._config = config
        self._total_scanned: int = 0

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
        Quét ứng viên theo chiến lược vn_market_scan.

        Hai giai đoạn:
        1. Lấy danh sách top N cổ phiếu VN từ stocks.index.json
        2. Fetch lịch sử song song (ThreadPoolExecutor), tính chỉ báo kỹ thuật
           và áp dụng 7 bộ lọc tín hiệu

        Returns:
            Danh sách dict ứng viên đã làm giàu dữ liệu cho vn_recommendation_engine.
        """
        logger.info("Running vn_market_scan — scanning market candidates")

        stock_codes = self._load_top_vn_stocks(_SCAN_TOP_N)
        if not stock_codes:
            logger.warning("Không tải được danh sách cổ phiếu VN")
            return []

        self._total_scanned = len(stock_codes)
        logger.info("Quét %d cổ phiếu VN hàng đầu", len(stock_codes))

        # Khởi tạo DataFetcherManager một lần để dùng chung
        try:
            from data_provider.base import DataFetcherManager
            mgr = DataFetcherManager()
        except Exception as exc:
            logger.warning("Không khởi tạo được DataFetcherManager: %s", exc)
            return []

        candidates: List[Dict[str, Any]] = []

        for code in stock_codes:
            try:
                result = self._analyze_single_stock(code, market_ctx, mgr)
                if result is not None:
                    candidates.append(result)
            except Exception as exc:
                logger.debug("Lỗi quét %s: %s", code, exc)

        logger.info(
            "Quét xong: %d/%d ứng viên vượt bộ lọc tín hiệu",
            len(candidates),
            len(stock_codes),
        )
        return candidates

    # ─────────────────────────────────────────────
    # Market scan helpers
    # ─────────────────────────────────────────────

    def _load_top_vn_stocks(self, n: int) -> List[str]:
        """
        Đọc top N cổ phiếu VN từ stocks.index.json (sắp xếp theo điểm phổ biến giảm dần).

        Format mỗi phần tử: [full_code, code, name, ..., region, type, active, score]
        Chỉ lấy các mã thuộc region="VN" và type="stock" đang active.
        """
        index_path = os.path.join(
            os.path.dirname(__file__),
            "../../apps/dsa-web/public/stocks.index.json",
        )
        index_path = os.path.normpath(index_path)
        try:
            with open(index_path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            logger.warning("Không đọc được stocks.index.json: %s", exc)
            return []

        vn_stocks = [
            entry
            for entry in data
            if (
                len(entry) >= 9
                and entry[6] == "VN"
                and entry[7] == "stock"
                and entry[8] is True  # active
            )
        ]

        # Sắp xếp theo điểm phổ biến (index 9) giảm dần
        vn_stocks.sort(key=lambda x: x[9] if len(x) > 9 else 0, reverse=True)

        # Trả về full_code (index 0, dạng "VN:VIC")
        return [entry[0] for entry in vn_stocks[:n]]

    def _analyze_single_stock(
        self, stock_code: str, market_ctx, mgr=None
    ) -> Optional[Dict[str, Any]]:
        """
        Lấy lịch sử 65 ngày cho một mã, tính chỉ báo kỹ thuật và kiểm tra 7 tín hiệu.

        Args:
            mgr: DataFetcherManager đã khởi tạo (tránh tạo mới mỗi lần)

        Returns:
            Dict ứng viên đã làm giàu nếu vượt bộ lọc, None nếu không.
        """
        try:
            import time as _time

            if mgr is None:
                from data_provider.base import DataFetcherManager
                mgr = DataFetcherManager()

            # Delay để tránh rate-limit VCI API
            _time.sleep(_FETCH_DELAY)

            # Retry tối đa 2 lần nếu gặp 429 (exponential backoff)
            df = None
            for attempt in range(3):
                try:
                    df, _ = mgr.get_daily_data(stock_code, days=65)
                    break
                except Exception as exc:
                    if "429" in str(exc) and attempt < 2:
                        wait = 5.0 * (2 ** attempt)  # 5s, 10s
                        logger.debug("429 cho %s — chờ %.0fs rồi thử lại", stock_code, wait)
                        _time.sleep(wait)
                    else:
                        raise
            if df is None or len(df) < _MIN_HISTORY_DAYS:
                return None

            df = df.sort_values("date").reset_index(drop=True)

            closes = df["close"].values.astype(float)
            volumes = df["volume"].fillna(0).values.astype(float)
            opens = df["open"].values.astype(float)
            highs = df["high"].values.astype(float)
            lows = df["low"].values.astype(float)

            n = len(closes)

            # ── Đường MA ──────────────────────────────────────────
            def _sma(arr, w):
                if len(arr) < w:
                    return np.nan
                return float(np.mean(arr[-w:]))

            ma5  = _sma(closes, 5)
            ma10 = _sma(closes, 10)
            ma20 = _sma(closes, 20)
            ma60 = _sma(closes, min(60, n))

            # MA20 slope: so sánh MA20 hôm nay vs 5 ngày trước
            ma20_prev = _sma(closes[:-5], 20) if n >= 25 else np.nan
            ma20_slope_up = (not np.isnan(ma20) and not np.isnan(ma20_prev)
                             and ma20 > ma20_prev)

            # ── Khối lượng ────────────────────────────────────────
            avg_vol_20 = float(np.mean(volumes[-20:])) if n >= 20 else float(np.mean(volumes))
            avg_vol_60 = float(np.mean(volumes[-60:])) if n >= 60 else avg_vol_20
            today_vol  = float(volumes[-1])
            volume_ratio = today_vol / avg_vol_20 if avg_vol_20 > 0 else 1.0

            # Bộ lọc loại trừ bắt buộc: thanh khoản quá thấp
            if avg_vol_20 < 100_000:
                return None

            # ── Giá hiện tại ───────────────────────────────────────
            current_price = float(closes[-1])
            prev_close    = float(closes[-2]) if n >= 2 else current_price
            today_open    = float(opens[-1])
            today_high    = float(highs[-1])
            today_low     = float(lows[-1])
            change_pct    = (current_price - prev_close) / prev_close * 100 if prev_close else 0.0
            price_up      = current_price > prev_close

            # Bộ lọc loại trừ: biến động bất thường > 15% một phiên
            if abs(change_pct) > 15:
                return None

            # Bộ lọc loại trừ: giá dưới MA50 hơn 10% trong xu hướng giảm
            ma50 = _sma(closes, min(50, n))
            if not np.isnan(ma50) and current_price < ma50 * 0.90:
                return None

            # ── RSI(14) ───────────────────────────────────────────
            rsi = self._calc_rsi(closes, 14)

            # ── MACD ──────────────────────────────────────────────
            macd_status = self._calc_macd_status(closes)

            # ── MA alignment ──────────────────────────────────────
            ma_align = self._classify_ma_alignment(
                current_price, ma5, ma10, ma20, ma60
            )

            # ── Xác định tín hiệu kích hoạt ───────────────────────
            trigger = self._detect_trigger_signal(
                closes=closes,
                volumes=volumes,
                current_price=current_price,
                today_open=today_open,
                today_high=today_high,
                today_low=today_low,
                change_pct=change_pct,
                price_up=price_up,
                volume_ratio=volume_ratio,
                avg_vol_60=avg_vol_60,
                ma5=ma5,
                ma10=ma10,
                ma20=ma20,
                ma60=ma60,
                ma20_slope_up=ma20_slope_up,
                rsi=rsi,
                market_ctx=market_ctx,
            )
            if trigger is None:
                return None

            # ── Hỗ trợ / kháng cự đơn giản ───────────────────────
            recent_highs = highs[-20:]
            recent_lows  = lows[-20:]
            resistance_1 = float(np.percentile(recent_highs, 90))
            support_1    = float(np.percentile(recent_lows, 10))
            resistance_2 = resistance_1 * 1.10

            # Độ lệch % từ MA5
            dev_from_ma5 = (
                abs(current_price - ma5) / ma5 * 100
                if not np.isnan(ma5) and ma5 > 0
                else 5.0
            )

            # Tên cổ phiếu (từ index JSON — không gọi API thêm)
            stock_name = None
            try:
                stock_name = mgr.get_stock_name(stock_code, allow_realtime=False)
            except Exception:
                pass

            return {
                "stock_code": stock_code,
                "stock_name": stock_name,
                "trigger_signal": trigger,
                "current_price": current_price,
                "change_pct": round(change_pct, 2),
                "volume_ratio": round(volume_ratio, 2),
                "avg_vol_20": avg_vol_20,
                "price_up": price_up,
                "ma5": round(ma5, 3) if not np.isnan(ma5) else None,
                "ma10": round(ma10, 3) if not np.isnan(ma10) else None,
                "ma20": round(ma20, 3) if not np.isnan(ma20) else None,
                "ma60": round(ma60, 3) if not np.isnan(ma60) else None,
                "ma20_slope_up": ma20_slope_up,
                "ma_alignment": ma_align,
                "rsi_14": round(rsi, 1) if rsi is not None else 50.0,
                "macd_status": macd_status,
                "support_1": round(support_1, 3),
                "resistance_1": round(resistance_1, 3),
                "resistance_2": round(resistance_2, 3),
                "deviation_from_ma5_pct": round(dev_from_ma5, 2),
                "gain_20d_pct": round(
                    (current_price - float(closes[-20])) / float(closes[-20]) * 100
                    if n >= 20 else 0.0,
                    2,
                ),
                "has_veto": False,
                "has_bad_news": False,
                "has_positive_catalyst": False,
                "risk_reward_estimate": 2.5,  # placeholder trước khi score
                "trend_days": int(self._count_trend_days(closes)),
                "candle_pattern": self._detect_candle_pattern(
                    today_open, today_high, today_low, current_price, prev_close
                ),
            }

        except Exception as exc:
            logger.debug("Lỗi phân tích %s: %s", stock_code, exc)
            return None

    def _detect_trigger_signal(
        self,
        closes, volumes, current_price, today_open, today_high, today_low,
        change_pct, price_up, volume_ratio, avg_vol_60,
        ma5, ma10, ma20, ma60, ma20_slope_up, rsi, market_ctx,
    ) -> Optional[str]:
        """
        Kiểm tra lần lượt 7 tín hiệu, trả về tên tín hiệu đầu tiên khớp.

        Thứ tự ưu tiên: dragon_head > volume_breakout > bottom_volume
                       > ma_golden_cross > multi_ma_alignment
                       > shrink_pullback > emotion_bottom
        """
        n = len(closes)
        today_vol = float(volumes[-1]) if len(volumes) > 0 else 0.0

        # ── Tín hiệu 6: Dragon Head ───────────────────────────────
        # Ngành top 3 + mã tăng vượt ngành 2%
        # Điều kiện rút gọn (không có sector per stock): tăng mạnh > 3% trong ngày
        # với khối lượng > 1.5× trung bình
        if change_pct >= 3.0 and volume_ratio >= 1.5 and price_up:
            # Kiểm tra thêm: mã dẫn đầu (không bị kéo theo) — đơn giản là tăng > MA5
            if not np.isnan(ma5) and current_price > ma5:
                return "dragon_head"

        # ── Tín hiệu 1: Volume Breakout ───────────────────────────
        # volume_ratio >= 2.0, tăng >= 1.5%, MA5 > MA10 > MA20
        if (
            volume_ratio >= 2.0
            and change_pct >= 1.5
            and price_up
            and not np.isnan(ma5)
            and not np.isnan(ma10)
            and not np.isnan(ma20)
            and ma5 > ma10 > ma20
        ):
            # Đóng cửa trong 30% trên của biên độ ngày
            day_range = today_high - today_low
            if day_range > 0:
                close_position = (current_price - today_low) / day_range
                if close_position >= 0.7:
                    return "volume_breakout"
            else:
                return "volume_breakout"

        # ── Tín hiệu 3: Bottom Volume Surge ──────────────────────
        # Giảm > 15% từ đỉnh 20 ngày, volume_ratio >= 3.0, nến xanh
        if n >= 20:
            peak_20 = float(np.max(closes[-20:]))
            drop_from_peak = (peak_20 - current_price) / peak_20 * 100 if peak_20 > 0 else 0
            if (
                drop_from_peak >= 15.0
                and volume_ratio >= 3.0
                and current_price > today_open
            ):
                # Bóng nến dưới dài (shadow >= 1.5× thân)
                body = abs(current_price - today_open)
                lower_shadow = today_open - today_low if today_open > today_low else current_price - today_low
                if body == 0 or lower_shadow >= 1.5 * body:
                    return "bottom_volume"
                return "bottom_volume"  # nến xanh là đủ

        # ── Tín hiệu 4: MA Golden Cross ──────────────────────────
        # MA5 cắt lên MA10 trong 3 phiên gần nhất, khối lượng > 1.2× TB5
        if n >= 15 and not np.isnan(ma5) and not np.isnan(ma10):
            cross_detected = False
            for i in range(1, 4):
                ma5_prev_i  = float(np.mean(closes[-(5 + i):-(i)])) if n >= 5 + i else np.nan
                ma10_prev_i = float(np.mean(closes[-(10 + i):-(i)])) if n >= 10 + i else np.nan
                if not np.isnan(ma5_prev_i) and not np.isnan(ma10_prev_i):
                    if ma5_prev_i <= ma10_prev_i and ma5 > ma10:
                        cross_detected = True
                        break
            avg_vol_5 = float(np.mean(volumes[-5:])) if n >= 5 else 0
            if cross_detected and avg_vol_5 > 0 and (volumes[-1] / avg_vol_5 >= 1.2):
                return "ma_golden_cross"

        # ── Tín hiệu 5: Multi-MA Alignment ───────────────────────
        # MA5 > MA10 > MA20 > MA60, giá trên MA20, độ lệch MA5 trong 2–8%
        if (
            not np.isnan(ma5)
            and not np.isnan(ma10)
            and not np.isnan(ma20)
            and not np.isnan(ma60)
            and ma5 > ma10 > ma20 > ma60
            and current_price > ma20
            and ma20_slope_up
        ):
            dev_from_ma5_pct = abs(current_price - ma5) / ma5 * 100 if ma5 > 0 else 99
            if 2.0 <= dev_from_ma5_pct <= 8.0:
                avg_vol_5 = float(np.mean(volumes[-5:])) if n >= 5 else 0
                avg_vol_20 = float(np.mean(volumes[-20:])) if n >= 20 else avg_vol_5
                if avg_vol_20 > 0 and avg_vol_5 / avg_vol_20 >= 1.0:
                    return "multi_ma_alignment"

        # ── Tín hiệu 2: Shrink Pullback ──────────────────────────
        # MA5 > MA10 > MA20, volume_ratio <= 0.7, giá gần MA5 (<=1.5%) hoặc MA10 (<=2.5%)
        if (
            not np.isnan(ma5)
            and not np.isnan(ma10)
            and not np.isnan(ma20)
            and ma5 > ma10 > ma20
            and volume_ratio <= 0.7
        ):
            near_ma5  = abs(current_price - ma5) / ma5 * 100 <= 1.5
            near_ma10 = abs(current_price - ma10) / ma10 * 100 <= 2.5
            if near_ma5 or near_ma10:
                # MA20 không bị phá trong 5 phiên gần nhất
                if n >= 25:
                    # Kiểm tra giá không xuống dưới MA20 trong 5 phiên
                    min_5 = float(np.min(closes[-5:])) if n >= 5 else current_price
                    if min_5 >= ma20 * 0.98:
                        return "shrink_pullback"
                else:
                    return "shrink_pullback"

        # ── Tín hiệu 7: Emotion Bottom ───────────────────────────
        # Volume < 50% avg_60d, RSI < 30, giá tiếp cận MA20 từ dưới
        if (
            rsi is not None
            and rsi < 30
            and avg_vol_60 > 0
            and today_vol / avg_vol_60 < 0.5
            and not np.isnan(ma20)
            and current_price >= ma20 * 0.90  # chưa phá hỗ trợ quan trọng
        ):
            return "emotion_bottom"

        return None

    # ─────────────────────────────────────────────
    # Technical indicator helpers
    # ─────────────────────────────────────────────

    @staticmethod
    def _calc_rsi(closes: np.ndarray, period: int = 14) -> Optional[float]:
        """Tính RSI(period) từ mảng giá đóng cửa."""
        if len(closes) < period + 1:
            return None
        deltas = np.diff(closes[-(period + 1):].astype(float))
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return round(100 - 100 / (1 + rs), 2)

    @staticmethod
    def _calc_ema(arr: np.ndarray, period: int) -> np.ndarray:
        """Tính EMA(period) cho mảng giá."""
        alpha = 2.0 / (period + 1)
        ema = np.empty_like(arr, dtype=float)
        ema[0] = arr[0]
        for i in range(1, len(arr)):
            ema[i] = alpha * arr[i] + (1 - alpha) * ema[i - 1]
        return ema

    def _calc_macd_status(self, closes: np.ndarray) -> str:
        """
        Tính trạng thái MACD đơn giản từ EMA12, EMA26, Signal9.

        Returns:
            'golden_cross_above_zero' | 'golden_cross_below_zero' |
            'histogram_rising' | 'bearish_divergence' | 'neutral'
        """
        if len(closes) < 35:
            return "neutral"
        c = closes.astype(float)
        ema12 = self._calc_ema(c, 12)
        ema26 = self._calc_ema(c, 26)
        macd_line = ema12 - ema26
        signal    = self._calc_ema(macd_line, 9)
        hist      = macd_line - signal

        cur_hist  = hist[-1]
        prev_hist = hist[-2]

        # Golden cross: MACD cắt lên signal trong 3 phiên gần nhất
        for i in range(1, 4):
            if macd_line[-(i+1)] <= signal[-(i+1)] and macd_line[-i] > signal[-i]:
                if macd_line[-1] > 0:
                    return "golden_cross_above_zero"
                return "golden_cross_below_zero"

        if cur_hist > 0 and cur_hist > prev_hist:
            return "histogram_rising"
        if cur_hist < 0 and cur_hist < prev_hist:
            return "bearish_divergence"
        return "neutral"

    @staticmethod
    def _classify_ma_alignment(price, ma5, ma10, ma20, ma60) -> str:
        """Phân loại trạng thái sắp xếp MA."""
        if any(np.isnan(x) for x in [ma5, ma10, ma20, ma60]):
            if not np.isnan(ma5) and not np.isnan(ma10) and not np.isnan(ma20):
                if ma5 > ma10 > ma20:
                    return "basic"
            return "unknown"
        if ma5 > ma10 > ma20 > ma60:
            return "perfect"
        if ma5 > ma10 > ma20:
            return "basic"
        if ma5 > ma10:
            return "weak"
        if price > ma20 and ma5 < ma20:
            return "reversal"
        return "bearish"

    @staticmethod
    def _count_trend_days(closes: np.ndarray) -> int:
        """Đếm số phiên liên tiếp giá tăng từ cuối mảng."""
        count = 0
        for i in range(len(closes) - 1, 0, -1):
            if closes[i] > closes[i - 1]:
                count += 1
            else:
                break
        return count

    @staticmethod
    def _detect_candle_pattern(
        open_p: float, high: float, low: float, close: float, prev_close: float
    ) -> str:
        """Nhận dạng nến K cơ bản."""
        body = abs(close - open_p)
        total_range = high - low if high > low else 0.001
        upper_shadow = high - max(close, open_p)
        lower_shadow = min(close, open_p) - low

        if body / total_range >= 0.7 and close > open_p:
            return "bullish_marubozu"
        if body / total_range >= 0.5 and close > open_p:
            return "strong_bullish"
        if body / total_range <= 0.1:
            return "doji_reversal"
        if lower_shadow >= 2 * body and close >= open_p:
            return "hammer"
        if upper_shadow >= 2 * body and close <= open_p:
            return "shooting_star"
        return "neutral"

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
        """Trả về tổng số cổ phiếu đã quét trong lần gọi generate gần nhất."""
        return getattr(self, "_total_scanned", 0)
