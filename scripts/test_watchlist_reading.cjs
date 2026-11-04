const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={URL,Date,Intl,Number,console,setInterval:()=>{},localStorage:{getItem:()=>null},document:{hidden:false,addEventListener:()=>{},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},fetch:async path=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('site/'+path,'utf8'))})};context.window=context;vm.createContext(context);
for(const f of ['watchlist-report-links.js','watchlist.js'])vm.runInContext(fs.readFileSync('site/'+f,'utf8'),context);
(async()=>{const w=context.MarketWatchlist;await w.refresh();let html=w.view();
assert.equal((html.match(/class="watchlist-return"/g)||[]).length,72);
for(const x of JSON.parse(fs.readFileSync('site/data/watchlist/identities.json')).identities)assert(html.includes('ISIN '+x.isin));
assert(html.includes('American depositary receipt'));assert(html.includes('Class A'));assert(html.includes('Class B'));
assert(!html.includes('Premarket not included'));assert(!html.includes('Not live, not premarket and not a return endpoint'));assert(!html.includes('no new verified item is not proof'));
const current=JSON.parse(fs.readFileSync('site/data/watchlist/latest.json'));const shared=new Set(current.rows.flatMap(r=>r.research||[]).filter(x=>/^Shared watchlist context:/i.test(x.headline||'')).map(x=>JSON.stringify(x)));assert.equal((html.match(/Shared watchlist context:/g)||[]).length,shared.size);assert(!html.includes('Active-session snapshot:'));
const latest=JSON.parse(fs.readFileSync('site/data/watchlist/latest.json'));
for(const t of ['MSFT','AVGO','MU']){const c=w.card(latest.rows.find(r=>r.ticker===t));assert(!c.includes('Dated research archive'));assert(!c.includes('Saved research editions'));}
const c=w.card(latest.rows.find(r=>r.ticker==='AMD'));assert(c.includes('source-number discrepancy'));assert(c.includes('$1.097 billion'));assert(c.includes('$1.07 billion'));assert(c.includes('discrepancy is unresolved'));assert(c.includes('<li>These are management forecasts, not realized results; supply, execution and customer concentration remain relevant.</li>')); // qualifying sentence remains intact
assert(c.includes('(within Market Intel)'));assert(c.includes('BOS-hosted PDF'));
await w.readEdition('watchlist-20261103T160000Z');html=w.readerView();assert(html.includes('12 companies · 04 Nov 2026'));assert(!html.includes('New results: Data Center'));assert(html.includes('Original archived edition'));
assert(!html.includes('Shared watchlist context:'));assert.equal((html.match(/class="watchlist-return"/g)||[]).length,72);
await assert.rejects(()=>w.readEdition('../secret'));await assert.rejects(()=>w.readEdition('watchlist-99991104T080000Z'));
const files=['site/data/watchlist/identities.json','site/data/watchlist/company-resources.json','site/data/watchlist/research-index.json','site/watchlist.js','site/watchlist-reader.js'];for(const p of files){const s=fs.readFileSync(p,'utf8');assert(!/libfile_|chatgpt\.com\/(?:c|g)\//.test(s));}
console.log('PASS concise watchlist reader: 12 verified identities, 72 horizons, meaningful-only company history, shared context once, material risk/number caveats, SGT midnight, immutable original links, safe routing');
})().catch(e=>{console.error(e);process.exit(1)});
