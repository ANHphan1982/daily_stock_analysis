# -*- coding: utf-8 -*-
"""Tests cho market_phase tag trong BacktestEngine.

market_phase nhận một trong: "BULL", "BEAR", "NEUTRAL", "SECTOR_HOT", None.
evaluate_single lưu tag này vào result; compute_summary trả về
market_phase_breakdown với win_rate per phase.

RED phase: các tests này phải FAIL trước khi implement.
"""

import unittest
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from src.core.backtest_engine import BacktestEngine, EvaluationConfig


@dataclass
class Bar:
    date: date
    high: float
    low: float
    close: float


def make_bars(start: date, closes):
    return [
        Bar(date=start + timedelta(days=i + 1),
            high=c * 1.01, low=c * 0.99, close=c)
        for i, c in enumerate(closes)
    ]


CFG = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
START = date(2026, 4, 1)
BARS_UP = make_bars(START, [105.0, 107.0, 110.0])    # +10%
BARS_DOWN = make_bars(START, [98.0, 96.0, 94.0])     # -6%
BARS_FLAT = make_bars(START, [100.5, 100.8, 101.0])  # +1%


# ─────────────────────────────────────────────────────────
# Helper FakeRow with market_phase
# ─────────────────────────────────────────────────────────

@dataclass
class FakeRow:
    eval_status: str = "completed"
    position_recommendation: str = "long"
    outcome: str = "win"
    direction_correct: Optional[bool] = True
    stock_return_pct: Optional[float] = 5.0
    simulated_return_pct: Optional[float] = 5.0
    hit_stop_loss: Optional[bool] = False
    hit_take_profit: Optional[bool] = False
    first_hit: Optional[str] = "neither"
    first_hit_trading_days: Optional[int] = None
    operation_advice: Optional[str] = "买入"
    alpha_pct: Optional[float] = None
    market_phase: Optional[str] = None


class MarketPhaseTagTestCase(unittest.TestCase):
    """evaluate_single phải chấp nhận và trả về market_phase."""

    def _eval(self, bars, advice="买入", phase=None, **kw):
        return BacktestEngine.evaluate_single(
            operation_advice=advice,
            analysis_date=START,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=CFG,
            market_phase=phase,
            **kw,
        )

    # ── Cơ bản ───────────────────────────────────────────

    def test_result_contains_market_phase_field(self):
        """evaluate_single phải trả về key 'market_phase' trong result."""
        result = self._eval(BARS_UP, phase="BULL")
        self.assertIn("market_phase", result)

    def test_market_phase_value_preserved(self):
        """Giá trị market_phase phải giữ nguyên như truyền vào."""
        for phase in ("BULL", "BEAR", "NEUTRAL", "SECTOR_HOT"):
            with self.subTest(phase=phase):
                result = self._eval(BARS_UP, phase=phase)
                self.assertEqual(result["market_phase"], phase)

    def test_market_phase_defaults_to_none_when_not_provided(self):
        """Không truyền market_phase → phải là None trong result."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=START,
            start_price=100.0,
            forward_bars=BARS_UP,
            stop_loss=None,
            take_profit=None,
            config=CFG,
        )
        self.assertIsNone(result.get("market_phase"))

    def test_market_phase_none_explicit(self):
        """Truyền market_phase=None → vẫn là None trong result."""
        result = self._eval(BARS_UP, phase=None)
        self.assertIsNone(result["market_phase"])

    def test_market_phase_in_insufficient_data_result(self):
        """Khi insufficient_data, market_phase vẫn phải có trong result."""
        cfg_long = EvaluationConfig(eval_window_days=10)
        bars = make_bars(START, [101.0, 102.0])  # chỉ 2 bars, cần 10
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=START,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg_long,
            market_phase="BEAR",
        )
        self.assertEqual(result["eval_status"], "insufficient_data")
        self.assertIn("market_phase", result)
        self.assertEqual(result["market_phase"], "BEAR")

    def test_market_phase_in_error_result(self):
        """Khi start_price <= 0 (error), market_phase vẫn phải có."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=START,
            start_price=0.0,
            forward_bars=BARS_UP,
            stop_loss=None,
            take_profit=None,
            config=CFG,
            market_phase="NEUTRAL",
        )
        self.assertEqual(result["eval_status"], "error")
        self.assertIn("market_phase", result)
        self.assertEqual(result["market_phase"], "NEUTRAL")

    # ── Backward compat: không truyền market_phase ────────

    def test_existing_tests_still_pass_without_market_phase(self):
        """evaluate_single vẫn hoạt động đúng khi không truyền market_phase."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=START,
            start_price=100.0,
            forward_bars=BARS_UP,
            stop_loss=95.0,
            take_profit=112.0,
            config=CFG,
        )
        self.assertEqual(result["eval_status"], "completed")
        self.assertEqual(result["outcome"], "win")


class MarketPhaseBreakdownTestCase(unittest.TestCase):
    """compute_summary phải trả về market_phase_breakdown."""

    def _summary(self, rows):
        return BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )

    # ── Summary breakdown ────────────────────────────────

    def test_summary_contains_market_phase_breakdown_key(self):
        """compute_summary phải trả về key 'market_phase_breakdown'."""
        rows = [FakeRow(market_phase="BULL")]
        summary = self._summary(rows)
        self.assertIn("market_phase_breakdown", summary)

    def test_breakdown_groups_by_phase(self):
        """Mỗi phase có bucket riêng với total, win, loss, neutral."""
        rows = [
            FakeRow(market_phase="BULL", outcome="win"),
            FakeRow(market_phase="BULL", outcome="win"),
            FakeRow(market_phase="BULL", outcome="loss"),
            FakeRow(market_phase="BEAR", outcome="loss"),
            FakeRow(market_phase="NEUTRAL", outcome="neutral",
                    direction_correct=None),
        ]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]

        self.assertIn("BULL", bd)
        self.assertIn("BEAR", bd)
        self.assertIn("NEUTRAL", bd)

        self.assertEqual(bd["BULL"]["total"], 3)
        self.assertEqual(bd["BULL"]["win"], 2)
        self.assertEqual(bd["BULL"]["loss"], 1)
        self.assertEqual(bd["BEAR"]["total"], 1)
        self.assertEqual(bd["BEAR"]["loss"], 1)

    def test_breakdown_win_rate_per_phase(self):
        """win_rate_pct phải được tính đúng cho từng phase."""
        rows = [
            FakeRow(market_phase="BULL", outcome="win"),
            FakeRow(market_phase="BULL", outcome="win"),
            FakeRow(market_phase="BULL", outcome="loss"),
            FakeRow(market_phase="BEAR", outcome="win"),
            FakeRow(market_phase="BEAR", outcome="loss"),
            FakeRow(market_phase="BEAR", outcome="loss"),
        ]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]

        # BULL: 2 win, 1 loss → 66.67%
        self.assertAlmostEqual(bd["BULL"]["win_rate_pct"], 66.67, places=1)
        # BEAR: 1 win, 2 loss → 33.33%
        self.assertAlmostEqual(bd["BEAR"]["win_rate_pct"], 33.33, places=1)

    def test_breakdown_none_phase_grouped_as_unknown(self):
        """Rows có market_phase=None phải vào bucket '(unknown)'."""
        rows = [
            FakeRow(market_phase=None, outcome="win"),
            FakeRow(market_phase=None, outcome="loss"),
        ]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]
        self.assertIn("(unknown)", bd)
        self.assertEqual(bd["(unknown)"]["total"], 2)

    def test_breakdown_includes_only_completed_rows(self):
        """Breakdown chỉ đếm completed rows, không đếm insufficient/error."""
        rows = [
            FakeRow(market_phase="BULL", outcome="win", eval_status="completed"),
            FakeRow(market_phase="BULL", outcome="win",
                    eval_status="insufficient_data"),
            FakeRow(market_phase="BULL", outcome="win", eval_status="error"),
        ]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]
        # Chỉ 1 completed row → total = 1
        self.assertEqual(bd.get("BULL", {}).get("total", 0), 1)

    def test_breakdown_empty_when_no_completed_rows(self):
        """Không có completed rows → breakdown là dict rỗng (không crash)."""
        rows = [FakeRow(eval_status="insufficient_data", market_phase="BULL")]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]
        self.assertIsInstance(bd, dict)
        # BULL không xuất hiện vì row không phải completed
        self.assertNotIn("BULL", bd)

    def test_all_four_phases_handled(self):
        """Cả 4 phases BULL/BEAR/NEUTRAL/SECTOR_HOT đều được group đúng."""
        rows = [
            FakeRow(market_phase="BULL", outcome="win"),
            FakeRow(market_phase="BEAR", outcome="loss"),
            FakeRow(market_phase="NEUTRAL", outcome="neutral",
                    direction_correct=None),
            FakeRow(market_phase="SECTOR_HOT", outcome="win"),
        ]
        summary = self._summary(rows)
        bd = summary["market_phase_breakdown"]
        for phase in ("BULL", "BEAR", "NEUTRAL", "SECTOR_HOT"):
            self.assertIn(phase, bd, f"Phase '{phase}' phải có trong breakdown")


class MarketPhaseBackwardCompatTestCase(unittest.TestCase):
    """Đảm bảo code cũ không có market_phase vẫn hoạt động."""

    def test_old_fakerow_without_market_phase_attr_works(self):
        """FakeRow không có market_phase attr phải không crash trong compute_summary."""
        from dataclasses import dataclass as dc

        @dc
        class OldFakeRow:
            eval_status: str = "completed"
            position_recommendation: str = "long"
            outcome: str = "win"
            direction_correct: Optional[bool] = True
            stock_return_pct: Optional[float] = 5.0
            simulated_return_pct: Optional[float] = 5.0
            hit_stop_loss: Optional[bool] = False
            hit_take_profit: Optional[bool] = False
            first_hit: Optional[str] = "neither"
            first_hit_trading_days: Optional[int] = None
            operation_advice: Optional[str] = "买入"
            alpha_pct: Optional[float] = None
            # Không có market_phase attr

        rows = [OldFakeRow()]
        # Không được raise AttributeError
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        # Tất cả vào "(unknown)" bucket
        bd = summary["market_phase_breakdown"]
        self.assertIn("(unknown)", bd)


if __name__ == "__main__":
    unittest.main()
