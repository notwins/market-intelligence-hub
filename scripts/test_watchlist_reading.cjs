const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=path=>JSON.parse(fs.readFileSync('site/'+path,'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
function reader(overrides={}){
 const context={URL,Date,Intl,Number,console,setInterval:()=>{},localStorage:{getItem:()=>null},document:{hidden:false,addEventListener:()=>{},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},fetch:async path=>({ok:true,json:async()=>Object.hasOwn(overrides,path)?clone(overrides[path]):read(path)})};context.window=context;vm.createContext(context);
 for(const f of ['watchlist-report-links.js','watchlist.js'])vm.runInContext(fs.readFileSync('site/'+f,'utf8'),context);
 return context;
}
const context=reader();
(async()=>{const w=context.MarketWatchlist;await w.refresh();let html=w.view();
assert.equal((html.match(/class="watchlist-return"/g)||[]).length,72);
for(const x of JSON.parse(fs.readFileSync('site/data/watchlist/identities.json')).identities)assert(html.includes('ISIN '+x.isin));
assert(html.includes('American depositary receipt'));assert(html.includes('Class A'));assert(html.includes('Class B'));
assert(!html.includes('Premarket not included'));assert(!html.includes('Not live, not premarket and not a return endpoint'));assert(!html.includes('no new verified item is not proof'));
const current=JSON.parse(fs.readFileSync('site/data/watchlist/latest.json'));const shared=new Set(current.rows.flatMap(r=>r.research||[]).filter(x=>/^Shared watchlist context:/i.test(x.headline||'')).map(x=>JSON.stringify(x)));assert.equal((html.match(/Shared watchlist context:/g)||[]).length,shared.size);assert(!html.includes('Active-session snapshot:'));
// Empty history is a fact at this immutable cutoff, not a permanent ticker property.
const historical=read('data/watchlist/archive/watchlist-20261104T080000Z.json');
const historicalIndex=read('data/watchlist/index.json');historicalIndex.editions=historicalIndex.editions.filter(e=>Date.parse(e.as_of)<=Date.parse(historical.as_of));
const historicalReports=read('data/watchlist/report-index.json');historicalReports.reports=historicalReports.reports.filter(r=>Date.parse(r.as_of)<=Date.parse(historical.as_of));
const fixture={
 'data/watchlist/latest.json':historical,
 'data/watchlist/index.json':historicalIndex,
 'data/watchlist/report-index.json':historicalReports,
 'data/watchlist/research-index.json':read('data/watchlist/research-index.json')
};
const past=reader(fixture).MarketWatchlist;await past.refresh();
for(const t of ['MSFT','AVGO','MU']){const c=past.card(historical.rows.find(r=>r.ticker===t));assert(!c.includes('Dated research archive'));assert(!c.includes('Saved research editions'));}

// A reviewed addition must become visible, without weakening the review or cutoff gates.
const newId='watchlist-20261104T100000Z',newAsOf='2026-11-04T10:00:00Z';
const item={headline:'Fixture: newly verified Microsoft research',date:'2026-11-04',facts:['A source-checked Microsoft fact.'],analysis:'Dated analysis.',risks:'Material qualification.',next_watch:'Next issuer disclosure.',sources:[{title:'Microsoft issuer source',url:'https://www.microsoft.com/en-us/Investor/'}]};
const nextEdition=clone(historical);Object.assign(nextEdition,{id:newId,as_of:newAsOf,generated_at:newAsOf});nextEdition.rows.find(r=>r.ticker==='MSFT').research=[item];
const added=clone(fixture);added['data/watchlist/latest.json']=nextEdition;
added['data/watchlist/archive/'+newId+'.json']=nextEdition;
added['data/watchlist/index.json'].editions.unshift({id:newId,as_of:newAsOf,path:'data/watchlist/archive/'+newId+'.json'});
added['data/watchlist/report-index.json'].reports.unshift({...historicalReports.reports[0],edition_id:newId,as_of:newAsOf,path:'data/watchlist/reports/'+newId+'.html'});
added['data/watchlist/research-index.json'].editions[newId]={MSFT:[{index:0,scope:'company',headline:item.headline,content_key:context.MarketWatchlistReports.contentKey(item),item_sha256:'a'.repeat(64)}]};
const approved=reader(added).MarketWatchlist;await approved.refresh();
const microsoft=nextEdition.rows.find(r=>r.ticker==='MSFT'),approvedCard=approved.card(microsoft);
assert(approvedCard.includes('Dated research archive (1)'));assert(approvedCard.includes('Saved research editions (1)'));
assert.equal((approvedCard.match(/<h4>Fixture: newly verified Microsoft research<\/h4>/g)||[]).length,1);
assert(approvedCard.includes('Material qualification.'));assert(approvedCard.includes('watchlist-report.html?edition='+newId+'#MSFT'));
const older=clone(added);older['data/watchlist/latest.json']=historical;
const bounded=reader(older).MarketWatchlist;await bounded.refresh();
assert(!bounded.card(microsoft).includes('Dated research archive'));assert(!bounded.card(microsoft).includes('Saved research editions'));
for(const mode of ['missing review','changed facts','market context']){
 const rejected=clone(added);
 if(mode==='missing review')delete rejected['data/watchlist/research-index.json'].editions[newId].MSFT;
 if(mode==='changed facts')for(const path of ['data/watchlist/latest.json','data/watchlist/archive/'+newId+'.json'])rejected[path].rows.find(r=>r.ticker==='MSFT').research[0].facts.push('Unreviewed changed fact.');
 if(mode==='market context')rejected['data/watchlist/research-index.json'].editions[newId].MSFT[0].scope='market_context';
 const closed=reader(rejected).MarketWatchlist;await closed.refresh();const card=closed.card(microsoft);
 assert(!card.includes('Dated research archive'),mode);assert(!card.includes('Saved research editions'),mode);assert(!card.includes(item.headline),mode);
 if(mode==='market context')assert.equal((closed.view().match(/Fixture: newly verified Microsoft research/g)||[]).length,1,'Shared context stays outside company history');
 else{assert(closed.view().includes('Some narratives await a matching content review'),mode);assert(closed.view().includes('watchlist-report.html?edition='+newId),mode);}
}
const c=past.card(historical.rows.find(r=>r.ticker==='AMD'));assert(c.includes('source-number discrepancy'));assert(c.includes('$1.097 billion'));assert(c.includes('$1.07 billion'));assert(c.includes('discrepancy is unresolved'));assert(c.includes('<li>These are management forecasts, not realized results; supply, execution and customer concentration remain relevant.</li>')); // Historical qualifications and source labels remain intact as new editions arrive.
assert(c.includes('(within Market Intel)'));assert(c.includes('BOS-hosted PDF'));
await w.readEdition('watchlist-20261103T160000Z');html=w.readerView();assert(html.includes('12 companies · 04 Nov 2026'));assert(!html.includes('New results: Data Center'));assert(html.includes('Original archived edition'));
assert(!html.includes('Shared watchlist context:'));assert.equal((html.match(/class="watchlist-return"/g)||[]).length,72);
await assert.rejects(()=>w.readEdition('../secret'));await assert.rejects(()=>w.readEdition('watchlist-99991104T080000Z'));
const files=['site/data/watchlist/identities.json','site/data/watchlist/company-resources.json','site/data/watchlist/research-index.json','site/watchlist.js','site/watchlist-reader.js'];for(const p of files){const s=fs.readFileSync(p,'utf8');assert(!/libfile_|chatgpt\.com\/(?:c|g)\//.test(s));}
console.log('PASS concise watchlist reader: 12 verified identities, 72 horizons, meaningful-only company history, shared context once, material risk/number caveats, SGT midnight, immutable original links, safe routing');
})().catch(e=>{console.error(e);process.exit(1)});

// Exact V1.2 Merged company palette, scoped to clickable watchlist headings.
const tickerCSS=fs.readFileSync('site/watchlist.css','utf8');
const tickerPalettes=[
 [['AAPL','MSFT','GOOGL','AMZN','TSLA'],'#0369A1','#7DD3FC','#F0F9FF','#082F49'],
 [['NVDA','AMD','AVGO','MU','TSM'],'#6D28D9','#DDD6FE','#F5F3FF','#2E1065'],
 [['META'],'#86198F','#F0ABFC','#FDF4FF','#4A044E'],
 [['BRK.B'],'#1E40AF','#BFDBFE','#DBEAFE','#172554']
];
const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const [tickers,light,dark,lightChip,darkChip] of tickerPalettes){
 const declarations=`--ticker-light:${light};--ticker-dark:${dark};--ticker-chip-light:${lightChip};--ticker-chip-dark:${darkChip}`;
 const rule=tickerCSS.split('\n').find(line=>line.includes(declarations));assert(rule,'Exact approved palette');
 for(const t of tickers)assert(rule.includes(`.watchlist-card[data-ticker="${t}"]`),'Exact ticker mapping: '+t);
 assert(contrast(light,lightChip)>=4.5);assert(contrast(dark,darkChip)>=4.5);
}
assert.equal((tickerCSS.match(/--ticker-light:/g)||[]).length,4,'No inferred assignments');
for(const selector of ['.watchlist-card[data-ticker] .watchlist-company h3','.watchlist-scope[data-theme="dark"]','.watchlist-scope[data-theme="system"]','@media(prefers-color-scheme:dark)'])assert(tickerCSS.includes(selector));
assert(tickerCSS.includes('min-height:44px;max-width:100%'));assert(tickerCSS.includes('border:1px solid currentColor'));
for(const file of ['v4.html','watchlist-report.html'])assert(fs.readFileSync('site/'+file,'utf8').includes('watchlist.css?v=20261107.ticker1'));
console.log('PASS exact approved ticker colours: 12 names, light/dark AA contrast, scoped selectors, visible controls and cache version');
