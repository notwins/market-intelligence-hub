const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  try {
    const page = await browser.newPage({viewport:{width:390,height:840},reducedMotion:'reduce'});
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.addInitScript(() => {
      window.guideSpoken = [];
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {value:class { constructor(text) { this.text=text; } }});
      Object.defineProperty(window, 'speechSynthesis', {value:{
        getVoices:()=>[], cancel(){}, pause(){}, resume(){},
        speak(utterance){ window.guideSpoken.push(utterance); utterance.onstart?.(); }
      }});
    });
    const base = new URL('tools/gld-strategy.html',process.env.SITE_URL || 'http://127.0.0.1:8789/');
    const trigger=page.locator('#play-walkthrough'), next=page.locator('.gld-guide-next');
    const caption=page.locator('.gld-guide-caption'), stop=page.locator('.gld-guide-close');
    const date=page.locator('#path-rebound input[type=range]');
    await page.goto(base+'?mode=historical&quote=Q04&date=2020-04-14#path-rebound');
    await trigger.click();
    assert.equal(await page.locator('[data-guide-start]').count(),1);
    assert.equal(await date.inputValue(),'18');
    assert.match(await caption.innerText(),/14 Apr(?:il)? 2020/);
    assert.equal(await stop.innerText(),'Stop');
    await page.evaluate(()=>{ window.oldEnd=window.guideSpoken.at(-1).onend; window.oldEnd?.(); });
    assert.equal(await date.inputValue(),'18','Finishing a spoken line must leave the date in place.');
    await next.click();
    assert.equal(await date.inputValue(),'21','Skip two unchanged tied closes after KO.');
    assert.match(await caption.innerText(),/225\.24/);
    assert.match(await caption.innerText(),/169\.80/);
    assert.match(await caption.innerText(),/158\.57/);
    assert.match(await caption.innerText(),/21\.59/);
    assert.match(await page.locator('.gld-guide-active-target').innerText(),/225\.24/);
    assert.equal(await page.locator('.gld-guide-active-target').getAttribute('data-guide-post'),'decu');
    const ledger=page.locator('.gld-guide-workings');
    assert.match(await ledger.textContent(),/814\.44/);
    assert.match(await ledger.textContent(),/792\.85/);
    await next.click();
    assert.equal(await date.inputValue(),'25');
    assert.match(await caption.innerText(),/964\.16/);
    assert.match(await page.locator('.gld-guide-active-target').innerText(),/964\.16/);
    assert.equal(await page.locator('.gld-guide-active-target').getAttribute('data-guide-post'),'hold');
    await page.evaluate(()=>window.oldEnd?.());
    assert.equal(await date.inputValue(),'25');
    await stop.click();
    assert.equal(await page.locator('.gld-guide-dock,.gld-guide-active-target').count(),0);
    assert.equal(await date.inputValue(),'25');
    // Restart from another user-selected fixing and skip directly to a fresh winner.
    await page.locator('#path-rebound .replay-cell[data-index="3"][data-day="18"]').click();
    await trigger.click(); assert.equal(await date.inputValue(),'18');await next.click();
    assert.equal(await date.inputValue(),'21');await page.keyboard.press('Escape');
    await page.locator('#walkthrough-script summary').click();
    await page.selectOption('#guide-line','leaderKo');
    const edit=page.locator('#guide-line-text');
    await edit.fill((await edit.inputValue())+' Editing test.');
    await page.click('#guide-save');await page.reload();
    await trigger.click();assert.match(await caption.innerText(),/Editing test/);
    await stop.click();
    await page.goto(base+'?mode=historical&quote=Q04&date=2021-03-18#path-rebound');
    await trigger.click();assert.equal(await date.inputValue(),'252');assert(await next.isDisabled());
    await stop.click();await page.goto(base+'?mode=historical#path-bear');
    await page.locator('#path-bear .replay-cell[data-index="0"][data-day="0"]').click();
    await trigger.click();assert.match(await caption.innerText(),/matur/i);assert(await next.isDisabled());
    assert.deepEqual(errors,[]);
    console.log('Single guide, actual leader changes, P&L targets, manual speech, restart, maturity and edited script passed.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
