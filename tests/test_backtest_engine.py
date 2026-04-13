# -*- coding: utf-8 -*-
"""Unit tests for backtest engine."""

import unittest
from dataclasses import dataclass
from datetime import date, timedelta

from src.core.backtest_engine import BacktestEngine, EvaluationConfig


@dataclass
class Bar:
    date: date
    high: float
    low: float
    close: float


class BacktestEngineTestCase(unittest.TestCase):
    def _bars(self, start: date, closes, highs=None, lows=None):
        highs = highs or closes
        lows = lows or closes
        bars = []
        for i, c in enumerate(closes):
            bars.append(Bar(date=start + timedelta(days=i + 1), high=highs[i], low=lows[i], close=c))
        return bars

    def test_buy_win_when_up(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [102, 104, 105], highs=[103, 105, 106], lows=[101, 103, 104])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertEqual(res["eval_status"], "completed")
        self.assertEqual(res["outcome"], "win")
        self.assertTrue(res["direction_correct"])  # up

    def test_sell_win_when_down_cash(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [98, 97, 96], highs=[99, 98, 97], lows=[97, 96, 95])
        res = BacktestEngine.evaluate_single(
            operation_advice="卖出",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertEqual(res["position_recommendation"], "cash")
        self.assertEqual(res["outcome"], "win")
        self.assertEqual(res["simulated_return_pct"], 0.0)
        self.assertEqual(res["first_hit"], "not_applicable")

    def test_wait_maps_to_cash_and_flat_direction(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        # Stock drops ~5%: AI said wait (neutral), stock moved significantly → loss
        bars = self._bars(date(2024, 1, 1), [98, 96, 95], highs=[99, 97, 96], lows=[97, 95, 94])
        res = BacktestEngine.evaluate_single(
            operation_advice="观望",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertEqual(res["position_recommendation"], "cash")
        self.assertEqual(res["direction_expected"], "flat")
        self.assertEqual(res["outcome"], "loss")

    def test_hold_win_when_flat(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [100.5, 100.2, 101], highs=[101, 101, 101], lows=[99.8, 99.9, 100])
        res = BacktestEngine.evaluate_single(
            operation_advice="持有",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["outcome"], "win")

    def test_hold_win_when_up(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [102, 103, 104], highs=[103, 104, 105], lows=[101, 102, 103])
        res = BacktestEngine.evaluate_single(
            operation_advice="持有",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["outcome"], "win")

    def test_stop_loss_hit_first(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [99, 98, 97], highs=[101, 100, 99], lows=[94, 97, 96])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertTrue(res["hit_stop_loss"])
        self.assertEqual(res["first_hit"], "stop_loss")
        self.assertEqual(res["simulated_exit_reason"], "stop_loss")

    def test_take_profit_hit_first(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [105, 106, 107], highs=[111, 107, 108], lows=[103, 105, 106])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertTrue(res["hit_take_profit"])
        self.assertEqual(res["first_hit"], "take_profit")
        self.assertEqual(res["simulated_exit_reason"], "take_profit")

    def test_ambiguous_same_day(self):
        cfg = EvaluationConfig(eval_window_days=2, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [100, 100], highs=[111, 100], lows=[94, 99])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=95,
            take_profit=110,
            config=cfg,
        )
        self.assertEqual(res["first_hit"], "ambiguous")
        self.assertEqual(res["simulated_exit_reason"], "ambiguous_stop_loss")

    def test_buy_loss_when_down(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [98, 96, 95], highs=[99, 97, 96], lows=[97, 95, 94])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=93,
            take_profit=110,
            config=cfg,
        )
        self.assertEqual(res["eval_status"], "completed")
        self.assertEqual(res["outcome"], "loss")
        self.assertFalse(res["direction_correct"])

    def test_hold_loss_when_down(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [98, 96, 95], highs=[99, 97, 96], lows=[97, 95, 94])
        res = BacktestEngine.evaluate_single(
            operation_advice="持有",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["direction_expected"], "not_down")
        self.assertEqual(res["outcome"], "loss")
        self.assertFalse(res["direction_correct"])

    def test_sell_loss_when_up(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [102, 104, 106], highs=[103, 105, 107], lows=[101, 103, 105])
        res = BacktestEngine.evaluate_single(
            operation_advice="卖出",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["position_recommendation"], "cash")
        self.assertEqual(res["direction_expected"], "down")
        self.assertEqual(res["outcome"], "loss")
        self.assertFalse(res["direction_correct"])

    def test_neutral_outcome(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [100.5, 100.2, 100.8], highs=[101, 101, 101], lows=[100, 100, 100])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["direction_expected"], "up")
        self.assertEqual(res["outcome"], "neutral")
        self.assertIsNone(res["direction_correct"])

    def test_direction_correct_false_buy_down(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [97, 95, 94], highs=[98, 96, 95], lows=[96, 94, 93])
        res = BacktestEngine.evaluate_single(
            operation_advice="buy",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["direction_expected"], "up")
        self.assertEqual(res["outcome"], "loss")
        self.assertFalse(res["direction_correct"])

    def test_insufficient_data(self):
        cfg = EvaluationConfig(eval_window_days=5, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [100, 101])
        res = BacktestEngine.evaluate_single(
            operation_advice="买入",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["eval_status"], "insufficient_data")

    def test_unrecognized_advice_defaults_to_cash(self):
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        bars = self._bars(date(2024, 1, 1), [102, 104, 105], highs=[103, 105, 106], lows=[101, 103, 104])
        res = BacktestEngine.evaluate_single(
            operation_advice="some gibberish text",
            analysis_date=date(2024, 1, 1),
            start_price=100,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(res["position_recommendation"], "cash")
        self.assertEqual(res["direction_expected"], "flat")

    def test_none_empty_advice_defaults_to_cash(self):
        for advice in [None, "", "   "]:
            pos = BacktestEngine.infer_position_recommendation(advice)
            direction = BacktestEngine.infer_direction_expected(advice)
            self.assertEqual(pos, "cash", f"Expected cash for advice={advice!r}")
            self.assertEqual(direction, "flat", f"Expected flat for advice={advice!r}")

    def test_negated_sell_not_classified_bearish(self):
        # "do not sell" negates "sell" — should NOT be direction=down
        self.assertNotEqual(BacktestEngine.infer_direction_expected("do not sell"), "down")

    def test_chinese_negated_sell_not_bearish(self):
        # "不要卖出" = "don't sell" — should NOT be direction=down
        self.assertNotEqual(BacktestEngine.infer_direction_expected("不要卖出"), "down")

    def test_wait_then_buy_classified_as_cash(self):
        # "wait" matches first in priority order → cash
        pos = BacktestEngine.infer_position_recommendation("wait for a dip then buy")
        self.assertEqual(pos, "cash")


class ReduceVsSellTestCase(unittest.TestCase):
    """Tests phân biệt 减仓 (partial_exit) với 卖出 (full cash exit)."""

    def _bars(self, start, closes, highs=None, lows=None):
        highs = highs or closes
        lows = lows or closes
        return [
            Bar(date=start + timedelta(days=i + 1), high=highs[i], low=lows[i], close=closes[i])
            for i in range(len(closes))
        ]

    # ── infer_position_recommendation ─────────────────────────────────────

    def test_jiancan_maps_to_partial_exit(self):
        """'减仓' (Chinese: reduce position) phải → partial_exit."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("减仓"), "partial_exit")

    def test_maichu_maps_to_cash(self):
        """'卖出' (Chinese: sell/exit) phải → cash."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("卖出"), "cash")

    def test_jiancan_slash_maichu_maps_to_cash(self):
        """'减仓/卖出' (compound) phải → cash (thành phần 卖出 thắng)."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("减仓/卖出"), "cash")

    def test_giam_vi_the_maps_to_partial_exit(self):
        """'giảm vị thế' (Vietnamese: reduce position) phải → partial_exit."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("giảm vị thế"), "partial_exit")

    def test_reduce_english_maps_to_partial_exit(self):
        """'reduce' (English) phải → partial_exit."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("reduce position"), "partial_exit")

    def test_sell_english_maps_to_cash(self):
        """'sell' (English, không có 'reduce') phải vẫn → cash."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("sell"), "cash")

    def test_strong_sell_maps_to_cash(self):
        """'strong sell' phải → cash."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("strong sell"), "cash")

    def test_qing_cang_maps_to_cash(self):
        """'清仓' (Chinese: clear position / liquidate) phải → cash."""
        self.assertEqual(BacktestEngine.infer_position_recommendation("清仓"), "cash")

    # ── infer_direction_expected ─────────────────────────────────────────

    def test_jiancan_direction_is_down(self):
        """'减仓' kỳ vọng giá giảm → direction = down."""
        self.assertEqual(BacktestEngine.infer_direction_expected("减仓"), "down")

    def test_giam_vi_the_direction_is_down(self):
        """'giảm vị thế' kỳ vọng giá giảm → direction = down."""
        self.assertEqual(BacktestEngine.infer_direction_expected("giảm vị thế"), "down")

    def test_reduce_direction_is_down(self):
        """'reduce' direction phải là down."""
        self.assertEqual(BacktestEngine.infer_direction_expected("reduce"), "down")

    # ── evaluate_single với partial_exit ─────────────────────────────────

    def test_partial_exit_position_recommendation_in_result(self):
        """evaluate_single với '减仓' phải trả về position_recommendation=partial_exit."""
        cfg = EvaluationConfig(eval_window_days=3)
        start = date(2026, 4, 1)
        bars = self._bars(start, [104.0, 106.0, 108.0],
                          highs=[105.0, 107.0, 109.0], lows=[103.0, 105.0, 107.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(result["position_recommendation"], "partial_exit")

    def test_partial_exit_simulated_return_is_half_of_stock_return(self):
        """partial_exit: simulated_return_pct = stock_return_pct * 0.5."""
        cfg = EvaluationConfig(eval_window_days=3)
        start = date(2026, 4, 1)
        # stock +10% (end_close=110)
        bars = self._bars(start, [104.0, 107.0, 110.0],
                          highs=[105.0, 108.0, 111.0], lows=[103.0, 106.0, 109.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertAlmostEqual(result["stock_return_pct"], 10.0, places=1)
        # simulated phải là 5% (50% của 10%)
        self.assertIsNotNone(result["simulated_return_pct"])
        self.assertAlmostEqual(result["simulated_return_pct"], 5.0, places=1)

    def test_partial_exit_simulated_return_negative_when_stock_falls(self):
        """partial_exit giữ nửa vị thế: thua cũng là 50% thua thực tế."""
        cfg = EvaluationConfig(eval_window_days=3)
        start = date(2026, 4, 1)
        # stock -6%
        bars = self._bars(start, [99.0, 97.0, 94.0],
                          highs=[100.0, 98.0, 95.0], lows=[98.0, 96.0, 93.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertLess(result["stock_return_pct"], 0)
        self.assertLess(result["simulated_return_pct"], 0)
        self.assertAlmostEqual(
            result["simulated_return_pct"],
            result["stock_return_pct"] * 0.5,
            places=1,
        )

    def test_partial_exit_stop_loss_triggers_half_loss(self):
        """partial_exit: nếu stop-loss bị kích hoạt, tổn thất = (SL - entry)/entry * 50%."""
        cfg = EvaluationConfig(eval_window_days=5)
        start = date(2026, 4, 1)
        # Ngày 1: xuống tới 90 (dưới SL=92), kích hoạt stop
        bars = self._bars(start,
                          closes=[95.0, 96.0, 97.0, 97.0, 98.0],
                          highs=[96.0, 97.0, 98.0, 98.0, 99.0],
                          lows=[89.0, 95.0, 96.0, 96.0, 97.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=92.0,
            take_profit=115.0,
            config=cfg,
        )
        self.assertEqual(result["position_recommendation"], "partial_exit")
        self.assertTrue(result["hit_stop_loss"])
        # simulated exit at stop_loss = 92; return = (92-100)/100 * 50% = -4%
        self.assertAlmostEqual(result["simulated_return_pct"], -4.0, places=1)

    def test_partial_exit_take_profit_triggers_half_gain(self):
        """partial_exit: nếu take-profit bị kích hoạt, lời = (TP - entry)/entry * 50%."""
        cfg = EvaluationConfig(eval_window_days=5)
        start = date(2026, 4, 1)
        # Ngày 1: lên đến 115 (>= TP=112), kích hoạt TP
        bars = self._bars(start,
                          closes=[108.0, 110.0, 111.0, 112.0, 113.0],
                          highs=[115.0, 111.0, 112.0, 113.0, 114.0],
                          lows=[107.0, 109.0, 110.0, 111.0, 112.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=90.0,
            take_profit=112.0,
            config=cfg,
        )
        self.assertEqual(result["position_recommendation"], "partial_exit")
        self.assertTrue(result["hit_take_profit"])
        # simulated exit at take_profit = 112; return = (112-100)/100 * 50% = 6%
        self.assertAlmostEqual(result["simulated_return_pct"], 6.0, places=1)

    def test_partial_exit_outcome_based_on_full_stock_return(self):
        """outcome (win/loss) của partial_exit phải dựa trên stock_return_pct đầy đủ, không phải simulated."""
        cfg = EvaluationConfig(eval_window_days=3, neutral_band_pct=2.0)
        start = date(2026, 4, 1)
        # stock giảm 5%, ta giảm vị thế (bearish call đúng → win)
        bars = self._bars(start, [98.0, 96.0, 95.0],
                          highs=[99.0, 97.0, 96.0], lows=[97.0, 95.0, 94.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="减仓",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(result["direction_expected"], "down")
        self.assertEqual(result["outcome"], "win")  # stock giảm > 2% = thắng
        self.assertTrue(result["direction_correct"])

    def test_cash_simulated_return_still_zero(self):
        """'卖出' vẫn → position=cash và simulated_return=0 (không thay đổi)."""
        cfg = EvaluationConfig(eval_window_days=3)
        start = date(2026, 4, 1)
        bars = self._bars(start, [110.0, 112.0, 115.0])
        result = BacktestEngine.evaluate_single(
            operation_advice="卖出",
            analysis_date=start,
            start_price=100.0,
            forward_bars=bars,
            stop_loss=None,
            take_profit=None,
            config=cfg,
        )
        self.assertEqual(result["position_recommendation"], "cash")
        self.assertEqual(result["simulated_return_pct"], 0.0)

    # ── Summary: partial_exit_count ──────────────────────────────────────

    def test_summary_counts_partial_exit_separately(self):
        """compute_summary phải đếm partial_exit riêng, không lẫn với long/cash."""
        from dataclasses import dataclass as dc

        @dc
        class FakeRowPartial:
            eval_status: str = "completed"
            position_recommendation: str = "partial_exit"
            outcome: str = "win"
            direction_correct: bool = True
            stock_return_pct: float = -3.0
            simulated_return_pct: float = -1.5
            hit_stop_loss: bool = False
            hit_take_profit: bool = False
            first_hit: str = "neither"
            first_hit_trading_days: None = None
            operation_advice: str = "减仓"
            alpha_pct: None = None
            market_phase: None = None

        rows = [
            FakeRowPartial(),
            FakeRowPartial(position_recommendation="long"),
            FakeRowPartial(position_recommendation="cash"),
        ]
        summary = BacktestEngine.compute_summary(
            results=rows,
            scope="overall",
            code="__overall__",
            eval_window_days=3,
            engine_version="v1",
        )
        self.assertIn("partial_exit_count", summary)
        self.assertEqual(summary["partial_exit_count"], 1)
        self.assertEqual(summary["long_count"], 1)
        self.assertEqual(summary["cash_count"], 1)


if __name__ == "__main__":
    unittest.main()
