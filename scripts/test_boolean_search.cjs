const assert=require('node:assert/strict'),fs=require('node:fs');
const Q=require('../site/search-query.js'),UI=require('../site/site-search.js');
const fixtures=[
 {id:'g',title:'Alphabet earnings',text:'Google cloud',tags:['GOOGL','Earnings'],kind:'Headline'},
 {id:'m',title:'Microsoft cloud',text:'MSFT earnings',tags:['MSFT'],kind:'Hourly story'},
 {id:'a',title:'Amazon AMZN',text:'Retail earnings',tags:['AMZN'],kind:'Report'},
 {id:'gm',title:'Google and Microsoft',text:'AI partnerships',tags:[],kind:'Headline'},
 {id:'ga',title:'GOOGL and Amazon',text:'Cloud competitors',tags:[],kind:'Headline'},
 {id:'gma',title:'Alphabet, MSFT, AMZN',text:'Government bonds and interest rates',tags:['Government bonds'],kind:'Research edition'},
 {id:'x',title:'Other company',text:'MSFT in a saved paragraph; literal AND OR NOT',tags:['Singapore'],kind:'Security master'},
 {id:'none',title:'A smile, not a company',text:'alphabetical metamorphosis apples',tags:[],kind:'Page'}
];
const ids=q=>Q.search(fixtures,q).map(e=>e.id).sort();
assert.deepEqual(ids('Google'),['g','ga','gm','gma']);
assert.deepEqual(ids('googl'),ids('Google'));assert.deepEqual(ids('Alphabet'),ids('Google'));
assert.deepEqual(ids('MSFT'),ids('Microsoft'));assert.deepEqual(ids('AMZN'),ids('Amazon'));
assert.deepEqual(ids('Google Or Msft'),['g','ga','gm','gma','m','x']);
assert.deepEqual(ids('Google and (Msft or AMZN)'),['ga','gm','gma']);
assert.deepEqual(ids('Google OR MSFT AND AMZN'),['g','ga','gm','gma']);
assert.deepEqual(ids('(Google OR MSFT) AND AMZN'),['ga','gma']);
assert.deepEqual(ids('Google NOT MSFT'),['g','ga']);
assert.deepEqual(ids('NOT (Google OR Amazon)'),['m','none','x']);
assert.deepEqual(ids('Google MSFT'),['gm','gma']);
assert.deepEqual(ids('tag:GOOGL AND text:earnings'),['g']);
assert.deepEqual(ids('tag:"Government bonds"'),['gma']);
assert.deepEqual(ids('text:"interest rates"'),['gma']);
assert.deepEqual(ids('"AND OR NOT"'),['x']);
assert.deepEqual(ids('tag:Singapore'),['x']);assert.deepEqual(ids('text:Singapore'),[]);
assert.deepEqual(ids('Google(foo OR AMZN)'),['ga','gma']);
assert.deepEqual(ids('text:“interest rates”'),['gma']);
assert.equal(Q.search(fixtures,'MSFT','','articles').length,3);
assert.equal(Q.search(fixtures,'','Headline').length,3);
assert.equal(Q.search(fixtures,'').length,fixtures.length);
assert.equal(Q.search(fixtures,'(doesnotexist)').length,0);
assert.deepEqual(ids('Apple'),[]);assert.deepEqual(ids('Meta'),[]);
for(const bad of ['Google AND','OR Google','Google OR OR MSFT','(Google','Google)','()','Google AND ()','"Google','tag:','tag:()','Google AND OR MSFT','NOT',')Google(', '('.repeat(40)+'Google'+')'.repeat(40),'NOT '.repeat(40)+'Google','x'.repeat(2001)])assert.throws(()=>Q.parse(bad),undefined,bad);
assert.equal(Q.appendTag('Google OR MSFT','AMZN','AND'),'(Google OR MSFT) AND tag:"Amazon"');
assert.deepEqual(ids(Q.appendTag('Google OR MSFT','AMZN','AND')),['ga','gma']);
assert.equal(Q.appendTag('','Google'),'tag:"Google"');
assert.deepEqual(ids(Q.appendTag('Google','MSFT','OR')),ids('Google OR MSFT'));
for(const x of ['javascript:alert(1)','//evil.test','https://user:pass@example.com','../secret.html','path/../secret.html','path/./file.html','https://example.com\\evil'])assert.equal(UI.safe(x),null,x);
assert.equal(UI.safe('market-understanding/#mu-interest'),'market-understanding/#mu-interest');
assert.equal(UI.safe('data/watchlist/reports/watchlist-20261104T080000Z.html#GOOGL'),'data/watchlist/reports/watchlist-20261104T080000Z.html#GOOGL');
// All three requested company sets and Boolean truth-table combinations.
for(let bits=0;bits<8;bits++){
 const e={title:['Google','Microsoft','Amazon'].filter((_,i)=>bits&(1<<i)).join(' '),text:'',tags:[]};
 assert.equal(Q.match(Q.parse('Google AND (MSFT OR AMZN)').tree,e),!!((bits&1)&&((bits&2)||(bits&4))));
 assert.equal(Q.match(Q.parse('Google OR MSFT AND AMZN').tree,e),!!((bits&1)||((bits&2)&&(bits&4))));
 assert.equal(Q.match(Q.parse('NOT Google AND (MSFT OR AMZN)').tree,e),!!(!(bits&1)&&((bits&2)||(bits&4))));
}
const data=JSON.parse(fs.readFileSync('site/data/site-search.json'));
assert(data.entries.every(e=>e.location?.label&&Array.isArray(e.tags)));
assert(data.entries.filter(e=>e.kind==='Watchlist research'&&e.href).every(e=>e.location.href===e.href&&e.location.exact));
assert.equal(Q.search(data.entries,'Google').length,Q.search(data.entries,'GOOGL').length);
assert(Q.search(data.entries,'Google OR MSFT').length>=Q.search(data.entries,'Google').length);
assert(Q.search(data.entries,'Google AND (MSFT OR AMZN)').length);
assert(data.entries.every(e=>!e.location.href||UI.safe(e.location.href)), 'All location links must be usable');
console.log('PASS Boolean precedence, nested groups, aliases, exact phrases, text/tag fields, implicit AND, NOT, malformed input, bounds, safe links, article filtering, tag composition and every indexed location');

assert(data.entries.filter(e=>e.kind==='Report').every(e=>e.href.startsWith('archive.html?report=')&&e.location.href===e.href&&e.location.exact&&e.location.label.startsWith('Research archive')));
assert(data.entries.some(e=>e.kind==='Headline'&&e.location.label.includes('Daily archive')&&e.location.href.startsWith('archive.html?day=')&&e.location.exact));

for(const url of ['https://chatgpt.com/c/private-id','https://chatgpt.com/g/g-project/c/private-id','https://chat.openai.com/c/private-id','https://chatgpt.com/%63/private-id'])assert.equal(UI.safe(url),null);
assert(data.entries.every(e=>!e.source||!/^https:\/\/(?:chatgpt\.com|chat\.openai\.com)\/(?:c|g)\//.test(e.source)));
assert(data.entries.some(e=>e.source_access==='restricted'));
const catalogueText=JSON.stringify(data);for(const prefix of ['https://chatgpt.com/c/','https://chatgpt.com/g/','https://chat.openai.com/c/'])assert(!catalogueText.includes(prefix));

// Structured reading uses saved fields, renders sentence bullets and escapes all text.
const story=data.entries.find(e=>e.kind==='Hourly story'&&e.title.includes('UOB lowers'));
assert(story&&story.reading.length>=3);assert.equal(story.reading[0].label,'What happened');assert(story.reading[0].text.includes('S$1.25 billion'));assert(UI.brief(story).includes('Saved analysis'));assert(UI.brief(story).includes('What to watch'));assert(UI.brief(story).includes('Original indexed text'));
const reading=UI.readingHTML([{label:'<script>','text':'First saved point. Second saved point.'}]);assert(reading.includes('&lt;script&gt;'));assert(reading.includes('<ul>'));assert.equal((reading.match(/<li>/g)||[]).length,2);assert(!UI.readingHTML([{label:'x',text:'<img onerror=bad>'}]).includes('<img'));
assert.equal(UI.brief({text:'metadata only'}),'');assert(data.entries.filter(e=>e.kind==='Research library').every(e=>e.reading.length===2));
console.log('PASS structured saved summaries, existing analysis/watch context, sentence bullets, fallback and escaping');

assert.equal(UI.summaryExcerpt('First fact. Second fact. Third fact.'),'First fact. Second fact. …');assert.equal(UI.summaryExcerpt('One fact, with its qualification; not a live quote.'),'One fact, with its qualification; not a live quote.');

const stats=UI.tagStats(data.entries);for(const item of stats.slice(0,20))assert.equal(item.count,Q.search(data.entries,'tag:'+JSON.stringify(item.tag)).length);assert(stats.slice(0,16).some(x=>x.tag==='Nvidia'));assert(stats.some(x=>x.tag==='Google'&&x.articles>0));
assert.deepEqual(UI.insertRule('Google',6,6,'AND'),{query:'Google AND ',caret:11});
assert.deepEqual(UI.insertRule('Google',6,6,'text:'),{query:'Google AND text:',caret:16});
assert.equal(UI.insertRule('Google AND ',11,11,'text:').query,'Google AND text:');
assert.equal(UI.insertRule('Google OR MSFT',10,14,'text:').query,'Google OR text:"MSFT" ');
assert.equal(UI.insertRule('Google MSFT',7,7,'AND').query,'Google AND MSFT');
assert.equal(UI.insertRule('',0,0,'OR').query,'');assert.equal(UI.insertRule('Google',6,6,'bad').query,'Google');
assert.equal(UI.insertRule('Google',6,6,'text:','OR').query,'Google OR text:');
assert(Q.parse(UI.insertRule('Google OR MSFT',10,14,'text:').query).tree);
console.log('PASS real tag frequencies, company options, operator insertion at caret, selection wrapping, spacing, text-prefix completion and parser preservation');
