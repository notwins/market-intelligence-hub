/* Rendered regression for return tiles in one-, two- and three-card layouts.
   Run on a locally served candidate with Playwright; no deployment needed. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:2048,height:1200}});
 const base=process.env.SITE_URL||'http://127.0.0.1:8789/';
 await page.goto(base+'v4.html#earnings');
 await page.waitForSelector('#earnings-GOOGL .earnings-return-grid strong');
 await page.waitForSelector('#earnings-AMZN .earnings-return-grid strong');
 await page.waitForSelector('#earnings-TSM .earnings-return-grid strong');
 await page.evaluate(async()=>{await Promise.all([window.ShareEnrichment.load(),window.BOSEquity.refresh()]);await window.EarningsDesk.mount();});
 const layoutStyle=await page.addStyleTag({content:'.ed-companies{grid-template-columns:repeat(var(--test-card-columns,3),minmax(0,1fr))!important}'});
 const tickers=['GOOGL','AMZN','TSM'];
 const baseline=await page.evaluate(tickers=>tickers.map(t=>[...document.getElementById('earnings-'+t).querySelectorAll('.earnings-return-grid strong')].map(n=>n.textContent)),tickers);
 async function inspect(label){
  const result=await page.evaluate(tickers=>{
   const issues=[];
   for(const ticker of tickers){
    const grid=document.querySelector('#earnings-'+ticker+' .earnings-return-grid'),box=grid.getBoundingClientRect();
    if(grid.scrollWidth>grid.clientWidth+1)issues.push(ticker+': return grid overflows');
    for(const tile of grid.children){
     const bounds=tile.getBoundingClientRect();
     if(bounds.left<box.left-1||bounds.right>box.right+1)issues.push(ticker+': tile outside grid');
     const value=tile.querySelector('strong'),range=document.createRange();range.selectNodeContents(value);
     const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
     if(rects.length!==1)issues.push(ticker+': split percentage '+value.textContent);
     if(rects.some(r=>r.left<bounds.left-1||r.right>bounds.right+1))issues.push(ticker+': clipped percentage '+value.textContent);
     const year=tile.querySelector('small'),match=year.textContent.match(/\b\d{4}\b/);
     if(match&&year.firstChild?.nodeType===3){range.setStart(year.firstChild,match.index);range.setEnd(year.firstChild,match.index+4);if(range.getClientRects().length!==1)issues.push(ticker+': split year '+match[0]);}
    }
   }
   return {issues,values:tickers.map(t=>[...document.getElementById('earnings-'+t).querySelectorAll('.earnings-return-grid strong')].map(n=>n.textContent))};
  },tickers);
  assert.deepEqual(result.issues,[],label+': '+result.issues.join('; '));
  assert.deepEqual(result.values,baseline,label+': displayed data changed');
 }
 for(const width of [1280,1600,2048]){
  await page.setViewportSize({width,height:1200});
  for(const columns of [1,2,3])for(const scale of [1,1.5,2]){
   await page.evaluate(({columns,scale})=>{
    document.documentElement.style.setProperty('--text-scale',String(scale));
    document.documentElement.style.setProperty('--test-card-columns',String(columns));
   },{columns,scale});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await inspect(width+'px / '+columns+' cards / '+scale+' text');
  }
 }
 await layoutStyle.evaluate(node=>node.remove());
 for(const width of [320,390])for(const scale of [1,2]){
  await page.setViewportSize({width,height:960});
  await page.evaluate(scale=>document.documentElement.style.setProperty('--text-scale',String(scale)),scale);
  await inspect(width+'px / automatic cards / '+scale+' text');
 }
 await page.setViewportSize({width:2048,height:1200});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--text-scale','1');document.querySelector('.ed-companies').style.gridTemplateColumns='repeat(3,minmax(0,1fr))';});
 await page.locator('#earnings-GOOGL').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/earnings-three-cards.png',fullPage:false});
 await browser.close();
 console.log('PASS unbroken percentages and years, no tile overflow, unchanged values across three-card, narrow and enlarged-text layouts');
})().catch(error=>{console.error(error);process.exit(1);});
