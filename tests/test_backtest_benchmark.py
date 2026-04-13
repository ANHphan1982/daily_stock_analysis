# -*- coding: utf-8 -*-
"""Tests cho benchmark_return_pct và alpha_pct trong BacktestEngine.

Mục tiêu: evaluate_single phải nhận benchmark_return_pct (return của VNINDEX
trong cùng eval_window) và tính alpha_pct = stock_return - benchmark.

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


def make_bars(start: date, closes, highs=None, lows=None):
    highs = highs or [c * 1.01 for c in closes]
    lows = lows or [c * 0.99 for c in closes]
    return [
        Bar(date=start + timedelta(days=i + 1), high=highs[i], low=lows[i], close=closes[i])
        for i in range(len(closes))
    ]


class BenchmarkReturnTestCase(unittest.TestCase):
    """Tests cho benchmark_return_pct và alpha_pct."""

    def setUp(self):
        self.cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        self.start = date(2026, 4, 1)
        self.bars_up = make_bars(self.start, [105.0, 107.0, 110.0])   # +10%
        self.bars_flat = make_bars(self.start, [100.5, 101.0, 101.5])  # +1.5%
        self.bars_down = make_bars(self.start, [99.0, 97.0, 95.0])    # -5%

    # ─────────────────────────────────────────────
    # Cơ bản: benchmark_return_pct xuất hiện trong result
    # ─────────────────────────────────────────────

    def test_result_contains_benchmark_return_pct_field(self):
        """evaluate_single phải trả về key 'benchmark_return_pct' trong result."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=3.0,
        )
        self.assertIn("benchmark_return_pct", result)

    def test_result_contains_alpha_pct_field(self):
        """evaluate_single phải trả về key 'alpha_pct' trong result."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=3.0,
        )
        self.assertIn("alpha_pct", result)

    def test_benchmark_value_preserved_in_result(self):
        """benchmark_return_pct phải được giữ nguyên giá trị truyền vào."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=5.0,
        )
        self.assertAlmostEqual(result["benchmark_return_pct"], 5.0, places=4)

    # ─────────────────────────────────────────────
    # Alpha calculation
    # ─────────────────────────────────────────────

    def test_alpha_positive_when_stock_beats_index(self):
        """alpha_pct > 0 khi cổ phiếu tăng hơn VNINDEX."""
        # stock +10%, VNINDEX +3% → alpha ≈ +7%
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=3.0,
        )
        self.assertIsNotNone(result["alpha_pct"])
        self.assertGreater(result["alpha_pct"], 0)
        # alpha = stock_return - benchmark
        self.assertAlmostEqual(
            result["alpha_pct"],
            result["stock_return_pct"] - 3.0,
            places=2,
        )

    def test_alpha_negative_when_stock_lags_index(self):
        """alpha_pct < 0 khi cổ phiếu tăng ít hơn VNINDEX."""
        # stock +1.5%, VNINDEX +5% → alpha ≈ -3.5%
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_flat,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=5.0,
        )
        self.assertIsNotNone(result["alpha_pct"])
        self.assertLess(result["alpha_pct"], 0)

    def test_alpha_zero_when_stock_matches_index(self):
        """alpha_pct ≈ 0 khi stock_return ≈ benchmark_return."""
        # Tạo bars sao cho stock_return xấp xỉ 3%
        bars = make_bars(self.start, [101.0, 102.0, 103.0])  # +3%
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=3.0,
        )
        self.assertIsNotNone(result["alpha_pct"])
        self.assertAlmostEqual(result["alpha_pct"], 0.0, places=1)

    def test_alpha_calculation_with_negative_stock_return(self):
        """alpha_pct được tính đúng khi stock giảm nhưng index tăng."""
        # stock -5%, VNINDEX +2% → alpha = -7%
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_down,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=2.0,
        )
        self.assertLess(result["alpha_pct"], -5.0)

    def test_alpha_calculation_when_both_negative(self):
        """alpha_pct dương khi stock giảm ít hơn index (tốt hơn index trong bear market)."""
        # stock -3%, VNINDEX -7% → alpha = +4%
        bars = make_bars(self.start, [99.0, 98.0, 97.0])  # -3%
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=-7.0,
        )
        self.assertGreater(result["alpha_pct"], 0)

    # ─────────────────────────────────────────────
    # None / default behavior
    # ─────────────────────────────────────────────

    def test_benchmark_none_when_not_provided(self):
        """Không truyền benchmark_return_pct → cả hai field phải là None."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            # benchmark_return_pct không truyền
        )
        self.assertIsNone(result.get("benchmark_return_pct"))
        self.assertIsNone(result.get("alpha_pct"))

    def test_alpha_none_when_benchmark_is_none_explicitly(self):
        """Truyền benchmark_return_pct=None → alpha_pct cũng là None."""
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=self.bars_up,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=None,
        )
        self.assertIsNone(result.get("alpha_pct"))

    def test_alpha_none_when_stock_return_none(self):
        """alpha_pct phải là None khi stock_return_pct không tính được (giá None)."""
        bars_with_none = [
            Bar(date=self.start + timedelta(days=i + 1), high=None, low=None, close=None)
            for i in range(3)
        ]
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=bars_with_none,
            stop_loss=None,
            take_profit=None,
            config=self.cfg,
            benchmark_return_pct=3.0,
        )
        self.assertIsNone(result.get("alpha_pct"))

    # ─────────────────────────────────────────────
    # Backward compatibility (error / insufficient_data paths)
    # ─────────────────────────────────────────────

    def test_benchmark_in_insufficient_data_result(self):
        """Khi insufficient_data, benchmark_return_pct vẫn phải có trong result."""
        cfg_long = EvaluationConfig(eval_window_days=10)
        bars = make_bars(self.start, [101.0, 102.0])  # chỉ 2 bars, cần 10
        result = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=self.start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg_long,
            benchmark_return_pct=2.5,
        )
        self.assertEqual(result["eval_status"], "insufficient_data")
        self.assertIn("benchmark_return_pct", result)
        self.assertAlmostEqual(result["benchmark_return_pct"], 2.5, places=4)

    # ─────────────────────────────────────────────
    # Summary: avg_alpha_pct
    # ─────────────────────────────────────────────

    def test_summary_includes_avg_alpha_pct(self):
        """compute_summary phải tính avg_alpha_pct từ các completed rows."""
        from dataclasses import dataclass as dc

        @dc
        class FakeRowWithAlpha:
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

        rows = [
            FakeRowWithAlpha(alpha_pct=7.0),   # stock +10%, index +3%
            FakeRowWithAlpha(alpha_pct=-3.0),  # stock +2%, index +5%
            FakeRowWithAlpha(alpha_pct=4.0),   # stock +11%, index +7%
        ]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        self.assertIn("avg_alpha_pct", summary)
        # avg = (7 - 3 + 4) / 3 ≈ 2.67
        self.assertIsNotNone(summary["avg_alpha_pct"])
        self.assertAlmostEqual(summary["avg_alpha_pct"], (7.0 - 3.0 + 4.0) / 3, places=2)

    def test_summary_avg_alpha_none_when_no_alpha_data(self):
        """avg_alpha_pct phải là None khi không có row nào có alpha_pct."""
        from dataclasses import dataclass as dc

        @dc
        class FakeRowNoAlpha:
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
            # Không có alpha_pct attr (backward compat với FakeRow cũ)

        rows = [FakeRowNoAlpha()]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        # Phải không crash; avg_alpha_pct là None hoặc không có
        self.assertIsNone(summary.get("avg_alpha_pct"))


if __name__ == "__main__":
    unittest.main()
