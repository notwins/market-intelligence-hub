/* Run against a locally served candidate or a deployed Pages build. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const base = new URL(process.env.SITE_URL || 'http://127.0.0.1:8156/');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const response = await fetch(new URL('data/si-pricing-reference.json', base));
  assert(response.ok, 'SI reference data must be available');
  const { rows: references } = await response.json();
  const count = code => references.filter(row => row.shares.includes(code)).length;
  const expected = ['Shares / reference', 'Date', 'CCY', 'Tenor', 'Coupon', 'KO', 'KO Step-down', 'KI', 'Strike'];
  const surfaces = [
    ['Main', 'v4.html', '#overview', '.cd-card[data-company="NVDA"]'],
    ['Desk', 'desk.html', '#markets', '#company-NVDA', 'button[data-detail="si"]'],
    ['Earnings', 'v4.html?company=NVDA', '#earnings', '#earnings-NVDA'],
    ['Historical prices', 'v4.html', '#history/shares', '.mp-watchlist-company:has([data-price-symbol="NVDA"])'],
    ['Watchlist', 'v4.html?company=NVDA', '#watchlist', '.watchlist-card[data-ticker="NVDA"]'],
    ['Watchlist report', 'watchlist-report.html?edition=watchlist-20261108T000000Z', '#NVDA', '.watchlist-card[data-ticker="NVDA"]'],
    ['Stocks BETA', 'stocks-beta.html?companies=NVDA', '', '[data-stock="NVDA"]'],
    ['Stocks BETA 2', 'stocks-beta2.html', '', '#sb2-detail']
  ];

  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, isMobile: width < 500, hasTouch: width < 500 });
      const navigate = (path, hash = '') => {
        const url = new URL(path + hash, base);
        if (process.env.RELEASE_SHA) url.searchParams.set('release', process.env.RELEASE_SHA);
        return page.goto(url.href, { waitUntil: 'domcontentloaded' });
      };
      await page.addInitScript(() => {
        if (location.pathname.endsWith('/stocks-beta2.html')) {
          localStorage.setItem('market-hub-stocks-beta2-comparison-v1', '{"cards":[{"slot":1,"ticker":"NVDA US"}]}');
        }
      });
      for (const [label, path, hash, card, button] of surfaces) {
        console.log(`Checking ${label} at ${width}px`);
        await navigate(path, hash);
        const host = page.locator(card).first();
        if (button) await host.locator(button).click({ timeout: 30000 });
        const detail = host.locator('[data-si-card-listing="NVDA"]').first();
        await detail.waitFor({ state: 'attached', timeout: 45000 });
        const summary = detail.locator('summary');
        if (!await detail.evaluate(node => node.open)) await summary.click();
        const table = detail.locator('table[data-tc-layout="si-card-references"]');
        await table.waitFor({ timeout: 30000 });
        const names = await table.locator('thead th').evaluateAll(nodes => nodes.map(node => node.firstChild.textContent.trim()));
        assert.deepEqual(names, expected, label);
        const row = table.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'Open SI-006 one-pager' }) });
        const values = await row.evaluate(node => Array.from(node.cells, cell => cell.textContent));
        assert.equal(values[3], '11 months');
        assert.equal(values[4], '8% p.a.');
        assert.equal(values[6], '2.00 pp');
        await row.locator('img').first().waitFor({ state: 'attached' });
        assert.equal(await row.locator('[data-si-barrier-band]').count(), 3);
        assert.equal(await row.getByRole('link', { name: 'Open SI-006 one-pager' }).getAttribute('href'), 'si-beta2.html?reference=SI-006');
        assert.equal(await detail.getByRole('link', { name: 'Open in SI Beta 2 →' }).getAttribute('href'), 'si-beta2.html?company=NVDA#si-library');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' page overflow at ' + width);
        console.log(`PASS ${label} at ${width}px`);
      }
      await page.locator('#sb2-detail [data-si-card-listing] a[href*="company=NVDA"]').click();
      await page.locator('#library-company-scope').waitFor();
      await page.getByRole('link', { name: 'Open SI-006 one-pager' }).waitFor();
      assert.equal(await page.evaluate(() => typeof window.MarketSI), 'undefined', 'SI2 loads independently of SI1');
      assert((await page.locator('#library-count').textContent()).startsWith(`${count('NVDA')} of ${references.length}`));
      await page.getByRole('button', { name: 'Show all companies' }).click();
      assert((await page.locator('#library-count').textContent()).startsWith(`${references.length} of ${references.length}`));
      await page.getByRole('link', { name: 'Open SI-006 one-pager' }).click();
      await page.waitForFunction(() => document.querySelector('#preview svg')?.textContent.includes('SI-006'));
      await navigate('si-beta2.html?company=BABA', '#si-library');
      await page.waitForFunction(text => document.querySelector('#library-count').textContent.startsWith(text), `${count('BABA')} of ${references.length}`);
      assert(await page.locator('#library-rows tr .si-library-shares').evaluateAll(rows => rows.every(row => row.getAttribute('aria-label').split(' / ').includes('BABA'))));
      await navigate('si-beta2.html?company=9988.HK', '#si-library');
      await page.locator('#library-rows tr .si-library-share').first().waitFor();
      assert.equal(await page.locator('#library-company-code').textContent(), '9988');
      assert(await page.locator('#library-rows tr').evaluateAll(rows => rows.every(row => row.querySelector('.si-library-shares').textContent.includes('9988'))));
      console.log(`PASS company filter, clear and SI-006 one-pager at ${width}px`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
