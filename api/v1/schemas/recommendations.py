# -*- coding: utf-8 -*-
"""
===================================
Khuyến nghị cổ phiếu — Schemas
===================================

Định nghĩa Pydantic models cho:
- DailyRecommendationsRequest  : Tham số truy vấn danh sách khuyến nghị ngày
- StockRecommendation          : Thông tin khuyến nghị 1 mã cổ phiếu
- MarketContext                : Bối cảnh thị trường hôm nay
- DailyRecommendationsResponse : Response tổng hợp khuyến nghị ngày
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Điểm chi tiết theo từng nhóm tiêu chí
# ─────────────────────────────────────────────

class ScoreBreakdown(BaseModel):
    """Điểm chi tiết theo 5 nhóm tiêu chí của bảng điểm 100 điểm."""

    trend: int = Field(
        0, ge=0, le=25,
        description="Nhóm A — Xu hướng (0–25đ): MA alignment, MA slope"
    )
    volume: int = Field(
        0, ge=0, le=25,
        description="Nhóm B — Khối lượng (0–25đ): volume ratio, breakout/pullback/bottom patterns"
    )
    momentum: int = Field(
        0, ge=0, le=20,
        description="Nhóm C — Momentum (0–20đ): MACD, RSI, candle pattern"
    )
    sector: int = Field(
        0, ge=0, le=15,
        description="Nhóm D — Ngành & Thị trường (0–15đ): sector ranking, relative strength"
    )
    risk: int = Field(
        0, ge=0, le=15,
        description="Nhóm E — Rủi ro & Điểm vào (0–15đ): news, R/R ratio, entry quality"
    )
    total: int = Field(
        0, ge=0, le=100,
        description="Tổng điểm (0–100)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "trend": 22,
                "volume": 20,
                "momentum": 15,
                "sector": 12,
                "risk": 12,
                "total": 81,
            }
        }


# ─────────────────────────────────────────────
# Khuyến nghị từng mã cổ phiếu
# ─────────────────────────────────────────────

class StockRecommendation(BaseModel):
    """Khuyến nghị chi tiết cho 1 mã cổ phiếu."""

    # Định danh
    stock_code: str = Field(..., description="Mã cổ phiếu (ví dụ: VN:VIC, VN:VCB)")
    stock_name: Optional[str] = Field(None, description="Tên công ty")
    sector: Optional[str] = Field(None, description="Ngành của cổ phiếu")
    sector_rank: Optional[int] = Field(None, description="Thứ hạng ngành hôm nay (1 = tăng mạnh nhất)")

    # Phân loại khuyến nghị
    rating: Literal["BUY", "WATCH", "SKIP", "VETO"] = Field(
        ...,
        description="Phân loại: BUY (≥75đ) | WATCH (60–74đ) | SKIP (<60đ) | VETO (tin xấu trọng yếu)"
    )

    # Điểm số
    score: int = Field(..., ge=0, le=100, description="Điểm tổng hợp (0–100)")
    score_breakdown: Optional[ScoreBreakdown] = Field(None, description="Điểm chi tiết theo từng nhóm")

    # Tín hiệu kích hoạt
    trigger_signal: str = Field(
        ...,
        description="Tín hiệu kích hoạt từ vn_market_scan (ví dụ: volume_breakout, shrink_pullback)"
    )
    signal_strength: Literal["STRONG", "MEDIUM", "WEAK"] = Field(
        "MEDIUM",
        description="Mức độ tin cậy tín hiệu: STRONG / MEDIUM / WEAK"
    )

    # Dữ liệu giá hiện tại
    current_price: Optional[float] = Field(None, description="Giá tham chiếu hiện tại (VNĐ)")
    change_pct: Optional[float] = Field(None, description="Biến động giá hôm nay (%)")
    volume_ratio: Optional[float] = Field(None, description="Tỷ lệ khối lượng so với TB5 ngày")

    # Điểm giao dịch
    entry_low: Optional[float] = Field(None, description="Vùng mua — cận dưới (VNĐ)")
    entry_high: Optional[float] = Field(None, description="Vùng mua — cận trên (VNĐ)")
    stop_loss: Optional[float] = Field(None, description="Giá dừng lỗ (VNĐ)")
    target_1: Optional[float] = Field(None, description="Mục tiêu 1 — ngắn hạn (VNĐ)")
    target_2: Optional[float] = Field(None, description="Mục tiêu 2 — trung hạn (VNĐ)")
    risk_reward: Optional[float] = Field(None, description="Tỷ lệ R/R (reward/risk)")

    # Phân tích ngắn gọn
    buy_reason: Optional[str] = Field(None, description="Lý do khuyến nghị (tín hiệu kỹ thuật cụ thể)")
    risk_warning: Optional[str] = Field(None, description="Cảnh báo rủi ro nếu có")

    class Config:
        json_schema_extra = {
            "example": {
                "stock_code": "VN:VIC",
                "stock_name": "Vingroup",
                "sector": "Bất động sản",
                "sector_rank": 2,
                "rating": "BUY",
                "score": 81,
                "score_breakdown": {
                    "trend": 22,
                    "volume": 20,
                    "momentum": 15,
                    "sector": 12,
                    "risk": 12,
                    "total": 81,
                },
                "trigger_signal": "volume_breakout",
                "signal_strength": "STRONG",
                "current_price": 52300.0,
                "change_pct": 2.8,
                "volume_ratio": 2.4,
                "entry_low": 51000.0,
                "entry_high": 53000.0,
                "stop_loss": 48500.0,
                "target_1": 58000.0,
                "target_2": 63000.0,
                "risk_reward": 2.8,
                "buy_reason": "Phá vỡ kháng cự 52,000 kèm khối lượng gấp 2.4x TB5 ngày; ngành BĐS top 2 hôm nay; MA5>MA10>MA20 sắp xếp tăng.",
                "risk_warning": "Độ lệch MA5 đã 4.2%, ưu tiên mua gần vùng pullback MA5.",
            }
        }


# ─────────────────────────────────────────────
# Bối cảnh thị trường
# ─────────────────────────────────────────────

class SectorSummary(BaseModel):
    """Tóm tắt ngành."""
    name: str = Field(..., description="Tên ngành")
    change_pct: Optional[float] = Field(None, description="Biến động trung bình của ngành (%)")
    rank: int = Field(..., description="Thứ hạng ngành hôm nay (1 = tốt nhất)")


class MarketContext(BaseModel):
    """Bối cảnh thị trường tổng thể trong ngày."""

    market_status: Literal["BULL", "NEUTRAL", "BEAR", "SECTOR_HOT"] = Field(
        ...,
        description="Trạng thái thị trường: BULL / NEUTRAL / BEAR / SECTOR_HOT"
    )
    vn_index_change_pct: Optional[float] = Field(
        None,
        description="Biến động VN-Index hôm nay (%)"
    )
    market_breadth_pct: Optional[float] = Field(
        None,
        description="Độ rộng thị trường: % mã tăng trong tổng số mã giao dịch"
    )
    total_liquidity_bn: Optional[float] = Field(
        None,
        description="Tổng thanh khoản toàn thị trường (tỷ VNĐ)"
    )
    top_sectors: List[SectorSummary] = Field(
        default_factory=list,
        description="Top 3 ngành tăng mạnh nhất hôm nay"
    )
    weak_sectors: List[SectorSummary] = Field(
        default_factory=list,
        description="Top 3 ngành yếu nhất hôm nay"
    )
    overall_strategy: Optional[str] = Field(
        None,
        description="Chiến lược tổng thể khuyến nghị cho ngày hôm nay"
    )
    risk_level: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        "MEDIUM",
        description="Mức rủi ro tổng thể thị trường: LOW / MEDIUM / HIGH"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "market_status": "BULL",
                "vn_index_change_pct": 0.8,
                "market_breadth_pct": 65.0,
                "total_liquidity_bn": 18500.0,
                "top_sectors": [
                    {"name": "Ngân hàng", "change_pct": 1.5, "rank": 1},
                    {"name": "Bất động sản", "change_pct": 1.2, "rank": 2},
                    {"name": "Chứng khoán", "change_pct": 0.9, "rank": 3},
                ],
                "weak_sectors": [
                    {"name": "Dầu khí", "change_pct": -0.8, "rank": 25},
                ],
                "overall_strategy": "Thị trường BULL, tập trung vào cổ phiếu breakout và hồi về đường MA trong các ngành dẫn đầu.",
                "risk_level": "LOW",
            }
        }


# ─────────────────────────────────────────────
# Request / Response tổng hợp
# ─────────────────────────────────────────────

class DailyRecommendationsRequest(BaseModel):
    """Tham số lọc cho danh sách khuyến nghị ngày."""

    date: Optional[str] = Field(
        None,
        description="Ngày phân tích (YYYY-MM-DD). Mặc định: hôm nay"
    )
    min_score: int = Field(
        60, ge=0, le=100,
        description="Điểm tối thiểu để xuất hiện trong danh sách (mặc định: 60)"
    )
    rating_filter: Optional[List[Literal["BUY", "WATCH"]]] = Field(
        None,
        description="Chỉ lấy các mã có rating nhất định. Mặc định: tất cả (BUY + WATCH)"
    )
    sector_filter: Optional[List[str]] = Field(
        None,
        description="Lọc theo ngành cụ thể (ví dụ: ['Ngân hàng', 'Bất động sản'])"
    )
    signal_filter: Optional[List[str]] = Field(
        None,
        description="Lọc theo tín hiệu (ví dụ: ['volume_breakout', 'shrink_pullback'])"
    )
    limit: int = Field(
        10, ge=1, le=30,
        description="Số lượng khuyến nghị tối đa trả về (mặc định: 10)"
    )
    include_market_context: bool = Field(
        True,
        description="Có trả kèm bối cảnh thị trường hôm nay không"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2026-04-12",
                "min_score": 70,
                "rating_filter": ["BUY"],
                "limit": 10,
                "include_market_context": True,
            }
        }


class DailyRecommendationsResponse(BaseModel):
    """Response tổng hợp khuyến nghị cổ phiếu trong ngày."""

    date: str = Field(..., description="Ngày phân tích (YYYY-MM-DD)")
    generated_at: str = Field(..., description="Thời điểm tạo khuyến nghị (ISO 8601)")
    market_context: Optional[MarketContext] = Field(
        None,
        description="Bối cảnh thị trường hôm nay"
    )
    buy_list: List[StockRecommendation] = Field(
        default_factory=list,
        description="Danh sách MUA (điểm ≥75), sắp xếp theo điểm giảm dần"
    )
    watch_list: List[StockRecommendation] = Field(
        default_factory=list,
        description="Danh sách THEO DÕI (điểm 60–74), sắp xếp theo điểm giảm dần"
    )
    total_scanned: int = Field(
        0,
        description="Tổng số cổ phiếu được quét hôm nay"
    )
    total_candidates: int = Field(
        0,
        description="Số ứng viên vượt qua bộ lọc Tầng 2 (vn_market_scan)"
    )
    disclaimer: str = Field(
        "Khuyến nghị dựa trên phân tích kỹ thuật. Không phải tư vấn đầu tư chuyên nghiệp. "
        "Nhà đầu tư tự chịu trách nhiệm về quyết định của mình.",
        description="Tuyên bố miễn trách nhiệm"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2026-04-12",
                "generated_at": "2026-04-12T09:15:00",
                "market_context": {
                    "market_status": "BULL",
                    "vn_index_change_pct": 0.8,
                    "risk_level": "LOW",
                },
                "buy_list": [],
                "watch_list": [],
                "total_scanned": 1700,
                "total_candidates": 23,
                "disclaimer": "Khuyến nghị dựa trên phân tích kỹ thuật...",
            }
        }
