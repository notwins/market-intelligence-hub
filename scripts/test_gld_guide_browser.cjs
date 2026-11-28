const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 840}, reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Deliver speech completion explicitly to exercise queued and canceled callbacks.
    await page.addInitScript(() => {
      window.guideSpoken = [];
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {value: class { constructor(text) { this.text = text; } }});
      Object.defineProperty(window, 'speechSynthesis', {value: {
        getVoices: () => [], cancel() {}, pause() {}, resume() {},
        speak(utterance) { window.guideSpoken.push(utterance); utterance.onstart?.(); }
      }});
    });
    const base = new URL('tools/gld-strategy.html', process.env.SITE_URL || 'http://127.0.0.1:8789/');
    await page.goto(base + '?mode=historical&quote=Q04&date=2020-09-18#path-rebound');
    const launch = page.locator('#path-rebound [data-guide-start="fixing"]');
    await launch.click();
    const caption = page.locator('.gld-guide-caption');
    assert.match(await caption.innerText(), /Q04.*\$183\.20/);
    await page.evaluate(() => { window.earlyEnd = window.guideSpoken.at(-1).onend; window.earlyEnd(); });
    assert.match(await caption.innerText(), /14 Apr 2020.*63 shares.*\$91,639\.27/);
    await page.click('.gld-guide-next');
    assert.match(await caption.innerText(), /Add GLD outright.*\$13,456\.10.*since the knock-out/);
    assert.match(await page.locator('.gld-guide-active-target').innerText(), /13,456\.1/);
    assert((await page.evaluate(() => window.guideSpoken.at(-1).text)).includes(await caption.innerText()));
    await page.evaluate(() => window.earlyEnd());
    assert.match(await caption.innerText(), /13,456/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.gld-guide-dock, .gld-guide-active-target').count(), 0);
    await page.locator('#walkthrough-script summary').click();
    await page.selectOption('#guide-line', 'pnl');
    await page.fill('#guide-line-text', '{quote} earns {amount} {pnlBasis} through {when}.');
    await page.click('#guide-save');
    await page.reload();
    await launch.click();
    await page.click('.gld-guide-next');
    await page.click('.gld-guide-next');
    assert.match(await caption.innerText(), /Q04 earns \$13,456\.10 since the knock-out/);
    await page.locator('#scenario-mode').click();
    await page.locator('#path-bear [data-guide-start="card"]').click();
    await page.click('.gld-guide-next');
    await page.click('.gld-guide-next');
    assert.match(await caption.innerText(), /reached maturity.*without a knock-out/);
    assert.equal(await page.locator('.gld-guide-active-target').count(), 1);
    assert.deepEqual(errors, []);
    console.log('GLD walkthrough speech lifecycle, fixing targets, portfolio basis, local script edits and maturity passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
