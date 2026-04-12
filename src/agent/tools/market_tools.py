# -*- coding: utf-8 -*-
"""
Market tools — wraps DataFetcherManager market-level methods as agent tools.

Tools:
- get_market_indices: major market index data
- get_sector_rankings: sector performance rankings
"""

import logging

from src.agent.tools.registry import ToolParameter, ToolDefinition

logger = logging.getLogger(__name__)


def _get_fetcher_manager():
    """Lazy import to avoid circular deps."""
    from data_provider import DataFetcherManager
    return DataFetcherManager()


# ============================================================
# get_market_indices
# ============================================================

def _handle_get_market_indices(region: str = "cn") -> dict:
    """Get major market indices."""
    manager = _get_fetcher_manager()
    indices = manager.get_main_indices(region=region)

    if not indices:
        return {"error": f"No market index data available for region '{region}'"}

    return {
        "region": region,
        "indices_count": len(indices),
        "indices": indices,
    }


get_market_indices_tool = ToolDefinition(
    name="get_market_indices",
    description="Get major market indices (e.g., Shanghai Composite, Shenzhen Component, "
                "CSI 300 for China; S&P 500, Nasdaq, Dow for US). Provides market overview.",
    parameters=[
        ToolParameter(
            name="region",
            type="string",
            description="Market region: 'cn' for China A-shares, 'us' for US stocks, 'vn' for Vietnam stocks (default: 'cn')",
            required=False,
            default="cn",
            enum=["cn", "us", "vn"],
        ),
    ],
    handler=_handle_get_market_indices,
    category="market",
)


# ============================================================
# get_sector_rankings
# ============================================================

def _handle_get_sector_rankings(top_n: int = 10) -> dict:
    """Get sector performance rankings."""
    manager = _get_fetcher_manager()
    result = manager.get_sector_rankings(n=top_n)

    if result is None:
        return {"error": "No sector ranking data available"}

    # get_sector_rankings returns Tuple[List[Dict], List[Dict]]
    # (top_sectors, bottom_sectors)
    if isinstance(result, tuple) and len(result) == 2:
        top_sectors, bottom_sectors = result
        return {
            "top_sectors": top_sectors,
            "bottom_sectors": bottom_sectors,
        }
    elif isinstance(result, list):
        return {"sectors": result}
    else:
        return {"data": str(result)}


get_sector_rankings_tool = ToolDefinition(
    name="get_sector_rankings",
    description="Get sector/industry performance rankings. Returns top N and bottom N "
                "sectors by daily change percentage. Useful for sector rotation analysis.",
    parameters=[
        ToolParameter(
            name="top_n",
            type="integer",
            description="Number of top/bottom sectors to return (default: 10)",
            required=False,
            default=10,
        ),
    ],
    handler=_handle_get_sector_rankings,
    category="market",
)


# ============================================================
# get_vn_macro_data
# ============================================================

_VN_MACRO_TICKERS = {
    "oil_wti":   ("CL=F",       "WTI Crude Oil (USD/barrel)"),
    "oil_brent": ("BZ=F",       "Brent Crude Oil (USD/barrel)"),
    "usd_vnd":   ("USDVND=X",   "USD/VND exchange rate"),
    "gold":      ("GC=F",       "Gold spot (USD/oz)"),
    "dxy":       ("DX-Y.NYB",   "US Dollar Index (DXY)"),
    "vix":       ("^VIX",       "VIX Fear & Greed Index"),
    "sp500":     ("^GSPC",      "S&P 500"),
}


def _handle_get_vn_macro_data() -> dict:
    """Fetch macro indicators relevant for Vietnam stock analysis."""
    try:
        import yfinance as yf  # type: ignore
    except ImportError:
        return {"error": "yfinance not installed. Run: pip install yfinance"}

    import warnings
    warnings.filterwarnings("ignore")

    result = {}
    errors = []

    for key, (ticker, label) in _VN_MACRO_TICKERS.items():
        try:
            hist = yf.Ticker(ticker).history(period="5d")
            if hist.empty:
                errors.append(f"{key}: no data")
                continue
            last_close = float(hist["Close"].iloc[-1])
            prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else last_close
            change_pct = (last_close - prev_close) / prev_close * 100 if prev_close else 0.0
            last_date = str(hist.index[-1])[:10]
            result[key] = {
                "label": label,
                "value": round(last_close, 2),
                "change_pct": round(change_pct, 2),
                "date": last_date,
            }
        except Exception as exc:
            errors.append(f"{key}: {exc}")

    if not result:
        return {"error": "Failed to fetch all macro data", "details": errors}

    # Add interpretations for LLM context
    interpretations = []
    if "oil_wti" in result:
        oil = result["oil_wti"]
        if oil["change_pct"] > 2:
            interpretations.append(f"Giá dầu WTI tăng mạnh {oil['change_pct']:+.1f}% → chi phí vận chuyển/sản xuất tăng, áp lực lạm phát, bất lợi cho cổ phiếu phụ thuộc năng lượng nhập khẩu")
        elif oil["change_pct"] < -2:
            interpretations.append(f"Giá dầu WTI giảm {oil['change_pct']:+.1f}% → giảm chi phí đầu vào, hỗ trợ ngành vận tải, phân bón, nhựa")

    if "usd_vnd" in result:
        fx = result["usd_vnd"]
        if fx["change_pct"] > 0.3:
            interpretations.append(f"USD/VND tăng {fx['change_pct']:+.2f}% (VNĐ mất giá) → bất lợi cho doanh nghiệp nhập khẩu nguyên liệu USD, lợi cho xuất khẩu và BSR/dầu khí")
        elif fx["change_pct"] < -0.3:
            interpretations.append(f"USD/VND giảm {fx['change_pct']:+.2f}% (VNĐ tăng giá) → hỗ trợ nhập khẩu, giảm chi phí vay ngoại tệ")

    if "vix" in result:
        vix_val = result["vix"]["value"]
        if vix_val > 30:
            interpretations.append(f"VIX={vix_val:.0f} (sợ hãi cao) → thị trường toàn cầu biến động mạnh, rủi ro cao, thường dẫn đến bán tháo ở các thị trường mới nổi như VN")
        elif vix_val < 15:
            interpretations.append(f"VIX={vix_val:.0f} (tham lam) → thị trường toàn cầu ổn định, môi trường thuận lợi cho rủi ro")

    if "dxy" in result:
        dxy = result["dxy"]
        if dxy["change_pct"] > 0.5:
            interpretations.append(f"DXY tăng {dxy['change_pct']:+.2f}% → USD mạnh lên, thường gây áp lực lên các thị trường mới nổi và hàng hóa")

    result["market_context"] = interpretations
    if errors:
        result["_warnings"] = errors

    return result


get_vn_macro_data_tool = ToolDefinition(
    name="get_vn_macro_data",
    description=(
        "Get macro indicators critical for Vietnam stock analysis: "
        "WTI & Brent oil prices (key for BSR, PVD, PVS, DCM, DPM), "
        "USD/VND exchange rate (impacts import/export companies), "
        "Gold price, DXY Dollar Index, VIX fear index, S&P 500. "
        "Use this tool when analyzing any VN: prefixed stock to understand global macro context."
    ),
    parameters=[],
    handler=_handle_get_vn_macro_data,
    category="market",
)


ALL_MARKET_TOOLS = [
    get_market_indices_tool,
    get_sector_rankings_tool,
    get_vn_macro_data_tool,
]
