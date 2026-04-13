/**
 * E2E test: RecommendationsPanel visibility on the Home page.
 *
 * The panel ("Cổ phiếu khuyến nghị hôm nay") is rendered only when no report
 * is selected (empty state). The test:
 *   1. Opens http://127.0.0.1:8000 with cache disabled
 *   2. Handles login if required
 *   3. Clears any selected report (navigates to / with no selection)
 *   4. Asserts panel text and CTA button are visible
 *   5. Captures screenshots at each key step
 */

import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE_URL = 'http://127.0.0.1:8000';
const SMOKE_PASSWORD = process.env.DSA_WEB_SMOKE_PASSWORD;
const SCREENSHOT_DIR = path.join(
  'D:/daily_stock_analysis_v2/apps/dsa-web',
  'e2e-artifacts',
  'recommendations-panel',
);

function ensureScreenshotDir() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string) {
  ensureScreenshotDir();
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
  return filePath;
}

async function loginIfNeeded(page: Page) {
  // Detect whether we are on the login page
  const isLoginPage =
    page.url().includes('/login') ||
    (await page.locator('#password').isVisible({ timeout: 3000 }).catch(() => false));

  if (!isLoginPage) return;

  if (!SMOKE_PASSWORD) {
    console.warn(
      'Login page detected but DSA_WEB_SMOKE_PASSWORD is not set. Skipping login.',
    );
    return;
  }

  await page.locator('#password').fill(SMOKE_PASSWORD);
  const submitButton = page.getByRole('button', {
    name: /授权进入工作台|完成设置并登录/,
  });
  await expect(submitButton).toBeVisible({ timeout: 5000 });

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

// ── test suite ────────────────────────────────────────────────────────────────

test.describe('RecommendationsPanel – visibility check', () => {
  test.use({
    // Force fresh load, bypass all caches
    extraHTTPHeaders: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });

  test('panel "Cổ phiếu khuyến nghị hôm nay" is visible in empty state', async ({
    browser,
  }) => {
    // Launch a fresh context with cache disabled
    const context = await browser.newContext({
      bypassCSP: true,
      // Disable cache at browser level
      serviceWorkers: 'block',
    });

    // Intercept all requests and add no-cache headers
    await context.route('**/*', async (route) => {
      const headers = {
        ...route.request().headers(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      };
      await route.continue({ headers });
    });

    const page = await context.newPage();

    try {
      // ── Step 1: Navigate to the app ──────────────────────────────────────
      console.log('Navigating to', BASE_URL);
      await page.goto(BASE_URL, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });

      await screenshot(page, '01-initial-load');

      // ── Step 2: Handle login if redirected ──────────────────────────────
      await loginIfNeeded(page);

      // Navigate explicitly to home with no selection
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForLoadState('domcontentloaded');

      await screenshot(page, '02-after-login-home');

      // ── Step 3: Check if a report is already selected ───────────────────
      // If a report is loaded the panel is hidden – clear it by navigating to /
      const reportSummary = page.locator('[data-testid="report-summary"], .report-summary');
      const reportVisible = await reportSummary.isVisible({ timeout: 2000 }).catch(() => false);

      if (reportVisible) {
        console.log('Report is selected – navigating to clear state');
        // Navigate to / which should reset selected report
        await page.goto(BASE_URL + '/', {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
        await screenshot(page, '03-cleared-report-state');
      }

      // ── Step 4: DOM search for relevant text ────────────────────────────
      const panelTitle = page.getByText('Cổ phiếu khuyến nghị hôm nay', { exact: false });
      const scanButton = page.getByText('Quét thị trường hôm nay', { exact: false });
      const scanSignal = page.getByText('Quét tín hiệu thị trường', { exact: false });
      const anyKhuyenNghi = page.getByText('khuyến nghị', { exact: false });
      const anyQuet = page.getByText('Quét', { exact: false });

      const panelTitleVisible = await panelTitle.isVisible({ timeout: 5000 }).catch(() => false);
      const scanButtonVisible = await scanButton.isVisible({ timeout: 2000 }).catch(() => false);
      const scanSignalVisible = await scanSignal.isVisible({ timeout: 2000 }).catch(() => false);
      const anyKhuyenNghiVisible = await anyKhuyenNghi.first().isVisible({ timeout: 2000 }).catch(() => false);
      const anyQuetVisible = await anyQuet.first().isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Results:');
      console.log('  "Cổ phiếu khuyến nghị hôm nay" visible:', panelTitleVisible);
      console.log('  "Quét thị trường hôm nay" button visible:', scanButtonVisible);
      console.log('  "Quét tín hiệu thị trường" visible:', scanSignalVisible);
      console.log('  any "khuyến nghị" text visible:', anyKhuyenNghiVisible);
      console.log('  any "Quét" text visible:', anyQuetVisible);

      // ── Step 5: DOM content check ─────────────────────────────────────
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasKhuyenNghi = bodyText.includes('khuyến nghị');
      const hasQuet = bodyText.includes('Quét');
      const hasPanelTitle = bodyText.includes('Cổ phiếu khuyến nghị hôm nay');
      const hasScanButton = bodyText.includes('Quét thị trường hôm nay');

      console.log('DOM text search:');
      console.log('  contains "khuyến nghị":', hasKhuyenNghi);
      console.log('  contains "Quét":', hasQuet);
      console.log('  contains panel title:', hasPanelTitle);
      console.log('  contains scan button text:', hasScanButton);

      // ── Step 6: Final screenshot ──────────────────────────────────────
      await screenshot(page, '04-final-state');

      // ── Step 7: Scroll to reveal panel if needed ─────────────────────
      await page.evaluate(() => window.scrollTo(0, 0));
      await screenshot(page, '05-scrolled-top');

      // ── Step 8: Assert the panel is present ──────────────────────────
      // The RecommendationsPanel always renders its header title
      // ("Cổ phiếu khuyến nghị hôm nay") regardless of loadState
      expect(
        hasPanelTitle || panelTitleVisible,
        'Expected "Cổ phiếu khuyến nghị hôm nay" panel title to be present in the DOM',
      ).toBe(true);

      // The CTA button "Quét thị trường hôm nay" is shown in idle state
      expect(
        hasScanButton || scanButtonVisible,
        'Expected "Quét thị trường hôm nay" CTA button to be present in the DOM',
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  test('panel is in empty/idle state when no report is selected', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      serviceWorkers: 'block',
    });

    const page = await context.newPage();

    try {
      await page.goto(BASE_URL, {
        waitUntil: 'networkidle',
        timeout: 30_000,
      });

      await loginIfNeeded(page);

      // Ensure no report is selected by checking the home-dashboard
      const dashboard = page.locator('[data-testid="home-dashboard"]');
      const dashboardVisible = await dashboard.isVisible({ timeout: 8000 }).catch(() => false);

      await screenshot(page, '06-dashboard-state');

      if (dashboardVisible) {
        console.log('Home dashboard is visible');

        // Check if RecommendationsPanel container is in DOM
        // It renders inside the else-branch (no selectedReport)
        const recPanel = page.locator('.home-panel-card').first();
        const recPanelExists = await recPanel.isVisible({ timeout: 3000 }).catch(() => false);
        console.log('  home-panel-card visible:', recPanelExists);

        // Check for the panel title in the visible DOM
        const titleEl = page.getByText('Cổ phiếu khuyến nghị hôm nay');
        const titleVisible = await titleEl.isVisible({ timeout: 3000 }).catch(() => false);
        console.log('  Panel title visible:', titleVisible);

        // Check for idle state CTA
        const ctaVisible = await page
          .getByText('Quét thị trường hôm nay')
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        console.log('  CTA "Quét thị trường hôm nay" visible:', ctaVisible);

        await screenshot(page, '07-panel-closeup');

        // Assert the panel is accessible when no report is selected
        expect(
          titleVisible || recPanelExists,
          'RecommendationsPanel should be visible when no report is selected',
        ).toBe(true);
      } else {
        console.warn('Dashboard not visible – may be on login page or loading');
        await screenshot(page, '07-no-dashboard');
      }
    } finally {
      await context.close();
    }
  });
});
