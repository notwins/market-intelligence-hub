const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const base=process.env.SITE_URL||'http://127.0.0.1:8789/';const errors=[];
for(const width of [390,1440]){
 const p=await b.newPage({viewport:{width,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'v4.html#calls');await p.waitForSelector('#equity-research-title');
 const research=p.locator('[aria-labelledby="equity-research-title"]');assert.equal(await research.locator('.watchlist-card').count(),3);
 assert((await research.innerText()).includes('not personal calls'));assert(await p.locator('#view').getByText('Historical calls & trade reviews',{exact:true}).count());
 await p.waitForSelector('a[href="research/calls/call-qqq-hedge-review-20261031/index.html"]');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
 for(const path of ['research/tsm-2026-11-05/','research/nvda-2026-11-05/']){
  await research.locator('a[href="'+path+'"]').first().click();await p.waitForURL('**/'+path);assert.equal(await p.locator('h1').count(),1);
  await p.goBack();await p.waitForSelector('#equity-research-title');
 }
 await research.locator('a[href="research/googl/"]').first().click();await p.waitForSelector('[aria-label="Company research navigation"]');
 const nav=p.locator('[aria-label="Company research navigation"]');assert.equal(await nav.locator('a').count(),3);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Google overflow '+width);
 await p.screenshot({path:'/tmp/company-navigation-googl-'+width+'.png',fullPage:false});
 await nav.locator('a[href="../../v4.html#calls"]').click();await p.waitForSelector('#equity-research-title');
 await p.locator('#view [data-view="watchlist"]').click();await p.waitForSelector('#watchlist-results');
 await p.goBack();await p.waitForSelector('#equity-research-title');
 await p.evaluate(()=>{document.documentElement.style.setProperty('--text-scale','2')});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'200% overflow '+width);
 await p.evaluate(()=>{document.documentElement.style.setProperty('--text-scale','1')});
 await p.screenshot({path:'/tmp/company-navigation-calls-'+width+'.png',fullPage:true});
 await p.close();
}
assert.equal(errors.length,0,errors.join('\n'));await b.close();console.log('PASS mobile/desktop Calls cards, no false calls, links, Google navigation, Back and repeat flows, 200% no overflow, no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
