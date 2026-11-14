'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../site/publication-colour-core.js');
const cat=JSON.parse(fs.readFileSync('site/data/publication-colour-catalogue.json','utf8')),tags=C.index(cat);
assert.equal(Object.keys(tags).length,437);
assert.equal(cat.explicit_company_tokens.NVDA,'ticker.nvidia_nvda');
assert.deepEqual(C.infer('NVDA DE GOOG',cat),[]); // Metadata lookup does not relax prose guards.
for(const text of ['Feed FedEx USD BOC DE NOW on a table','apple fruit and shell commands'])assert.deepEqual(C.infer(text,cat),[]);
assert(C.matches('President Trump speaks',cat).every(m=>!m.text.includes('President')));
assert(C.infer('United States fixed income and Federal Reserve policy',cat).includes('geo.united_states'));
const ids=C.infer('NVIDIA Corporation shares and fixed income in Singapore',cat);
assert(ids.includes('ticker.nvidia_nvda'));assert(ids.includes('geo.singapore'));assert(ids.length<=5);
const longest=C.matches('Singapore Airlines shares',cat);assert.equal(longest.length,1);assert.equal(longest[0].id,'ticker.singapore_airlines_c6l');
const html=C.chips([...ids,...ids],tags);assert.equal((html.match(/data-mih-tag=/g)||[]).length,ids.length);assert(!html.includes('<dialog'));assert(html.includes('search.html?q='));
const highlighted=C.highlighted('NVIDIA Corporation shares. NVIDIA Corporation revenue. Singapore fixed income.',ids,cat);
assert.equal((highlighted.match(/data-mih-tag="ticker.nvidia_nvda"/g)||[]).length,1);assert((highlighted.match(/class="mih-colour-term"/g)||[]).length<=3);
assert(C.highlighted('<script>alert(1)</script>',ids,cat).includes('&lt;script&gt;'));assert(!C.chips(['bad'],{bad:{label:'bad',text:'red'}}));
assert.equal(C.link(tags['ticker.alphabet_googl'],'NASDAQ:GOOG',cat),'https://www.morningstar.com/stocks/xnas/goog/quote');
assert.equal(C.link(tags['ticker.alphabet_googl'],'NASDAQ:GOOGL',cat),'https://www.morningstar.com/stocks/xnas/googl/quote');
assert(C.link(tags['ticker.alphabet_googl'],'Alphabet',cat).includes('search.html'));
if(fs.existsSync('site/search-query.js')){
 const Q=require('../site/search-query.js'),t=tags['ticker.nvidia_nvda'];
 const query=new URL(C.searchHref(t)).searchParams.get('q');
 assert.equal(Q.search([{title:'Nvidia research',tags:[t.label],kind:'Research edition',text:'',date:'2026-11-14'}],query).length,1);
}
const R=require('../site/research-feed.js');
const records=Array.from({length:10},(_,i)=>({id:'synthetic-'+i+'-2026-11-15',title:'Synthetic test '+i,summary:'No market claim',category:'Research',tags:ids,cutoff_sgt:'2026-11-15T00:00:00+08:00',full_report_url:'research/test-'+i+'/index.html',quick_read:null}));
const cards=R.cards(records,tags);assert.equal((cards.match(/data-feed-report=/g)||[]).length,10);assert.equal(R.cards([],tags),'');assert.equal(R.cards(records,tags),cards);assert(!cards.includes('<dialog'));
console.log('PASS 437 tags, conservative matching, alias overlap, link escaping, security classes, 0/10 cards and repeat rendering');
