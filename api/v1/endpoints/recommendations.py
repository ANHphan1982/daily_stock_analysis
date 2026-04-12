# -*- coding: utf-8 -*-
"""
===================================
Khuyến nghị cổ phiếu hàng ngày
===================================

Endpoint:
  POST /api/v1/recommendations/daily
    → Chạy vn_market_scan + vn_recommendation_engine, trả về danh sách
      MUA / THEO DÕI kèm bối cảnh thị trường và điểm chi tiết.

  GET  /api/v1/recommendations/daily
    → Lấy kết quả khuyến nghị ngày hiện tại (không chạy lại AI,
      chỉ đọc cache/DB nếu đã có trong ngày).

  GET  /api/v1/recommendations/signals
    → Danh sách tên tín hiệu và mô tả ngắn (dùng cho UI filter).
"""

import logging
from datetime import date, datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse

from api.deps import get_config_dep
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.recommendations import (
    DailyRecommendationsRequest,
    DailyRecommendationsResponse,
    StockRecommendation,
    MarketContext,
    ScoreBreakdown,
    SectorSummary,
)
from src.config import Config

logger = logging.getLogger(__name__)

router = APIRouter()

# ─────────────────────────────────────────────
# Metadata tín hiệu (dùng cho /signals endpoint)
# ─────────────────────────────────────────────

SIGNAL_METADATA = [
    {
        "id": "volume_breakout",
        "name": "Phá vỡ tăng khối lượng",
        "description": "Giá vượt kháng cự kèm KLGD > 2× TB5 ngày. Tín hiệu xu hướng tăng mạnh.",
        "base_score": 70,
        "category": "trend",
    },
    {
        "id": "shrink_pullback",
        "name": "Hồi về giảm khối lượng",
        "description": "Đang xu hướng tăng, hồi về MA5/MA10 với KLGD < 0.7× TB. Điểm vào tối ưu.",
        "base_score": 65,
        "category": "trend",
    },
    {
        "id": "bottom_volume",
        "name": "Đáy tăng khối lượng",
        "description": "Sau giảm > 15%, KLGD bùng nổ > 3× TB. Tín hiệu đảo chiều tiềm năng.",
        "base_score": 60,
        "category": "reversal",
    },
    {
        "id": "ma_golden_cross",
        "name": "MA Golden Cross",
        "description": "MA5 cắt lên MA10 trong 3 phiên gần nhất kèm xác nhận khối lượng.",
        "base_score": 68,
        "category": "trend",
    },
    {
        "id": "multi_ma_alignment",
        "name": "Sắp xếp đa tầng MA",
        "description": "MA5 > MA10 > MA20 > MA60, giá trong vùng 2–8% trên MA5.",
        "base_score": 62,
        "category": "trend",
    },
    {
        "id": "dragon_head",
        "name": "Cổ phiếu dẫn đầu ngành",
        "description": "Ngành top 3, mã tăng vượt ngành > 2%, luân chuyển > 3%.",
        "base_score": 72,
        "category": "momentum",
    },
    {
        "id": "emotion_bottom",
        "name": "Đáy cảm xúc",
        "description": "Luân chuyển ở mức thấp nhất 52 tuần, KLGD < 50% TB60. Tích lũy tiềm năng.",
        "base_score": 58,
        "category": "reversal",
    },
]


# ─────────────────────────────────────────────
# POST /daily — Chạy phân tích và sinh khuyến nghị
# ─────────────────────────────────────────────

@router.post(
    "/daily",
    response_model=DailyRecommendationsResponse,
    responses={
        200: {"description": "Danh sách khuyến nghị hôm nay", "model": DailyRecommendationsResponse},
        400: {"description": "Tham số không hợp lệ", "model": ErrorResponse},
        503: {"description": "Dịch vụ AI không khả dụng", "model": ErrorResponse},
    },
    summary="Sinh danh sách khuyến nghị cổ phiếu hôm nay",
    description=(
        "Chạy chiến lược vn_market_scan để quét toàn thị trường, "
        "sau đó áp dụng vn_recommendation_engine để chấm điểm 100 điểm, "
        "trả về danh sách MUA / THEO DÕI kèm bối cảnh thị trường và điểm chi tiết."
    ),
)
def generate_daily_recommendations(
    request: DailyRecommendationsRequest,
    config: Config = Depends(get_config_dep),
) -> DailyRecommendationsResponse:
    """
    Sinh danh sách khuyến nghị cổ phiếu hàng ngày.

    Luồng xử lý:
    1. Xác định ngày phân tích (mặc định hôm nay)
    2. Lấy bối cảnh thị trường (sector rankings, VN-Index trend)
    3. Chạy vn_market_scan qua AnalysisService để quét ứng viên
    4. Chấm điểm từng ứng viên qua vn_recommendation_engine
    5. Phân loại BUY / WATCH, tính điểm vào / dừng lỗ / mục tiêu
    6. Trả về response có cấu trúc

    Args:
        request: Tham số lọc
        config: Cấu hình hệ thống

    Returns:
        DailyRecommendationsResponse: Danh sách khuyến nghị đầy đủ

    Raises:
        HTTPException 400: Tham số không hợp lệ
        HTTPException 503: Dịch vụ AI không khả dụng
    """
    analysis_date = request.date or date.today().isoformat()

    try:
        result = _run_recommendation_analysis(
            analysis_date=analysis_date,
            min_score=request.min_score,
            rating_filter=request.rating_filter,
            sector_filter=request.sector_filter,
            signal_filter=request.signal_filter,
            limit=request.limit,
            include_market_context=request.include_market_context,
            config=config,
        )
        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "validation_error", "message": str(exc)},
        ) from exc
    except RuntimeError as exc:
        logger.error("Recommendation analysis runtime error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail={
                "error": "service_unavailable",
                "message": f"Không thể chạy phân tích khuyến nghị: {exc}",
            },
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error in recommendations: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": str(exc)},
        ) from exc


# ─────────────────────────────────────────────
# GET /daily — Lấy khuyến nghị ngày hiện tại
# ─────────────────────────────────────────────

@router.get(
    "/daily",
    response_model=DailyRecommendationsResponse,
    responses={
        200: {"description": "Danh sách khuyến nghị hôm nay"},
        404: {"description": "Chưa có khuyến nghị nào được tạo hôm nay"},
    },
    summary="Lấy danh sách khuyến nghị hôm nay",
    description=(
        "Đọc kết quả khuyến nghị đã được tạo trong ngày từ cache/DB. "
        "Không chạy lại AI. Nếu chưa có, trả 404 — hãy gọi POST /daily trước."
    ),
)
def get_daily_recommendations(
    date_param: Optional[str] = Query(
        None,
        alias="date",
        description="Ngày lấy khuyến nghị (YYYY-MM-DD). Mặc định: hôm nay",
    ),
    min_score: int = Query(60, ge=0, le=100, description="Điểm tối thiểu"),
    rating: Optional[str] = Query(
        None,
        description="Lọc rating: BUY, WATCH (cách nhau bằng dấu phẩy)",
    ),
    limit: int = Query(10, ge=1, le=30, description="Số lượng tối đa"),
    config: Config = Depends(get_config_dep),
) -> DailyRecommendationsResponse:
    """
    Lấy danh sách khuyến nghị đã tạo trong ngày.

    Args:
        date_param: Ngày cần lấy (mặc định hôm nay)
        min_score: Lọc điểm tối thiểu
        rating: Lọc rating (BUY/WATCH)
        limit: Số lượng tối đa
        config: Cấu hình hệ thống

    Returns:
        DailyRecommendationsResponse: Danh sách khuyến nghị

    Raises:
        HTTPException 404: Chưa có dữ liệu khuyến nghị trong ngày
    """
    analysis_date = date_param or date.today().isoformat()
    rating_filter = [r.strip().upper() for r in rating.split(",")] if rating else None

    try:
        cached = _load_cached_recommendations(analysis_date)
        if cached is None:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "not_found",
                    "message": (
                        f"Chưa có khuyến nghị nào được tạo cho ngày {analysis_date}. "
                        "Hãy gọi POST /api/v1/recommendations/daily để tạo mới."
                    ),
                },
            )

        # Áp dụng filter phía server
        buy_list = [r for r in cached.buy_list if r.score >= min_score]
        watch_list = [r for r in cached.watch_list if r.score >= min_score]

        if rating_filter:
            buy_list = buy_list if "BUY" in rating_filter else []
            watch_list = watch_list if "WATCH" in rating_filter else []

        buy_list = buy_list[:limit]
        watch_list = watch_list[: max(0, limit - len(buy_list))]

        return DailyRecommendationsResponse(
            date=cached.date,
            generated_at=cached.generated_at,
            market_context=cached.market_context,
            buy_list=buy_list,
            watch_list=watch_list,
            total_scanned=cached.total_scanned,
            total_candidates=cached.total_candidates,
            disclaimer=cached.disclaimer,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error loading cached recommendations: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": str(exc)},
        ) from exc


# ─────────────────────────────────────────────
# GET /signals — Danh sách tín hiệu hỗ trợ
# ─────────────────────────────────────────────

@router.get(
    "/signals",
    summary="Danh sách tín hiệu được hỗ trợ",
    description="Trả về metadata của 7 tín hiệu kỹ thuật dùng trong vn_market_scan.",
)
def list_signals() -> dict:
    """Trả về danh sách tín hiệu kỹ thuật và mô tả."""
    return {"signals": SIGNAL_METADATA}


# ─────────────────────────────────────────────
# Hàm nội bộ
# ─────────────────────────────────────────────

def _run_recommendation_analysis(
    analysis_date: str,
    min_score: int,
    rating_filter: Optional[List[str]],
    sector_filter: Optional[List[str]],
    signal_filter: Optional[List[str]],
    limit: int,
    include_market_context: bool,
    config: Config,
) -> DailyRecommendationsResponse:
    """
    Điều phối toàn bộ luồng phân tích khuyến nghị.

    Thứ tự:
    1. Lấy dữ liệu ngành và bối cảnh thị trường
    2. Chạy AnalysisService với strategy vn_market_scan để quét ứng viên
    3. Chạy AnalysisService với strategy vn_recommendation_engine để chấm điểm
    4. Tổng hợp, lọc, sắp xếp và trả về response
    """
    from src.services.recommendation_service import RecommendationService

    service = RecommendationService(config=config)
    return service.generate_daily_recommendations(
        analysis_date=analysis_date,
        min_score=min_score,
        rating_filter=rating_filter,
        sector_filter=sector_filter,
        signal_filter=signal_filter,
        limit=limit,
        include_market_context=include_market_context,
    )


def _load_cached_recommendations(
    analysis_date: str,
) -> Optional[DailyRecommendationsResponse]:
    """
    Tải khuyến nghị đã được tạo trong ngày từ DB/cache.

    Returns:
        DailyRecommendationsResponse nếu có; None nếu chưa có.
    """
    try:
        from src.services.recommendation_service import RecommendationService

        service = RecommendationService()
        return service.load_cached(analysis_date)
    except Exception as exc:
        logger.debug("Cache load failed for %s: %s", analysis_date, exc)
        return None
