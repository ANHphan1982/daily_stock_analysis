// Standalone Playwright test — chạy: node test_webui.mjs
import { chromium } from './apps/dsa-web/node_modules/playwright/index.mjs';
import fs from 'fs';

const URL = 'http://127.0.0.1:8000';
const OUT = 'test_screenshot.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    bypassCSP: true,
    extraHTTPHeaders: { 'Cache-Control': 'no-cache, no-store' },
  });
  const page = await context.newPage();

  console.log(`Opening ${URL} ...`);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('Page title:', title);

  const bodyText = await page.evaluate(() => document.body.innerText);

  // Check for panel keywords
  const keywords = [
    'Cổ phiếu khuyến nghị hôm nay',
    'Quét thị trường hôm nay',
    'Tín hiệu thị trường VN',
    'khuyến nghị',
    'Bắt đầu phân tích',
  ];
  console.log('\n--- Keyword check ---');
  keywords.forEach(kw => {
    const found = bodyText.includes(kw);
    console.log(`  "${kw}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
  });

  // Screenshot toàn trang
  await page.screenshot({ path: OUT, fullPage: true });
  console.log(`\nScreenshot saved: ${OUT} (${fs.statSync(OUT).size} bytes)`);

  // Nếu panel chưa hiển thị vì có report đang chọn → thử clear
  const hasReport = await page.$('[data-testid="strategy-card-idealBuy"]');
  if (hasReport) {
    console.log('\nReport đang được chọn — panel chỉ hiện ở empty state.');
    console.log('Để thấy panel: bỏ chọn report hoặc mở trang ở tab mới incognito.');
  }

  await browser.close();
  console.log('\nDone.');
})().catch(err => { console.error(err); process.exit(1); });
