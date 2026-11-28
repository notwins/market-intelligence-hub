const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

const base = new URL('tools/gld-strategy.html',process.env.SITE_URL || 'http://127.0.0.1:8789/');
const ko = '?mode=historical&quote=Q04&date=2020-04-14#path-rebound';

async function withHubNavigation(page) {
  // Raw site/ lacks the primary navigation that the Pages build injects. Exercise
  // the real stylesheet and script locally, and the unmodified document on Pages.
  if (['localhost','127.0.0.1','[::1]'].includes(base.hostname)) {
    await page.route(url=>url.pathname===base.pathname,async route=>{
      const response = await route.fetch();
      let html = await response.text();
      if (!html.includes('id="hub-primary-assets"')) {
        const nav = '<link id="hub-primary-assets" rel="stylesheet" href="../Primary Navigation - Type CSS - 16-Nov-16.06.css">'+
          '<script defer src="../Primary Navigation - Type JS - 16-Nov-16.06.js"></script>';
        html=html.replace('</head>',nav+'</head>');
      }
      await route.fulfill({response,body:html});
    });
  }
  // To exercise a candidate against deployed markup, pricing, and navigation:
  // set SITE_URL to Pages and GLD_GUIDE_LOCAL_ASSETS=1.
  if (process.env.GLD_GUIDE_LOCAL_ASSETS==='1') {
    for (const asset of ['gld-guide.css','gld-guide-player.js']) {
      const url = new URL(asset,base);
      await page.route(u=>u.origin===url.origin && u.pathname===url.pathname,route=>
        route.fulfill({path:path.resolve(__dirname,'../site/tools',asset)}));
    }
  }
}

async function assertHitTarget(page, selector, label) {
  // A mobile navigation flyout is in the browser top layer. Bounds of its
  // toolbar alone miss the Search link that used to cover the second launch.
  function obstruction(selector) {
    const target = document.querySelector(selector);
    if (!target) return 'missing '+selector;
    const box=target.getBoundingClientRect();
    for (const [x,y] of [[.5,.5],[.2,.5],[.8,.5],[.5,.25],[.5,.75]]) {
      const px=box.x+x*box.width, py=box.y+y*box.height;
      const hit=document.elementFromPoint(px,py);
      if (!target.contains(hit)) {
        const link=hit?.closest('a');
        return Math.round(px)+','+Math.round(py)+' hits '+(link?.href || hit?.tagName || 'outside the viewport');
      }
    }
    return null;
  }
  const end=Date.now()+3000;
  let blocked;
  do {
    blocked=await page.evaluate(obstruction,selector);
    if (!blocked) return;
    await page.waitForTimeout(50);
  } while (Date.now()<end);
  assert.fail(label+' ('+page.viewportSize().width+'px): '+blocked);
}

async function checkMenu(browser,width) {
  const page=await browser.newPage({viewport:{width,height:840},reducedMotion:'reduce'});
  try {
    await withHubNavigation(page);
    await page.goto(base+'?mode=historical');
    await page.locator('html.hub-primary-ready .hub-primary-group').first().waitFor();
    await page.evaluate(()=>window.scrollTo(0,0));
    const group=page.locator('.hub-primary-group').filter({has:page.getByRole('button',{name:'News subsections'})});
    await group.locator('.hub-primary-link').hover();
    const menu=group.locator('.hub-primary-dropdown');
    await menu.waitFor({state:'visible'});
    if (width<600) assert(await menu.evaluate(el=>el.matches(':popover-open')),'Expected the real mobile top-layer menu');
    await menu.evaluate(el=>{ el.scrollTop=el.scrollHeight; });
    await assertHitTarget(page,'.hub-primary-dropdown:not([hidden]) a[data-nav-art="search"]','Search inside News menu');
    await assertHitTarget(page,'#play-walkthrough','Launcher with News menu open');
    await page.locator('#play-walkthrough').click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('html.hub-primary-ready:not(.hub-primary-hidden)').waitFor({state:'attached'});
    await assertHitTarget(page,'.gld-guide-next','Next after launch');
    await assertHitTarget(page,'.gld-guide-close','Stop after launch');
    await page.locator('.gld-guide-close').click();
    await assertHitTarget(page,'#play-walkthrough','Launcher after Stop');
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
  try {
    const page = await browser.newPage({viewport:{width:390,height:840},reducedMotion:'reduce'});
    await withHubNavigation(page);
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
    const trigger=page.locator('#play-walkthrough'), next=page.locator('.gld-guide-next');
    const caption=page.locator('.gld-guide-caption'), stop=page.locator('.gld-guide-close');
    const date=page.locator('#path-rebound input[type=range]');
    await page.goto(base+ko);
    await page.locator('html.hub-primary-ready').waitFor({state:'attached'});
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
    await assertHitTarget(page,'#play-walkthrough','Restart after selecting the Q04 KO');
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
    await page.close();
    for (const width of [320,390,1280]) await checkMenu(browser,width);
    console.log('Guide flow, Q04 restart, speech, P&L and editor passed. Real navigation hit tests passed at 320, 390 and 1280px.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
