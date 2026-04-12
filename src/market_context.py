# -*- coding: utf-8 -*-
"""
Market context detection for LLM prompts.

Detects the market (A-shares, HK, US, VN) from a stock code and returns
market-specific role descriptions so prompts are not hardcoded to a
single market.

Fixes: https://github.com/ZhuLinsen/daily_stock_analysis/issues/644
"""

import re
from typing import Optional


def detect_market(stock_code: Optional[str]) -> str:
    """Detect market from stock code.

    Returns:
        One of 'cn', 'hk', 'us', 'vn', or 'cn' as fallback.
    """
    if not stock_code:
        return "cn"

    code = stock_code.strip().upper()

    # Vietnamese stocks: VN: prefix (e.g. VN:VIC, VN:FPT)
    if code.startswith("VN:"):
        return "vn"

    # HK stocks: HK00700, 00700.HK, or 5-digit pure numbers
    if code.startswith("HK") or code.endswith(".HK"):
        return "hk"
    lower = code.lower()
    if lower.endswith(".hk"):
        return "hk"
    # 5-digit pure numbers are HK (A-shares are 6-digit)
    if code.isdigit() and len(code) == 5:
        return "hk"

    # US stocks: 1-5 uppercase letters (AAPL, TSLA, GOOGL)
    # Also handles suffixed forms like BRK.B
    if re.match(r'^[A-Z]{1,5}(\.[A-Z]{1,2})?$', code):
        return "us"

    # Default: A-shares (6-digit numbers like 600519, 000001)
    return "cn"


# -- Market-specific role descriptions --

_MARKET_ROLES = {
    "cn": {
        "zh": "co phieu A (Trung Quoc)",
        "en": "China A-shares",
    },
    "hk": {
        "zh": "co phieu Hong Kong",
        "en": "Hong Kong stock",
    },
    "us": {
        "zh": "co phieu My",
        "en": "US stock",
    },
    "vn": {
        "zh": "co phieu Viet Nam",
        "en": "Vietnam stock",
    },
}

_MARKET_GUIDELINES = {
    "cn": {
        "zh": (
            "- Doi tuong phan tich lan nay la **co phieu A** (niem yet tren san giao dich Thuong Hai/Tham Quyen, Trung Quoc).\n"
            "- Luu y co che bien do dao dong dac thu cua co phieu A (+-10%/+-20%/+-30%), quy dinh T+1 va cac yeu to chinh sach lien quan."
        ),
        "en": (
            "- This analysis covers a **China A-share** (listed on Shanghai/Shenzhen exchanges).\n"
            "- Consider A-share-specific rules: daily price limits (+-10%/+-20%/+-30%), T+1 settlement, and PRC policy factors."
        ),
    },
    "hk": {
        "zh": (
            "- Doi tuong phan tich lan nay la **co phieu Hong Kong** (niem yet tren San giao dich Hong Kong).\n"
            "- Co phieu Hong Kong khong co bien do dao dong, ho tro giao dich T+0, can chu y ty gia HKD, dong von Southbound/Northbound va cac quy tac dac thu cua HKEX."
        ),
        "en": (
            "- This analysis covers a **Hong Kong stock** (listed on HKEX).\n"
            "- HK stocks have no daily price limits, allow T+0 trading. Consider HKD FX, Southbound/Northbound flows, and HKEX-specific rules."
        ),
    },
    "us": {
        "zh": (
            "- Doi tuong phan tich lan nay la **co phieu My** (niem yet tren NYSE/NASDAQ).\n"
            "- Co phieu My khong co bien do dao dong (nhung co co che ngat mach), ho tro giao dich T+0 va giao dich truoc/sau gio, can chu y ty gia USD, chinh sach Fed va quy dinh SEC."
        ),
        "en": (
            "- This analysis covers a **US stock** (listed on NYSE/NASDAQ).\n"
            "- US stocks have no daily price limits (but have circuit breakers), allow T+0 and pre/after-market trading. Consider USD FX, Fed policy, and SEC regulations."
        ),
    },
    "vn": {
        "zh": (
            "- Doi tuong phan tich lan nay la **co phieu Viet Nam** (niem yet tren HOSE/HNX/UPCOM).\n"
            "- Co phieu Viet Nam co bien do dao dong +-7% (HOSE/HNX) va +-15% (UPCOM), giao dich T+2, chu y chinh sach NHNN, ty gia USD/VND va dong von nuoc ngoai (room nuoc ngoai)."
        ),
        "en": (
            "- This analysis covers a **Vietnam stock** (listed on HOSE/HNX/UPCOM).\n"
            "- Vietnam stocks have daily price limits (+-7% on HOSE/HNX, +-15% on UPCOM), T+2 settlement. Consider SBV policy, USD/VND FX, and foreign ownership limits (room)."
        ),
    },
}


def get_market_role(stock_code: Optional[str], lang: str = "zh") -> str:
    """Return market-specific role description for LLM prompt.

    Args:
        stock_code: The stock code being analyzed.
        lang: 'zh' or 'en'.

    Returns:
        Role string like 'A share investment analysis' or 'Vietnam stock investment analysis'.
    """
    market = detect_market(stock_code)
    lang_key = "en" if lang == "en" else "zh"
    return _MARKET_ROLES.get(market, _MARKET_ROLES["cn"])[lang_key]


def get_market_guidelines(stock_code: Optional[str], lang: str = "zh") -> str:
    """Return market-specific analysis guidelines for LLM prompt.

    Args:
        stock_code: The stock code being analyzed.
        lang: 'zh' or 'en'.

    Returns:
        Multi-line string with market-specific guidelines.
    """
    market = detect_market(stock_code)
    lang_key = "en" if lang == "en" else "zh"
    return _MARKET_GUIDELINES.get(market, _MARKET_GUIDELINES["cn"])[lang_key]
