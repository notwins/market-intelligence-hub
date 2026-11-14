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
let failures=0;for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.message);}}
process.exitCode=failures?1:0;
