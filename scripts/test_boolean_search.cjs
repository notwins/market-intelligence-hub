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

assert(data.entries.filter(e=>e.kind==='Report').every(e=>e.href==='v1.html?view=archive'&&e.location.label.startsWith('V1')));
assert(data.entries.some(e=>e.kind==='Headline'&&e.location.label.includes('Daily archive')&&e.location.href==='v4.html#reports'));
