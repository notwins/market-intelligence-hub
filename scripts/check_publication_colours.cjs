/* Read-only cloud audit. Never publishes, fixes source, or writes to public storage. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MIH_PLAYWRIGHT||'playwright');
const C=require('../site/publication-colour-core.js');
const HUB='https://notwins.github.io/market-intelligence-hub/',CONTENT='https://notwins.github.io/market-intelligence-content/';
const output=path.resolve(process.env.AUDIT_OUTPUT||'publication-colour-audit');
const report={checked_at:new Date().toISOString(),timezone:'Asia/Singapore',result:'running',pages:[],articles:[],coverage_notes:[],failures:[],transient_attempts:[]};
const week=Math.floor(Date.now()/(7*86400000));
const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
const E=s=>String(s).replace(/[|\r\n]/g,' ');
async function get(url,json=true){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert(r.ok,'HTTP '+r.status+' '+url);return json?r.json():r.text();}
function selection(count){return [...new Set([0,1,2,week%count,(week+Math.ceil(count/2))%count])].filter(i=>i<count);}
async function samplePage(browser,route,selector,tags,catalogue){
 for(let attempt=1;attempt<=2;attempt++){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(HUB+route,{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>window.PublicationColour&&window.__mihPublicationColours&&document.querySelector('.mih-colour-chip'));
   await page.waitForTimeout(500);assert.equal(errors.length,0,'Page errors: '+errors.join('; '));
   const cards=page.locator(selector),count=await cards.count();assert(count>0,'No article cards rendered');
   const samples=[];let searchHref;
   for(const i of selection(count)){
    const card=cards.nth(i),heading=await card.locator('h2,h3').first().textContent();
    const plain=await card.innerText(),inferred=C.infer(plain,catalogue);
    const chips=card.locator('.mih-colour-chip'),chipCount=await chips.count();
    if(inferred.length)assert(chipCount>0,'Missing applied tags: '+heading);
    assert((await card.locator(':scope > .mu-card-tags,:scope > [data-mih-auto-row]').count())<=1,'Duplicate tag rows: '+heading);
    assert((await card.locator('.mih-colour-term').count())<=3,'Excessive inline colours: '+heading);
    assert.equal(await card.locator('a a').count(),0,'Nested links: '+heading);
    const seen=[];
    for(const chip of await chips.all()){
     const id=await chip.getAttribute('data-mih-tag');assert(tags[id],'Unapproved tag '+id);assert(!seen.includes(id),'Duplicate canonical tag');seen.push(id);
     const dark=await chip.evaluate(n=>!!n.closest('[data-theme="dark"],.daily-grid>.report-card:first-child'));
     assert.equal(await chip.evaluate(n=>getComputedStyle(n).color),rgb(tags[id][dark?'dark_text':'text']),'Incorrect tag font colour: '+heading);
     const href=await chip.getAttribute('href');assert.equal(href,C.searchHref(tags[id]),'Incorrect tag search link');searchHref||=href;
    }
    for(const term of await card.locator('.mih-colour-term').all()){
     const id=await term.getAttribute('data-mih-tag');assert(tags[id],'Unknown inline tag');
     const dark=await term.evaluate(n=>!!n.closest('[data-theme="dark"],.daily-grid>.report-card:first-child'));
     assert.equal(await term.evaluate(n=>getComputedStyle(n).color),rgb(tags[id][dark?'dark_text':'text']),'Incorrect inline font colour');
    }
    if(route.includes('#hourly')){
     assert.equal(await card.locator(':scope > .tags').count(),1,'Hourly status/topic row changed');
     assert.equal(await card.locator(':scope > [data-mih-auto-row]').count(),0,'Extra hourly tag row');
    }
    samples.push({position:i,title:heading.trim(),tags:seen,inline_terms:await card.locator('.mih-colour-term').count(),classification:chipCount?'applied':'needs reviewed classification'});
   }
   assert.equal(await page.locator('a a').count(),0,'Nested links on page');
   const ids=await page.locator('dialog[id]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(ids.length,new Set(ids).size,'Duplicate dialog IDs');
   const expectedDialog=route.startsWith('market-understanding')?'#feed-quick-read':route==='desk.html'?'#report-picker':null;
   if(expectedDialog)assert.equal(await page.locator(expectedDialog).count(),1,'Duplicated existing overlay');
   if(route.includes('#hourly')){await page.locator('[data-hourly-query]').fill('Meta');await page.locator('[data-hourly-query]').fill('');}
   if(route==='desk.html'){await page.locator('#archive-query').fill('earnings');await page.locator('#archive-query').fill('');}
   if(route.startsWith('market-understanding'))await page.locator('[data-feed-refresh]').click();
   await page.waitForTimeout(700);
   assert.equal(await page.locator('article > .mu-card-tags + [data-mih-auto-row]').count(),0,'Repeated filtering duplicated tags');
   await page.locator('.mih-colour-chip').first().focus();assert(await page.locator('.mih-colour-chip').first().evaluate(n=>n===document.activeElement));
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:950});await page.locator('.mih-colour-chip').first().scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Horizontal overflow at '+width);
    await page.screenshot({path:path.join(output,route.split('/')[0].split('.')[0]+'-'+width+'.png')});
   }
   if(searchHref){const search=await browser.newPage();try{await search.goto(searchHref,{waitUntil:'networkidle',timeout:60000});await search.locator('#results .result').first().waitFor();assert((await search.locator('#results .result').count())>0,'Tag search returned no matching records');}finally{await search.close();}}
   return {url:HUB+route,rendered_cards:count,samples,widths:[1440,390],repeated_filter:'passed',keyboard_focus:'passed',search:'passed',overlays:'existing IDs unique',page_errors:errors};
  }catch(error){if(attempt===2)throw error;report.transient_attempts.push({url:HUB+route,error:error.message});}
  finally{await page.close();}
 }
}
async function fullReports(browser,catalogue){
 const feed=await get(CONTENT+'data/research-feed.json'),rows=feed.records||[];
 if(!rows.length){report.coverage_notes.push('No new full HTML reports exist in the independent content feed. New-report rendering could not be sampled; UI sampling and the preparation source check still ran.');return;}
 const selected=[...rows].sort((a,b)=>b.cutoff_sgt.localeCompare(a.cutoff_sgt)).slice(0,3);
 for(const row of selected){
  assert(/^research\/[a-z0-9-]+\/index\.html$/.test(row.full_report_url),'Unsupported report URL');
  const href=CONTENT+row.full_report_url,page=await browser.newPage({viewport:{width:1440,height:1000}});
  try{
   await page.goto(href,{waitUntil:'networkidle',timeout:60000});assert((await page.locator('.mih-colour-chip').count())>0,'New report has no canonical tags: '+row.id);
   assert.equal(await page.locator('#mih-auto-style').count(),1,'Missing/duplicate semantic style');
   assert((await page.locator('[data-mih-auto="term"]').count())<=3,'Too many automatic inline terms');
   assert.equal(await page.locator('a a').count(),0,'Nested report links');
   for(const chip of await page.locator('.mih-colour-chip').all()){
    const id=await chip.getAttribute('data-mih-semantic'),t=C.index(catalogue)[id];assert(t,'Unmapped full-report tag');
    const dark=await chip.evaluate(n=>!!n.closest('[data-theme="dark"]'));assert.equal(await chip.evaluate(n=>getComputedStyle(n).color),rgb(t[dark?'dark_text':'text']));
    assert.equal(await chip.getAttribute('href'),C.searchHref(t));
   }
   await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'Report mobile overflow');
   report.articles.push({id:row.id,url:href,cutoff:row.cutoff_sgt,tags:await page.locator('.mih-colour-chip').count(),result:'passed'});
  }finally{await page.close();}
 }
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});let browser;
 try{
  const catalogue=await get(HUB+'data/publication-colour-catalogue.json'),tags=C.index(catalogue);
  assert(Object.keys(tags).length>=437,'Incomplete canonical catalogue');
  assert(!C.infer('Reconstruction funds for a well-funded military',catalogue).includes('sector.asset_management'),'Ambiguous generic funding tag regressed');
  const source=await get('https://raw.githubusercontent.com/notwins/market-intelligence-content/main/scripts/prepare_research_bundle.py',false);
  assert(/from publication_colour_v\d+ import enrich_folder/.test(source),'Versioned preparation filter missing');
  assert(source.indexOf('enrich_folder(report_dir,metadata')<source.indexOf('def prepare_raw('),'Enrichment no longer precedes final bundle preparation');
  report.preparation_filter='versioned filter before final hashes';
  const launch={headless:true};if(process.platform==='win32')launch.channel='msedge';browser=await chromium.launch(launch);
  for(const [route,selector] of [['desk.html','article.report-card,article.archive-card,article.news-card'],['market-understanding/index.html','article.mu-writeup'],['v4.html#hourly','article.hourly-story']]){
   try{report.pages.push(await samplePage(browser,route,selector,tags,catalogue));}catch(e){report.failures.push({url:HUB+route,error:e.message});}
  }
  try{await fullReports(browser,catalogue);}catch(e){report.failures.push({area:'new full HTML reports',error:e.message});}
  report.result=report.failures.length?'failed':'passed';
 }catch(e){report.failures.push({area:'setup/source availability',error:e.message});report.result='failed';}
 finally{
  report.completed_at=new Date().toISOString();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  let summary='## Weekly publication colour and tagging check\n\nResult: **'+report.result.toUpperCase()+'**\n\nChecked: '+report.checked_at+'\n\n';
  summary+='| Live view | Sampled cards | Result |\n|---|---:|---|\n'+report.pages.map(p=>'| '+E(p.url)+' | '+p.samples.length+' | Passed |').join('\n')+'\n\n';
  summary+='Full HTML reports sampled: '+report.articles.length+'.\n\n';
  for(const note of report.coverage_notes)summary+='- Coverage limit: '+note+'\n';
  for(const failure of report.failures)summary+='- FAIL: '+E(failure.url||failure.area)+' — '+E(failure.error)+'\n';
  if(report.transient_attempts.length)summary+='- '+report.transient_attempts.length+' initial browser attempt(s) needed a fresh-browser retry; details retained in report.json.\n';
  summary+='\nRead-only check. No articles, UI, feeds or publisher schedules were changed.\n';
  fs.writeFileSync(path.join(output,'summary.md'),summary);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  console.log(summary);if(report.result!=='passed')process.exitCode=1;
  await browser?.close();
 }
})();
