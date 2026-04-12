# -*- coding: utf-8 -*-
"""
TDD Sprint 1: Tests for GET /api/v1/stocks/{code}/ohlcv endpoint.

Tests are written FIRST (RED phase) before implementation.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make optional LLM deps safe in test env
try:
    import litellm  # noqa: F401
except ModuleNotFoundError:
    sys.modules["litellm"] = MagicMock()

import src.auth as auth
from api.app import create_app
from src.config import Config
from src.storage import DatabaseManager


def _reset_auth_globals() -> None:
    auth._auth_enabled = None
    auth._session_secret = None
    auth._password_hash_salt = None
    auth._password_hash_stored = None
    auth._rate_limit = {}


# Sample OHLCV data returned by the mocked service
MOCK_HISTORY_RESULT = {
    "stock_code": "VNM",
    "stock_name": "Vinamilk",
    "period": "daily",
    "data": [
        {
            "date": "2024-01-01",
            "open": 70000.0,
            "high": 72000.0,
            "low": 69000.0,
            "close": 71500.0,
            "volume": 1_200_000.0,
            "amount": None,
            "change_percent": 2.14,
        },
        {
            "date": "2024-01-02",
            "open": 71500.0,
            "high": 73000.0,
            "low": 70000.0,
            "close": 70200.0,
            "volume": 950_000.0,
            "amount": None,
            "change_percent": -1.82,
        },
    ],
}


class OHLCVEndpointTestCase(unittest.TestCase):
    """Contract tests for GET /api/v1/stocks/{code}/ohlcv."""

    def setUp(self) -> None:
        _reset_auth_globals()
        self.temp_dir = tempfile.TemporaryDirectory()
        data_dir = Path(self.temp_dir.name)
        env_path = data_dir / ".env"
        env_path.write_text(
            "\n".join(
                [
                    "STOCK_LIST=VNM",
                    "GEMINI_API_KEY=test",
                    "ADMIN_AUTH_ENABLED=false",
                    f"DATABASE_PATH={data_dir / 'test.db'}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        os.environ["ENV_FILE"] = str(env_path)
        Config.reset_instance()

        from fastapi.testclient import TestClient
        self.app = create_app(static_dir=data_dir / "empty-static")
        self.client = TestClient(self.app, raise_server_exceptions=False)

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()
        os.environ.pop("ENV_FILE", None)
        self.temp_dir.cleanup()

    # ------------------------------------------------------------------
    # Happy path
    # ------------------------------------------------------------------

    def test_returns_200_with_valid_symbol_and_default_period(self) -> None:
        """GET /ohlcv without period param should default to 30d and return 200."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        self.assertEqual(resp.status_code, 200)

    def test_response_contains_required_top_level_fields(self) -> None:
        """Response must contain stock_code, period, and data array."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        body = resp.json()
        for field in ("stock_code", "period", "data"):
            self.assertIn(field, body, f"Missing field: {field}")

    def test_each_bar_has_ohlcv_fields(self) -> None:
        """Every item in data[] must have date, open, high, low, close, volume."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        bars = resp.json()["data"]
        self.assertTrue(len(bars) > 0, "data array must not be empty")
        required = {"date", "open", "high", "low", "close", "volume"}
        for bar in bars:
            missing = required - bar.keys()
            self.assertFalse(missing, f"Bar missing fields: {missing}")

    def test_period_7d_maps_to_7_days(self) -> None:
        """?period=7d should call get_history_data with days=7."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ) as mock_get:
            self.client.get("/api/v1/stocks/VNM/ohlcv?period=7d")

        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        days_used = call_kwargs.kwargs.get("days")
        self.assertEqual(days_used, 7)

    def test_period_30d_maps_to_30_days(self) -> None:
        """?period=30d (default) should call get_history_data with days=30."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ) as mock_get:
            self.client.get("/api/v1/stocks/VNM/ohlcv?period=30d")

        call_kwargs = mock_get.call_args
        days_used = call_kwargs.kwargs.get("days")
        self.assertEqual(days_used, 30)

    def test_period_90d_maps_to_90_days(self) -> None:
        """?period=90d should call get_history_data with days=90."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ) as mock_get:
            self.client.get("/api/v1/stocks/VNM/ohlcv?period=90d")

        call_kwargs = mock_get.call_args
        days_used = call_kwargs.kwargs.get("days")
        self.assertEqual(days_used, 90)

    def test_period_1y_maps_to_365_days(self) -> None:
        """?period=1y should call get_history_data with days=365."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ) as mock_get:
            self.client.get("/api/v1/stocks/VNM/ohlcv?period=1y")

        call_kwargs = mock_get.call_args
        days_used = call_kwargs.kwargs.get("days")
        self.assertEqual(days_used, 365)

    def test_stock_code_in_response_matches_request(self) -> None:
        """stock_code in response must match the requested symbol."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        self.assertEqual(resp.json()["stock_code"], "VNM")

    def test_period_reflected_in_response(self) -> None:
        """period field in response should reflect the requested period string."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=MOCK_HISTORY_RESULT,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv?period=90d")

        self.assertEqual(resp.json()["period"], "90d")

    # ------------------------------------------------------------------
    # Validation errors
    # ------------------------------------------------------------------

    def test_invalid_period_returns_422(self) -> None:
        """Unsupported period value should return 422."""
        resp = self.client.get("/api/v1/stocks/VNM/ohlcv?period=5y")
        self.assertEqual(resp.status_code, 422)

    def test_empty_data_returns_200_with_empty_list(self) -> None:
        """When service returns no data, endpoint should return 200 with empty data[]."""
        empty_result = {"stock_code": "VNM", "stock_name": None, "period": "daily", "data": []}
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            return_value=empty_result,
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"], [])

    # ------------------------------------------------------------------
    # Error handling
    # ------------------------------------------------------------------

    def test_service_exception_returns_500(self) -> None:
        """Unhandled service exception must return 500."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            side_effect=RuntimeError("data source unavailable"),
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        self.assertEqual(resp.status_code, 500)

    def test_500_response_has_error_field(self) -> None:
        """500 response body must include an 'error' field."""
        with patch(
            "src.services.stock_service.StockService.get_history_data",
            side_effect=RuntimeError("boom"),
        ):
            resp = self.client.get("/api/v1/stocks/VNM/ohlcv")

        self.assertIn("error", resp.json())


if __name__ == "__main__":
    unittest.main()
