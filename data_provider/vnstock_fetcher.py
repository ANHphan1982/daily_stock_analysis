# -*- coding: utf-8 -*-
"""
===================================
VnstockFetcher - Du lieu chung khoan Viet Nam (Priority 1)
===================================

Nguon du lieu: vnstock >= 3.0.0 (VCI, TCBS, MSN)
Ap dung cho: Ma chung khoan Viet Nam voi tien to VN: (VN:VIC, VN:FPT, ...)

Cach dung:
    pip install vnstock>=3.0.0
    STOCK_LIST=VN:VIC,VN:HPG,VN:FPT
    VNSTOCK_SOURCE=VCI   # hoac TCBS, MSN
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd

from .base import BaseFetcher, DataFetchError, STANDARD_COLUMNS
from .realtime_types import UnifiedRealtimeQuote, RealtimeSource

logger = logging.getLogger(__name__)

# VN index codes for market review
VN_INDEX_CODES = [
    {"code": "VNINDEX", "name": "VN-Index"},
    {"code": "VN30", "name": "VN30"},
    {"code": "HNX", "name": "HNX-Index"},
    {"code": "UPCOM", "name": "UPCOM"},
]


def _strip_vn_prefix(stock_code: str) -> str:
    """Strip VN: prefix from stock code. VN:VIC -> VIC"""
    code = stock_code.strip().upper()
    if code.startswith("VN:"):
        return code[3:]
    return code


# Cache components theo (symbol, source) — tránh gọi API khởi tạo nhiều lần
# Key: (symbol, source) → StockComponents object
_COMPONENTS_CACHE: Dict[tuple, Any] = {}


def _get_stock_components(symbol: str, source: str):
    """
    Khoi tao StockComponents tu vnstock 3.x, co cache trong session.

    API chinh xac: Vnstock(symbol, source).stock(symbol, source)
    Cache noi bo de tranh goi API khoi tao nhieu lan cho cung mot ma,
    giam nguy co bi rate-limit khi quet nhieu ma lien tiep.
    """
    cache_key = (symbol.upper(), source.upper())
    if cache_key in _COMPONENTS_CACHE:
        return _COMPONENTS_CACHE[cache_key]

    try:
        from vnstock import Vnstock  # type: ignore
    except ImportError as exc:
        raise DataFetchError(
            "Chua cai dat thu vien vnstock. "
            "Chay: pip install vnstock>=3.0.0"
        ) from exc
    try:
        components = Vnstock(symbol=symbol, source=source).stock(
            symbol=symbol, source=source
        )
        _COMPONENTS_CACHE[cache_key] = components
        return components
    except Exception as exc:
        raise DataFetchError(
            f"vnstock khoi tao {symbol} (source={source}) that bai: {exc}"
        ) from exc


class VnstockFetcher(BaseFetcher):
    """
    VnstockFetcher - Du lieu chung khoan Viet Nam

    Su dung thu vien vnstock >= 3.0.0
    Ho tro nguon: VCI (mac dinh), TCBS, MSN

    Uu tien: 1 (cao) cho ma VN:xxx
    """

    name = "VnstockFetcher"
    priority = int(os.getenv("VNSTOCK_PRIORITY", "1"))

    def __init__(self):
        self._source = os.getenv("VNSTOCK_SOURCE", "VCI").upper()
        if self._source not in ("VCI", "TCBS", "MSN"):
            logger.warning(
                f"[VnstockFetcher] VNSTOCK_SOURCE={self._source!r} khong hop le, "
                "su dung VCI mac dinh"
            )
            self._source = "VCI"
        logger.debug(f"[VnstockFetcher] Khoi tao voi nguon: {self._source}")

    def _fetch_raw_data(
        self, stock_code: str, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """Lay du lieu lich su tu vnstock."""
        symbol = _strip_vn_prefix(stock_code)
        logger.debug(
            f"[VnstockFetcher] Lay du lieu {symbol} tu {start_date} den {end_date} "
            f"(nguon: {self._source})"
        )
        try:
            components = _get_stock_components(symbol, self._source)
            df = components.quote.history(
                start=start_date,
                end=end_date,
                interval="1D",
            )
            if df is None or df.empty:
                raise DataFetchError(
                    f"vnstock khong tra ve du lieu cho {symbol} "
                    f"({start_date} - {end_date})"
                )
            return df
        except DataFetchError:
            raise
        except Exception as exc:
            raise DataFetchError(
                f"vnstock lay du lieu {symbol} that bai: {exc}"
            ) from exc

    def _normalize_data(self, df: pd.DataFrame, stock_code: str) -> pd.DataFrame:
        """
        Chuan hoa du lieu vnstock thanh dinh dang chuan.

        vnstock tra ve: time, open, high, low, close, volume
        """
        df = df.copy()

        # Reset index neu date o trong index
        if df.index.name in ("time", "date", "Date"):
            df = df.reset_index()

        # Mapping cot (vnstock dung 'time' thay vi 'date')
        col_map: Dict[str, str] = {}
        col_lower = {c.lower(): c for c in df.columns}
        for std, candidates in [
            ("date", ["time", "date"]),
            ("open", ["open"]),
            ("high", ["high"]),
            ("low", ["low"]),
            ("close", ["close"]),
            ("volume", ["volume"]),
        ]:
            for cand in candidates:
                if cand in col_lower:
                    col_map[col_lower[cand]] = std
                    break

        df = df.rename(columns=col_map)

        # Tinh pct_chg neu chua co
        if "pct_chg" not in df.columns and "close" in df.columns:
            df["pct_chg"] = df["close"].pct_change() * 100
            df["pct_chg"] = df["pct_chg"].fillna(0).round(2)

        # Tinh amount neu chua co (vnstock khong co truong nay)
        if "amount" not in df.columns:
            if "volume" in df.columns and "close" in df.columns:
                df["amount"] = df["volume"] * df["close"]
            else:
                df["amount"] = 0

        # Dam bao cot date la string dang YYYY-MM-DD
        if "date" in df.columns:
            try:
                df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        df["code"] = _strip_vn_prefix(stock_code)

        keep_cols = ["code"] + STANDARD_COLUMNS
        existing = [c for c in keep_cols if c in df.columns]
        return df[existing]

    def get_realtime_quote(
        self, stock_code: str
    ) -> Optional[UnifiedRealtimeQuote]:
        """Lay gia thuc te tu vnstock price_board (VCI source)."""
        symbol = _strip_vn_prefix(stock_code)
        try:
            components = _get_stock_components(symbol, self._source)
            df = components.trading.price_board(symbols_list=[symbol])

            if df is None or df.empty:
                return None

            # price_board tra ve MultiIndex DataFrame — flat hoa cot
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = ["_".join(str(c) for c in col).strip("_") for col in df.columns]

            row = df.iloc[0]

            def _get(col: str, default: float = 0.0) -> float:
                """Lay gia tri cot chinh xac, tra ve default neu khong tim thay."""
                if col in row.index:
                    try:
                        v = float(row[col])
                        return v if not pd.isna(v) else default
                    except (TypeError, ValueError):
                        return default
                return default

            def _get_str(col: str, default: str = "") -> str:
                if col in row.index:
                    v = row[col]
                    if v and str(v) not in ("nan", "None", ""):
                        return str(v)
                return default

            # VCI price_board tra ve gia theo don vi VND day du (e.g. 25950)
            # quote.history tra ve don vi nghin VND (e.g. 25.95)
            # => chia 1000 de thong nhat don vi
            _PRICE_SCALE = 1000.0

            # Su dung ten cot chinh xac de tranh nham voi *_ato, *_atc
            price_raw = _get("match_match_price") or _get("match_avg_match_price")
            ref_raw   = _get("listing_ref_price")
            high_raw  = _get("match_highest")
            low_raw   = _get("match_lowest")
            open_raw  = _get("match_open_price") or ref_raw
            volume    = int(_get("match_accumulated_volume") or _get("match_match_vol") or 0)
            amount    = _get("match_accumulated_value")  # don vi trieu VND

            # Fallback: neu gia = 0 (ngoai gio giao dich), thu dung ATO/ATC
            if price_raw == 0.0:
                price_raw = _get("match_match_price_atc") or _get("match_match_price_ato")

            # Neu van = 0, khong scale (tranh chia sai)
            if price_raw == 0.0:
                logger.warning(f"[VnstockFetcher] {symbol}: khong lay duoc gia hien tai tu price_board")
                return None

            price     = round(price_raw / _PRICE_SCALE, 3)
            ref_price = round(ref_raw / _PRICE_SCALE, 3) if ref_raw else price
            high      = round(high_raw / _PRICE_SCALE, 3) if high_raw else price
            low       = round(low_raw / _PRICE_SCALE, 3) if low_raw else price
            open_p    = round(open_raw / _PRICE_SCALE, 3) if open_raw else price

            change     = round(price - ref_price, 3) if ref_price else 0.0
            change_pct = round(change / ref_price * 100, 2) if ref_price else 0.0

            # Ten cong ty
            name = _get_str("listing_organ_name") or symbol

            # Tinh ty le luân chuyển neu co du lieu so co phieu niem yet
            total_listed = _get("listing_total_listed_qty")
            if total_listed and total_listed > 0 and volume > 0:
                turnover_rate = round(volume / total_listed * 100, 4)
            else:
                turnover_rate = 0.0

            return UnifiedRealtimeQuote(
                code=symbol,
                name=name,
                price=price,
                change_amount=change,
                change_pct=change_pct,
                volume=volume,
                amount=amount,
                high=high,
                low=low,
                open_price=open_p,
                pre_close=ref_price,
                turnover_rate=turnover_rate,
                pe_ratio=0.0,
                pb_ratio=0.0,
                source=RealtimeSource.VNSTOCK,
            )
        except Exception as exc:
            logger.warning(f"[VnstockFetcher] Lay gia thuc te {symbol} that bai: {exc}")
            return None

    def get_main_indices(self, region: str = "cn") -> Optional[List[Dict[str, Any]]]:
        """Lay chi so chinh TTCK Viet Nam (VNINDEX, VN30, HNX, UPCOM)."""
        if region != "vn":
            return None

        try:
            from vnstock import Vnstock  # type: ignore
        except ImportError:
            logger.warning("[VnstockFetcher] vnstock chua duoc cai dat")
            return None

        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

        results: List[Dict[str, Any]] = []
        for idx in VN_INDEX_CODES:
            try:
                components = Vnstock(symbol=idx["code"], source=self._source).stock(
                    symbol=idx["code"], source=self._source
                )
                df = components.quote.history(
                    start=start_date,
                    end=end_date,
                    interval="1D",
                )
                if df is None or df.empty:
                    continue

                row = df.iloc[-1]
                prev_row = df.iloc[-2] if len(df) >= 2 else None

                close = float(row.get("close", 0))
                prev_close = float(prev_row.get("close", 0)) if prev_row is not None else 0.0
                change = close - prev_close
                change_pct = (change / prev_close * 100) if prev_close else 0.0

                results.append({
                    "code": idx["code"],
                    "name": idx["name"],
                    "current": close,
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "open": float(row.get("open", 0)),
                    "high": float(row.get("high", 0)),
                    "low": float(row.get("low", 0)),
                    "prev_close": prev_close,
                    "volume": float(row.get("volume", 0)),
                    "amount": 0.0,
                    "amplitude": 0.0,
                })
            except Exception as exc:
                logger.warning(f"[VnstockFetcher] Lay chi so {idx['code']} that bai: {exc}")

        return results if results else None
