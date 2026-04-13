# -*- coding: utf-8 -*-
"""Unit tests for BacktestEngine.compute_summary()."""

import unittest
from dataclasses import dataclass

from src.core.backtest_engine import BacktestEngine


@dataclass
class FakeRow:
    eval_status: str = "completed"
    position_recommendation: str = "long"
    outcome: str = "win"
    direction_correct: bool | None = True
    stock_return_pct: float | None = 1.0
    simulated_return_pct: float | None = 1.0
    hit_stop_loss: bool | None = False
    hit_take_profit: bool | None = False
    first_hit: str | None = "neither"
    first_hit_trading_days: int | None = None
    operation_advice: str | None = "买入"


class BacktestSummaryTestCase(unittest.TestCase):
    def test_trigger_rates_use_applicable_denominators(self) -> None:
        # One row has stop-loss configured, one row doesn't.
        rows = [
            FakeRow(hit_stop_loss=True, hit_take_profit=None, first_hit="stop_loss"),
            FakeRow(hit_stop_loss=None, hit_take_profit=True, first_hit="take_profit"),
        ]

        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="stock",
            code="600519",
            eval_window_days=3,
            engine_version="v1",
        )

        # stop_loss_trigger_rate denominator should be 1 (only applicable row)
        self.assertEqual(summary["stop_loss_trigger_rate"], 100.0)

        # take_profit_trigger_rate denominator should be 1 (only applicable row)
        self.assertEqual(summary["take_profit_trigger_rate"], 100.0)

        # ambiguous_rate denominator should be 2 (any target applicable)
        self.assertEqual(summary["ambiguous_rate"], 0.0)


class AdviceBreakdownTestCase(unittest.TestCase):
    """Tests for advice_breakdown and diagnostics population."""

    def _make_row(self, **kwargs):
        defaults = dict(
            eval_status="completed",
            position_recommendation="long",
            outcome="win",
            direction_correct=True,
            stock_return_pct=1.0,
            simulated_return_pct=1.0,
            hit_stop_loss=False,
            hit_take_profit=False,
            first_hit="neither",
            first_hit_trading_days=None,
            operation_advice="买入",
        )
        defaults.update(kwargs)
        return FakeRow(**defaults)

    def test_advice_breakdown_populated_with_completed_results(self):
        """advice_breakdown phải có entry cho mỗi loại advice khi có completed rows."""
        rows = [
            self._make_row(operation_advice="买入", outcome="win"),
            self._make_row(operation_advice="买入", outcome="loss"),
            self._make_row(operation_advice="减仓/卖出", outcome="win"),
            self._make_row(operation_advice="观望", outcome="neutral", direction_correct=None),
        ]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        ab = summary["advice_breakdown"]
        self.assertNotEqual(ab, {}, "advice_breakdown không được rỗng khi có completed rows")
        self.assertIn("买入", ab, "phải có bucket cho '买入'")
        self.assertEqual(ab["买入"]["total"], 2)
        self.assertEqual(ab["买入"]["win"], 1)
        self.assertEqual(ab["买入"]["loss"], 1)
        self.assertIn("减仓/卖出", ab)
        self.assertIn("观望", ab)

    def test_advice_breakdown_win_rate_computed(self):
        """win_rate_pct trong advice_breakdown phải được tính đúng."""
        rows = [
            self._make_row(operation_advice="mua", outcome="win"),
            self._make_row(operation_advice="mua", outcome="win"),
            self._make_row(operation_advice="mua", outcome="loss"),
        ]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="stock",
            code="VN:HPG",
            eval_window_days=3,
            engine_version="v1",
        )
        ab = summary["advice_breakdown"]
        self.assertIn("mua", ab)
        # 2 wins, 1 loss → win_rate = 2/3 * 100 ≈ 66.67
        self.assertAlmostEqual(ab["mua"]["win_rate_pct"], 66.67, places=1)

    def test_diagnostics_populated_with_all_results(self):
        """diagnostics.eval_status phải đếm đúng tất cả rows, không chỉ completed."""
        rows = [
            self._make_row(eval_status="completed", first_hit="neither"),
            self._make_row(eval_status="insufficient_data", first_hit="(none)"),
            self._make_row(eval_status="error", first_hit="(none)"),
        ]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        diag = summary["diagnostics"]
        self.assertEqual(diag["eval_status"].get("completed"), 1)
        self.assertEqual(diag["eval_status"].get("insufficient_data"), 1)
        self.assertEqual(diag["eval_status"].get("error"), 1)

    def test_advice_breakdown_empty_when_no_completed(self):
        """Không có completed rows → breakdown là dict (không crash, không rỗng unexpected)."""
        rows = [self._make_row(eval_status="insufficient_data")]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="stock",
            code="VN:HPG",
            eval_window_days=3,
            engine_version="v1",
        )
        # Không raise exception
        self.assertIsInstance(summary["advice_breakdown"], dict)

    def test_advice_breakdown_long_advice_not_truncated(self):
        """advice dài (> 20 chars) phải xuất hiện đầy đủ trong breakdown."""
        long_advice = "Nên mua mạnh khi có tín hiệu breakout rõ ràng"  # > 20 chars
        rows = [self._make_row(operation_advice=long_advice, outcome="win")]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="stock",
            code="VN:FPT",
            eval_window_days=3,
            engine_version="v1",
        )
        ab = summary["advice_breakdown"]
        self.assertIn(long_advice, ab, "advice dài không được bị cắt ngắn")

    def test_advice_breakdown_none_advice_grouped_as_unknown(self):
        """operation_advice=None phải được nhóm vào '(unknown)', không crash."""
        rows = [self._make_row(operation_advice=None, outcome="neutral", direction_correct=None)]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="stock",
            code="VN:VCB",
            eval_window_days=3,
            engine_version="v1",
        )
        ab = summary["advice_breakdown"]
        self.assertIn("(unknown)", ab)


if __name__ == "__main__":
    unittest.main()

