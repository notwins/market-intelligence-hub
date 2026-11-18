'use strict';
const assert=require('node:assert/strict');
const Desk=require('../site/desk.js');
const DeskNews=require('../site/desk-news.js');
const tests=[];function test(name,fn){tests.push([name,fn]);}
test('links reject active schemes, traversal, private chats and embedded credentials',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,bad','//evil.test/x','../secret','%2e%2e/secret','https://a:b@example.org','https://chatgpt.com/c/private','https://chat.openai.com/c/private','https://x.test/white space','x\\y'])assert.equal(Desk.safeHref(url),'',url);
 for(const url of ['research/a/','search.html?q=AAPL','#markets','https://www.reuters.com/world/story'])assert.equal(Desk.safeHref(url),url);
});
test('canonical directory and index destinations deduplicate while editions remain distinct',()=>{
 assert.equal(Desk.canonical('research/a/'),Desk.canonical('research/a/index.html#title'));
 assert.notEqual(Desk.canonical('research/a/'),Desk.canonical('research/a-r2/'));
 const result=Desk.mergeReports([{id:'a',title:'A',href:'research/a/',added_at:'2026-11-10T00:00:00Z'}],[{id:'a',title:'Updated metadata',href:'research/a/index.html',added_at:null},{id:'r2',href:'research/a-r2/'}]);
 assert.equal(result.length,2);assert.equal(result.find(r=>r.id==='a').added_at,'2026-11-10T00:00:00Z');
});
test('archive uses real publication chronology across timezones and leaves undated research last',()=>{
 const rows=[{id:'undated',research_date:'2099-01-01'},{id:'sgt',added_at:'2026-11-14T08:00:00+08:00'},{id:'utc',added_at:'2026-11-14T01:00:00Z'},{id:'old',added_at:'2026-11-01T00:00:00Z',research_date:'2099-01-02'}].sort(Desk.archiveSort);
 assert.deepEqual(rows.map(r=>r.id),['utc','sgt','old','undated']);
});
test('research cutoff and verification time are not substituted for upload time',()=>{
 const rows=[{id:'new-source',research_date:'2026-11-14',verified_at:'2026-11-14T20:00:00Z'},{id:'old-paper-new-upload',uploaded_at:'2026-11-14T02:00:00Z',research_date:'2004-03-01'}].sort(Desk.archiveSort);
 assert.equal(rows[0].id,'old-paper-new-upload');
});
test('company matching is exact and source destinations deduplicate',()=>{
 const news=[{id:'a',href:'https://example.org/story',tickers:['GOOGL']},{id:'alias',href:'https://example.org/story#top',tickers:['GOOGL']},{id:'class-c',href:'https://example.org/goog',tickers:['GOOG']},{id:'evil',href:'javascript:evil()',tickers:['GOOGL']}];
 assert.deepEqual(Desk.matchNews(news,'GOOGL').map(n=>n.id),['a']);
 assert.equal(Desk.matchNews(news,'AAPL').length,0);
});
test('merged news remains newest-first and follows the selected company into research',()=>{
 const rows=Desk.matchNews([{id:'old',href:'https://example.org/old',published_at:'2026-11-05',tickers:['NVDA']},{id:'multi',href:'https://example.org/new',published_at:'2026-11-14',tickers:['MSFT','NVDA']},{id:'undated',href:'https://example.org/unknown',tickers:['NVDA']}],'NVDA');
 assert.deepEqual(rows.map(r=>r.id),['multi','old','undated']);
 assert.equal(Desk.newsResearchHref(rows[0],'NVDA'),'search.html?q=NVDA');
 assert.equal(Desk.newsResearchHref(rows[0],'all'),'search.html?q=MSFT');
});
test('charts retain zero values, escape labels and expose accessible meaning',()=>{
 const svg=Desk.spark([['2026-01-01',0],['2026-01-02',1]],'<USD>');
 assert(svg.includes('<svg'));assert(svg.includes('role="img"'));assert(svg.includes('&lt;USD&gt;'));assert(!svg.includes('NaN'));
 assert(!Desk.spark([['2026-01-01',1]],'USD').includes('<svg'));
});
test('charts fail closed for impossible and nonchronological dates',()=>{
 for(const points of [[['2026-99-01',1],['2026-99-02',2]],[['2026-01-01',1],['2026-01-03',2],['2026-01-02',3]],[['2026-01-01',1],['2026-01-01',2]]]){
  const result=Desk.spark(points,'USD');assert(!result.includes('NaN'));assert(!result.includes('<svg'));
 }
});
test('hourly company reading uses exact topic tokens and preserves unknown publisher times',()=>{
 const story={story_id:'tesla',headline:'Tesla invites customers',topic:'US / Tesla / Vehicles',source_urls:['https://www.reuters.com/tesla'],version:1};
 const edition={cutoff:'2026-11-14T16:00:00+08:00',coverage:'partial',stories:[story,{...story,story_id:'incidental',topic:'US / Apple pie / Food'}],sources:[]};
 const rows=DeskNews.fromHourly({editions:[edition]},[{ticker:'TSLA',name:'Tesla'},{ticker:'AAPL',name:'Apple'}]);
 assert.equal(rows.length,1);assert.deepEqual(rows[0].tickers,['TSLA']);assert.equal(rows[0].published_at,null);assert.equal(rows[0].edition_cutoff,edition.cutoff);
});
test('hourly revisions retain latest version and unsafe/private source URLs are excluded',()=>{
 const base={story_id:'a',headline:'Nvidia update',topic:'US / Nvidia',source_urls:['https://www.reuters.com/nvidia'],version:1};
 const rows=DeskNews.fromHourly({editions:[{stories:[base,{...base,version:2,headline:'Corrected Nvidia update'},{...base,story_id:'private',source_urls:['https://chatgpt.com/c/private']}],sources:[{url:'https://www.reuters.com/nvidia',published_date:'2026-11-14'}]}]},[{ticker:'NVDA',name:'Nvidia'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].version,2);assert.equal(rows[0].published_at,'2026-11-14');
});
test('current desk quotes follow shared BOS/Yahoo selection without loading chart history',()=>{
 let q={close:250,date:'2026-11-12',sourceLabel:'Bank of Singapore',current:true};
 const market={resolve:()=>({currency:'USD'}),currentQuote:()=>q,displayUnit:i=>i.currency,series:()=>{throw Error('History must be lazy');}};
 assert.equal(Desk.selectedPrice('AAPL',market).value,250);assert.equal(Desk.selectedPrice('AAPL',market).status_label,'Bank of Singapore');
 q={close:240,date:'2026-11-13',sourceLabel:'Yahoo Finance',current:true};assert.equal(Desk.selectedPrice('AAPL',market).status_label,'Yahoo Finance');assert.equal(Desk.selectedPrice('AAPL',market).as_of,'2026-11-13');
 q={...q,current:false};assert(Desk.selectedPrice('AAPL',market).status_label.includes('dated observation'));
 q={...q,close:null};assert.equal(Desk.selectedPrice('AAPL',market),null);
});
test('stock moves use a daily close before the calendar cutoff and reject coverage gaps',()=>{
 const daily=[['2025-10-22',25],['2026-03-30',50],['2026-04-23',80],['2026-04-30',100]];
 assert.equal(Desk.priceMove(daily,'2026-04-30',{days:7}),25);
 assert.equal(Desk.priceMove(daily,'2026-04-30',{months:1}),100);
 assert.equal(Desk.priceMove(daily,'2026-04-30',{months:6}),null);
 assert.equal(Desk.priceMove([...daily.slice(0,-1),['2026-05-31',100]],'2026-05-31',{months:1}),25);
 assert.equal(Desk.priceMove(daily,'2026-05-01',{days:7}),null);
});
test('company cards group exact tickers, open saved reading and keep source links inside the popup',()=>{
 const cards=require('../site/company-news-cards.js');
 const story={story_id:'nvda',headline:'Nvidia update',topic:'US / Nvidia',source_urls:['https://www.reuters.com/nvidia'],version:1,body:'Saved facts',analysis:'Saved analysis',watch_next:'Next disclosure',earlier:''};
 const rows=DeskNews.fromHourly({editions:[{cutoff:'2026-11-14T16:00:00+08:00',coverage:'partial',stories:[story],sources:[]}]},[{ticker:'NVDA',name:'Nvidia'}]);
 assert.deepEqual(cards.reading(rows[0]).map(p=>p[1]),['Saved facts','Saved analysis','Next disclosure']);
 assert.equal(cards.reading({title:'Metadata only'}).length,0,'no invented write-up for a headline');
 const html=cards.render(rows,[{ticker:'NVDA',name:'Nvidia'},{ticker:'AAPL',name:'Apple'}],'all');
 assert.equal((html.match(/class="company-news-card"/g)||[]).length,2);
 assert(html.includes('data-company-news="0"'));assert(!html.includes('href="https://www.reuters.com/nvidia"'));
 assert(html.includes('v4.html?company=NVDA#earnings'));
 const unsafe=cards.render([{...rows[0],title:'<img src=x onerror=evil()>'}],[{ticker:'NVDA',name:'Nvidia'}],'all');assert(!unsafe.includes('<img'));
});
test('home chart shortcuts preserve all real historical destinations and accessible icons',()=>{
 const nav=require('../site/history-navigation.js'),html=nav.html();
 assert.equal(nav.items.length,10);for(const route of ['historical-fred.html','fred-1.html','fred-2.html','fred-3.html'])assert(html.includes(route));assert(html.includes('v4.html#history/beta3-shares'));assert(html.includes('aria-hidden="true"'));assert(!html.includes('javascript:'));
});
test('history directory shares three groups and all15 routes across rail, toolbar and home',()=>{
 const fs=require('node:fs'),nav=require('../site/history-navigation.js');assert.deepEqual(nav.groups.map(g=>g.id),['bonds','shares','fred']);
 const all=nav.groups.flatMap(g=>g.items);assert.equal(all.length,15);assert.equal(new Set(all.map(i=>i[0])).size,15);
 const rail=nav.sidebar(),menu=nav.toolbar('yield'),home=nav.html();
 for(const rendered of [rail,menu,home])assert(rendered.indexOf('href="cross-market-history.html"') < rendered.indexOf('data-history-group=') && rendered.includes('href="cross-market-history.html"'));
 for(const item of all){assert(rail.includes('data-history-id="'+item[0]+'"'));assert(menu.includes(item[3]?'href="'+item[3]+'"':'data-tab="'+item[0]+'"'));assert(home.includes(item[3]||'v4.html#history/'+item[0]));}
 assert(menu.includes('data-active-group="true"'));assert(menu.includes('data-tab="yield" aria-pressed="true"'));assert(menu.includes('focusable="false"'));assert(rail.includes('id="rail-group-history"><a href="#history" data-view="history">History</a>'));
 const html=fs.readFileSync('site/v4.html','utf8');assert(html.includes(rail));assert(!html.includes('class="rail-subsection"><span>Fred-'));
 for(const p of ['v4.html','desk.html'])assert(fs.readFileSync('site/'+p,'utf8').includes('menu=20261116.groups1'));
});
test('main news leads the sidebar and contains Calls and My Blog once',()=>{
 const fs=require('node:fs'),html=fs.readFileSync('site/v4.html','utf8'),rail=html.slice(html.indexOf('<nav aria-label="Desktop navigation">'),html.indexOf('</nav><div class="rail-foot">'));
 assert(rail.startsWith('<nav aria-label="Desktop navigation"><div class="rail-group" role="group" aria-labelledby="rail-group-1">'));
 const main=rail.slice(0,rail.indexOf('<div class="rail-group rail-history"'));
 for(const view of ['overview','earnings','credit','policy','calls'])assert(main.includes('data-view="'+view+'"'));
 assert(main.includes('href="market-understanding/"'));assert(main.includes('My Blog'));
 assert.equal((rail.match(/data-view="calls"/g)||[]).length,1);assert.equal((rail.match(/href="market-understanding\/"/g)||[]).length,1);
 assert(!rail.includes('Research Explained'));
});
let failures=0;for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.message);}}
process.exitCode=failures?1:0;
