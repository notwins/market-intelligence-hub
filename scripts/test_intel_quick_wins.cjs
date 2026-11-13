const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../site/search-metadata.js'),F=require('../site/feed-freshness.js'),G=require('../site/global-search.js');
assert.equal(M.dateInfo('2026-11-06T23:34:23Z').text,'Sat 07:34am, 07-Nov SGT');
assert.equal(M.dateInfo('2026-11-06T16:00:00Z').text,'Sat 12:00am, 07-Nov SGT');
assert.equal(M.dateInfo('2026-11-06T04:00:00Z').text,'Fri 12:00pm, 06-Nov SGT');
assert.equal(M.dateInfo('2026-11-06').text,'Fri, 06-Nov · time not supplied');
for(const value of [null,undefined,''])assert.equal(M.dateInfo(value).text,'Date not supplied');
for(const value of ['2026-02-30','2026-11-06T10:30','today','<script>'])assert.equal(M.dateInfo(value).precision,'unknown');
assert(!M.dateHTML('<script>').includes('<script>'));
const standard=JSON.parse(fs.readFileSync('site/data/search-colour-standard.json'));
assert(M.tagsHTML(['Singapore'],standard).includes('#047857'));assert(!M.tagsHTML(['Unmapped'],standard).includes('style='));
assert(!M.tagsHTML(['<svg>'],standard).includes('<svg>'));assert(M.tagsHTML(['Singapore'],standard,{button:true}).includes('data-tag="Singapore"'));
assert(M.sourceDate({date:null,display_date:'2026-11-06'}).includes('time not supplied'));
assert(F.row(F.feeds[0],{generated_at:'2026-11-06T23:34:23Z'}).includes('Sat 07:34am, 07-Nov SGT'));
assert(F.row(F.feeds[0],{}).includes('Date not supplied'));assert(F.row(F.feeds[0],{},true).includes('Unavailable'));
const catalogue=JSON.parse(fs.readFileSync('site/data/site-search.json'));const banks=catalogue.entries.find(e=>e.href==='research/sti-banks-2026-11-06/index.html');assert.equal(banks.display_date,'2026-11-06');assert.equal(banks.date,null,'Display metadata must not change existing ranking date');
const dated={kind:'Headline',title:'Google earnings',href:'https://example.com',date:'2026-11-06T23:34:23Z',tags:['Earnings']};const row=G.rowHTML(dated,0,standard);assert(row.includes('Sat 07:34am, 07-Nov SGT'));assert(row.includes('search-tags'));assert(row.includes('Earnings'));
const html=fs.readFileSync('site/v4.html','utf8');assert(!html.includes('class="market-shortcuts"'));assert(!html.includes('data-market-anchor'));assert(!html.includes('Shares →'));assert(!html.includes('Bonds →'));assert(html.includes('class="bottom-nav"'));assert(html.includes('Bonds &amp; Credit'));assert(html.includes('Bonds &amp; shares watchlist'));assert(html.includes('featured-research.js?v='));assert(html.includes('FeaturedResearch.shell()'));assert(html.includes('FeaturedResearch.mount()'));assert(html.indexOf('search-metadata.js')<html.indexOf('global-search.js'));
console.log('PASS precise SGT dates, midnight/noon, date-only and unknown states, XSS, neutral unmapped chips, feed provenance, STI feature and preserved bottom navigation');

const workflow=fs.readFileSync('.github/workflows/publish.yml','utf8');for(const stage of ['Test publisher validation and archive retention','Revalidate reconciled source and rebuild deployment catalogue']){const block=workflow.split('- name: '+stage)[1].split('      - name:')[0];assert(block.indexOf('build_site_search.py')>=0&&block.indexOf('build_site_search.py')<block.indexOf('unittest'),'Regenerate catalogue before '+stage);}

const featureCSS=fs.readFileSync('site/intel-quick-wins.css','utf8');
const article=fs.readFileSync('site/research/sti-banks-2026-11-06/index.html','utf8');
for(const [token,values] of Object.entries({bg:['#f4f6f5','#101915'],ink:['#182822','#f0f4f1'],mut:['#485b53','#c1cec7'],line:['#cbd6d0','#415349'],sg:['#047857','#6ee7b7'],earn:['#0369a1','#7dd3fc']})){
  const featureToken={mut:'muted',earn:'link'}[token]||token;
  for(const value of values){assert(article.includes(`--${token}:${value}`));assert(featureCSS.includes(`--sti-${featureToken}:${value}`));}
}
assert(article.includes('h1 em{font-family:Georgia,serif;font-weight:500;color:var(--sg)}'));
assert(featureCSS.includes('h2 em{font-family:Georgia,serif;font-weight:500;color:var(--sti-sg)}'));
assert(featureCSS.includes('@media(prefers-color-scheme:dark){.featured-research--sti'));
assert(featureCSS.includes('@media(forced-colors:active)'));
console.log('PASS scoped STI article-matched light/dark palette and mixed title fonts');

// Freshness health follows each saved file's actual schema. A recent check is not a new quote.
const headlineFeed=F.feeds.find(f=>f.id==='headlines'),watchFeed=F.feeds.find(f=>f.id==='watchlist'),historyFeed=F.feeds.find(f=>f.id==='history');
const prepared='2026-11-08T00:06:08.644265+00:00',checked='2026-11-08T00:12:48.189394+00:00',observation='2026-11-06T21:00:01Z';
const watchData={generated_at:prepared,rows:[{price:{as_of:observation}}]};
assert.equal(watchFeed.statusField,'state');assert.equal(headlineFeed.statusField,'status');assert.equal(historyFeed.statusField,'status');
for(const [state,expected] of [['failed','failed'],['failure','failed'],['error','failed'],['partial','partial'],['unknown','unknown'],['future_state','unknown'],['','unknown'],[null,'unknown'],[{},'unknown']]){
 const h={state,status:'ok',checked_at:checked};assert.equal(F.healthInfo(watchFeed,h).state,expected);const html=F.row(watchFeed,watchData,false,h);assert(html.includes('data-health="'+expected+'"'));assert(html.includes('Prepared at: '+M.dateHTML(prepared)));assert(html.includes('Checked at: '+M.dateHTML(checked)));assert(!html.includes('Publication verified'));assert(!html.includes(observation));
}
for(const h of [null,{},[],{status:'ok'},{state:undefined}]){assert.equal(F.healthInfo(watchFeed,h).state,'unknown');assert(F.row(watchFeed,watchData,false,h).includes('Latest check status unknown'));}
const verified={state:'scheduled_publication_verified',status:'failed',checked_at:checked};
assert.equal(F.healthInfo(watchFeed,verified).state,'ok');assert(F.row(watchFeed,watchData,false,verified).includes('Publication verified'));
const partial={...verified,coverage:{news_access:'partial'}};
assert.equal(F.healthInfo(watchFeed,partial).state,'partial');const partialHTML=F.row(watchFeed,watchData,false,partial);
assert(partialHTML.includes('Publication verified; reporting coverage partial'));assert(!partialHTML.includes('failed'));assert(partialHTML.indexOf(prepared)<partialHTML.indexOf(checked));
const realStatus=JSON.parse(fs.readFileSync('site/data/watchlist/status.json')),realWatch=JSON.parse(fs.readFileSync('site/data/watchlist/latest.json'));
assert.equal(realStatus.state,'scheduled_publication_verified');assert.equal(realStatus.coverage.news_access,'partial');assert(F.row(watchFeed,realWatch,false,realStatus).includes('Publication verified; reporting coverage partial'));
for(const [feed,ok]of [[headlineFeed,'ok'],[historyFeed,'success']]){
 assert.equal(F.healthInfo(feed,{status:ok,state:'failed'}).state,'ok');assert.equal(F.healthInfo(feed,{status:'failed',state:'scheduled_publication_verified'}).state,'failed');assert.equal(F.healthInfo(feed,{status:'partial'}).state,'partial');assert.equal(F.healthInfo(feed,null).state,'unknown');
 const html=F.row(feed,{[feed.field]:prepared},false,{status:ok,last_attempt:checked,checked_at:'2030-01-01T00:00:00Z'});assert(html.includes(M.dateHTML(checked)));assert(!html.includes('2030-01-01'));
}
for(const t of [undefined,null,'','invalid','2026-02-30','2026-11-08T10:30','<script>']){
 const html=F.row(watchFeed,{generated_at:t},false,{state:'unknown',checked_at:t});assert(html.includes('data-unavailable="true"'));assert(html.includes('Prepared at: Date not supplied'));assert(html.includes('Checked at: Date not supplied'));assert(!html.includes('<script>'));assert(!html.includes('datetime='));
}
const missingPrepared=F.row(watchFeed,{},false,{...verified,checked_at:checked});assert(missingPrepared.includes('Prepared at: Date not supplied'));assert.equal((missingPrepared.match(/datetime=/g)||[]).length,1);
const missingCheck=F.row(watchFeed,watchData,false,{state:'failed',last_success:checked});assert(missingCheck.includes('Checked at: Date not supplied'));assert(!missingCheck.includes(checked));
const dateOnly=F.row(watchFeed,{generated_at:'2026-11-08'},false,{state:'partial',checked_at:'2026-11-09'});assert.equal((dateOnly.match(/time not supplied/g)||[]).length,2);assert(!dateOnly.includes('SGT'));
assert(F.row(watchFeed,watchData,true,verified).includes('data-unavailable="true"'));assert(F.row(watchFeed,watchData,true,verified).includes('Prepared at: Unavailable'));
for(const feed of F.feeds.filter(f=>!f.statusFile)){assert.equal(F.healthInfo(feed,{state:'failed'}),null);assert(!F.row(feed,{},false,{state:'failed',checked_at:checked}).includes('Checked at'));}
const frozenData=JSON.stringify(watchData),frozenHealth=JSON.stringify(partial);F.row(watchFeed,watchData,false,partial);assert.equal(JSON.stringify(watchData),frozenData);assert.equal(JSON.stringify(partial),frozenHealth);
console.log('PASS feed-specific status/state, failure/partial/unknown fallbacks, verified publication with partial coverage, saved chronology, invalid and date-only times, no data mutation');

// Execute the existing fetch-and-mount path with read-only stubs, including failures.
const vm=require('node:vm'),freshnessCode=fs.readFileSync('site/feed-freshness.js','utf8');
async function mountFreshness(fail){
 const calls=[],slot={hidden:false,innerHTML:''},data={
  'data/news.json':{generated_at:prepared},'data/status.json':{status:'ok',last_attempt:checked},
  'data/hourly-news.json':{editions:[{report_at:prepared}]},'data/watchlist/latest.json':watchData,'data/watchlist/status.json':partial,
  'data/history-fed.json':{retrieved_at:prepared},'data/history-fed-status.json':{status:'success',last_attempt:checked},'data/earnings-history.json':{verified_at:prepared}
 };
 const document={getElementById:()=>slot},fetch=async(path,options)=>{calls.push({path,options});if(fail[path]==='reject')throw Error('Simulated fetch failure');return {ok:fail[path]!=='http',json:async()=>{if(fail[path]==='json')throw Error('Invalid JSON');return data[path];}};};
 const context={window:{SearchMetadata:M,document},document,fetch,Map,Promise,Date};vm.runInNewContext(freshnessCode,context);context.window.FeedFreshness.mount('overview');await new Promise(resolve=>setImmediate(resolve));
 return {html:slot.innerHTML,calls};
}
(async()=>{
 const good=await mountFreshness({});assert.equal(good.calls.length,8);assert(good.calls.every(c=>c.options.cache==='no-store'));assert(good.html.includes('Checked at describes the saved check, not a new observation'));assert(good.html.includes('Publication verified; reporting coverage partial'));
 for(const mode of ['reject','http','json']){
  const h=await mountFreshness({'data/watchlist/status.json':mode});const row=h.html.match(/<div class="feed-freshness-item" data-feed="watchlist"[\s\S]*?<\/div>/)[0];assert(row.includes('Latest check status unknown'));assert(row.includes('Prepared at: '+M.dateHTML(prepared)));assert(row.includes('Checked at: Date not supplied'));
  const d=await mountFreshness({'data/watchlist/latest.json':mode});const missing=d.html.match(/<div class="feed-freshness-item" data-feed="watchlist"[\s\S]*?<\/div>/)[0];assert(missing.includes('Prepared at: Unavailable'));assert(missing.includes('data-unavailable="true"'));assert(!missing.includes('Publication verified'));
 }
 console.log('PASS freshness mount with unchanged fetch paths/cache, network/HTTP/JSON fallback states and honest check-versus-observation labels');
})().catch(error=>{console.error(error);process.exitCode=1;});
