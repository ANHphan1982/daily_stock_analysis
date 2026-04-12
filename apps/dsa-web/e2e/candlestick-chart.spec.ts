/**
 * TDD Sprint 6: E2E tests for CandlestickChart on the Home dashboard.
 *
 * Strategy: intercept API calls via page.route so tests run without
 * real stock data and without a specific history record in the DB.
 *
 * Auth handling:
 *   - ADMIN_AUTH_ENABLED=false  → navigate directly to /
 *   - ADMIN_AUTH_ENABLED=true   → requires DSA_WEB_SMOKE_PASSWORD
 */

import { expect, test, type Page } from '@playwright/test';

const smokePassword = process.env.DSA_WEB_SMOKE_PASSWORD;

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

const FAKE_HISTORY_ITEM = {
  id: 99901,
  queryId: 'e2e-q-1',
  stockCode: 'VNM',
  stockName: 'Vinamilk (E2E)',
  sentimentScore: 78,
  operationAdvice: 'Theo dõi',
  createdAt: new Date().toISOString(),
};

const FAKE_HISTORY_DETAIL = {
  meta: {
    id: 99901,
    queryId: 'e2e-q-1',
    stockCode: 'VNM',
    stockName: 'Vinamilk (E2E)',
    reportType: 'detailed',
    reportLanguage: 'vi',
    createdAt: new Date().toISOString(),
  },
  summary: {
    analysisSummary: 'Xu hướng tích cực trong ngắn hạn.',
    operationAdvice: 'Có thể mua tích lũy.',
    trendPrediction: 'Ngắn hạn tăng nhẹ.',
    sentimentScore: 78,
  },
};

function makeFakeOHLCV(period: string, count = 30) {
  const bars = Array.from({ length: count }, (_, i) => ({
    date: new Date(Date.now() - (count - i) * 86_400_000).toISOString().slice(0, 10),
    open:  70000 + Math.random() * 2000,
    high:  72000 + Math.random() * 2000,
    low:   68000 + Math.random() * 2000,
    close: 70500 + Math.random() * 2000,
    volume: 1_000_000 + Math.random() * 500_000,
    change_percent: (Math.random() - 0.5) * 4,
  }));
  return { stock_code: 'VNM', stock_name: 'Vinamilk (E2E)', period, data: bars };
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function login(page: Page) {
  // Check auth status first
  const authResp = await page.request.get('/api/v1/auth/status').catch(() => null);
  const authEnabled = authResp ? (await authResp.json().catch(() => ({ authEnabled: true }))).authEnabled : true;

  if (!authEnabled) {
    // Auth disabled — go straight to home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    return;
  }

  // Auth enabled — need password
  test.skip(!smokePassword, 'Set DSA_WEB_SMOKE_PASSWORD to run candlestick E2E tests (auth is enabled).');

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#password')).toBeVisible({ timeout: 10_000 });
  await page.locator('#password').fill(smokePassword!);

  const submitButton = page.getByRole('button', { name: /授权进入工作台|完成设置并登录/ });
  await expect(submitButton).toBeVisible();

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v1/auth/login') && r.status() === 200,
      { timeout: 15_000 },
    ),
    submitButton.click(),
  ]);

  await page.waitForURL('/', { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded');
}

/** Intercept history list and detail to inject a fake report */
async function interceptHistory(page: Page) {
  // Intercept the detail endpoint first (more specific) so it takes priority
  await page.route('**/api/v1/history/99901', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_HISTORY_DETAIL),
    });
  });

  // Intercept the list endpoint
  await page.route('**/api/v1/history?**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1, page: 1, limit: 20,
        items: [FAKE_HISTORY_ITEM],
      }),
    });
  });
}

/** Intercept history list to return empty */
async function interceptEmptyHistory(page: Page) {
  await page.route('**/api/v1/history?**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ total: 0, page: 1, limit: 20, items: [] }),
    });
  });
}

/** Intercept OHLCV endpoint for a given period */
async function interceptOHLCV(page: Page, period = '30d') {
  await page.route(`**/api/v1/stocks/VNM/ohlcv*`, (route) => {
    const url = new URL(route.request().url());
    const requestedPeriod = url.searchParams.get('period') ?? '30d';
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeFakeOHLCV(requestedPeriod)),
    });
  });
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

test.describe('CandlestickChart on Home dashboard', () => {

  // ----------------------------------------------------------------
  // Critical path: chart renders after report selection
  // ----------------------------------------------------------------

  test('candlestick chart appears after selecting a history report', async ({ page }) => {
    await interceptHistory(page);
    await interceptOHLCV(page);
    await login(page);

    // Wait for the history list to load and auto-select first item
    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });
  });

  test('chart shows period selector buttons', async ({ page }) => {
    await interceptHistory(page);
    await interceptOHLCV(page);
    await login(page);

    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });

    // All four period buttons should be visible
    await expect(page.getByRole('button', { name: '7D' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30D' })).toBeVisible();
    await expect(page.getByRole('button', { name: '90D' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1Y' })).toBeVisible();
  });

  test('30D is the default active period', async ({ page }) => {
    await interceptHistory(page);
    await interceptOHLCV(page);
    await login(page);

    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });

    const btn30d = page.getByRole('button', { name: '30D' });
    await expect(btn30d).toHaveAttribute('data-active', 'true');
  });

  // ----------------------------------------------------------------
  // Period switching
  // ----------------------------------------------------------------

  test('clicking 7D triggers an OHLCV API request with period=7d', async ({ page }) => {
    await interceptHistory(page);
    await interceptOHLCV(page);
    await login(page);

    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });

    // Listen for the next OHLCV request
    const ohlcvRequest = page.waitForRequest(
      (req) => req.url().includes('/ohlcv') && req.url().includes('period=7d'),
      { timeout: 5_000 },
    );

    await page.getByRole('button', { name: '7D' }).click();
    await ohlcvRequest;

    // Button should now be active
    await expect(page.getByRole('button', { name: '7D' })).toHaveAttribute('data-active', 'true');
    await expect(page.getByRole('button', { name: '30D' })).toHaveAttribute('data-active', 'false');
  });

  test('clicking 1Y triggers an OHLCV API request with period=1y', async ({ page }) => {
    await interceptHistory(page);
    await interceptOHLCV(page);
    await login(page);

    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });

    const ohlcvRequest = page.waitForRequest(
      (req) => req.url().includes('/ohlcv') && req.url().includes('period=1y'),
      { timeout: 5_000 },
    );

    await page.getByRole('button', { name: '1Y' }).click();
    await ohlcvRequest;

    await expect(page.getByRole('button', { name: '1Y' })).toHaveAttribute('data-active', 'true');
  });

  // ----------------------------------------------------------------
  // Loading & error states
  // ----------------------------------------------------------------

  test('chart does NOT appear on the empty state screen (no report)', async ({ page }) => {
    // Setup interceptors BEFORE login so even the first navigation uses them
    await interceptEmptyHistory(page);

    await login(page);

    // Give the app time to render the empty state
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('candlestick-chart')).not.toBeVisible();
  });

  test('chart shows empty state when OHLCV returns no bars', async ({ page }) => {
    // Setup interceptors BEFORE login
    await interceptHistory(page);

    // Return empty OHLCV data
    await page.route('**/api/v1/stocks/VNM/ohlcv*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stock_code: 'VNM', stock_name: null, period: '30d', data: [] }),
      });
    });

    await login(page);

    await expect(page.getByTestId('candlestick-chart')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('chart-empty')).toBeVisible({ timeout: 5_000 });
  });
});
