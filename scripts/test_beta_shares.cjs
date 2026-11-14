const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('site/beta-shares.js','utf8');
const colours=require('../site/publication-colour-core.js');
const catalogue=JSON.parse(fs.readFileSync('site/data/publication-colour-catalogue.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('site/data/beta-shares.json','utf8'));
const years=['2019','2020','2021','2022','2023','2024','2025','2026'];
const rows=Array.from({length:32},(_,n)=>({id:'id'+n,bbTicker:'TEST'+n+' US',name:'Company '+String(n).padStart(2,'0'),isin:'ISIN'+n,sector:n%2?'Financials':'Information Technology',industry:n%2?'Banks':'Software',snapshot:{marketCap:n===1?1e20:3},returns:{calendar:Object.fromEntries(years.slice(0,-1).map(y=>[y,n-5])),ytd:{'2026':n===1?null:n-3}},credit:[]}));
Object.assign(rows[0],{bbTicker:'NVDA US',name:'NVIDIA Corp',industry:'Semiconductors & Semiconductor',returns:structuredClone(snapshot.records.find(r=>r.bbTicker==='NVDA US').returns),credit:[{agency:'Fitch',scope:'Senior unsecured debt',raw:'WD',status:'withdrawn'}]});
rows[2].name='<img src=x onerror=alert(1)>';
const original=JSON.stringify(rows);
const caps=new Map(rows.map((r,n)=>[r.id,n===1?null:(n+1)*100]));
let quoteGeneration=1;
const shared={
 load:async()=>rows,records:()=>rows.slice(),metadata:()=>({returnCutoff:'2026-09-19'}),
 returnsFor:r=>years.map(y=>({year:Number(y),label:y==='2026'?'2026 YTD':y,value:y==='2026'?r.returns.ytd[y]:r.returns.calendar[y],derived:y!=='2026'})),
 marketCapFor:r=>caps.get(r.id)===null?null:{value:caps.get(r.id),marketCapUsdMillions:caps.get(r.id),asOf:'2026-11-12',current:true},
 compareMarketCap:(a,b)=>{const x=caps.get(a.id),y=caps.get(b.id);return x===null?y===null?0:1:y===null?-1:y-x;},
 quoteFor:r=>({close:quoteGeneration*500,date:quoteGeneration===1?'2026-11-13':'2026-11-14',currency:'USD',sourceLabel:'BOS <verified>',sourceUrl:'https://example.com/coverage.pdf',current:true})
};
function environment(api=shared,fetcher=async()=>({ok:true,json:async()=>catalogue})){
 const documentListeners={},hostListeners={};
 const host={innerHTML:'',isConnected:true,contains:()=>true,addEventListener:(n,f)=>hostListeners[n]=f,removeEventListener:n=>delete hostListeners[n],querySelectorAll:()=>[]};
 const ctx={console,URL,Date,Set,Map,ShareEnrichment:api,PublicationColour:colours,fetch:fetcher,location:{href:'https://notwins.github.io/market-intelligence-hub/v4.html'},document:{activeElement:null,addEventListener:(n,f)=>(documentListeners[n]??=[]).push(f)}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 function target(dataset={},extra={}){return {...extra,dataset,matches(selector){const m=selector.match(/^\[data-beta-(.*?)\]$/);if(!m)return false;const k='beta'+m[1].replace(/(^|-)([a-z])/g,(_,dash,c)=>c.toUpperCase());return k in dataset;},closest(selector){return this.matches(selector)?this:null;}};}
 const dispatch=(name,dataset,extra)=>hostListeners[name]({target:target(dataset,extra)});
 return {ctx,host,dispatch,documentListeners,hostListeners};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const {ctx,host,dispatch,documentListeners}=environment();const B=ctx.BetaShares;
 B.mount(host);await settle();
 assert(host.innerHTML.includes('data-table-controls="off"'),'generic per-page sorting is disabled');
 assert(host.innerHTML.includes('data-beta-view="table" aria-pressed="true"'),'table heatmap is default');
 assert.equal((host.innerHTML.match(/data-beta-select=/g)||[]).length,25,'first page shows 25');
 assert(host.innerHTML.indexOf('Select Company 31')<host.innerHTML.indexOf('Select Company 30'),'default order uses global USD cap descending');
 assert(!host.innerHTML.includes('Select Company 01'),'unmatched local-currency cap is not used to rank a share');
 dispatch('click',{betaAction:'next'});assert.equal((host.innerHTML.match(/data-beta-select=/g)||[]).length,7);assert(host.innerHTML.includes('26–32 of 32 shares'));
 assert(host.innerHTML.indexOf('Select NVIDIA Corp (NVDA US)')<host.innerHTML.indexOf('Select Company 01'),'missing USD caps stay last');
 dispatch('change',{betaPageSize:''},{value:'0'});assert.equal((host.innerHTML.match(/data-beta-select=/g)||[]).length,32,'all-filtered removes pagination limit');
 assert(host.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));assert(!host.innerHTML.includes('<img src=x'));
 assert(host.innerHTML.includes('BOS &lt;verified&gt;'),'current quote source is escaped');
 assert(host.innerHTML.includes('Current prices and market caps have their own dates.'));
 assert(host.innerHTML.includes('((1 + older holding-period return / 100) / (1 + following-year holding-period return / 100) − 1) × 100'),'displayed methodology explicitly converts source percentage inputs');
 assert(host.innerHTML.includes('2026 year-to-date'),'partial year is explicit in sorting label');
 assert(host.innerHTML.includes('aria-label="Select NVIDIA Corp (NVDA US) for comparison"'));
 assert(host.innerHTML.includes('bs-unavailable" title="2026 YTD: unavailable">—'),'missing is a dash, not zero');
 for(let i=0;i<6;i++)dispatch('change',{betaSelect:'id'+i},{checked:true});
 assert(host.innerHTML.includes('<b>6 / 6 selected</b>'));
 dispatch('change',{betaSelect:'id6'},{checked:true});assert(host.innerHTML.includes('Six shares are already selected'));
 assert(host.innerHTML.includes('<b>6 / 6 selected</b>'),'seventh synthetic event cannot bypass limit');
 dispatch('click',{betaView:'chart'});assert.equal((host.innerHTML.match(/class="bs-chart-card"/g)||[]).length,6);
 assert(host.innerHTML.includes('bs-zero'));assert(host.innerHTML.includes('bs-ytd-bar'));
 assert(host.innerHTML.includes('All charts share one scale'));
 assert(host.innerHTML.includes('+38.9157%'),'NVDA shows derived 2025 year return, not source annualized34.35603 or cumulative65.94717');
 assert(!host.innerHTML.includes('NaN')&&!host.innerHTML.includes('Infinity'));
 assert.equal(B.identity(rows[0]).id,'ticker.nvidia_nvda');
 assert.notEqual(B.identity({...rows[4],industry:'Computer Hardware'}).id,'sector.semiconductors','broad IT is not mislabeled semiconductors');
 const bounds=B.axis([rows[0]]);assert(bounds.min<0&&bounds.max>0,'negative and positive returns share a visible zero');
 const svg=B.chartSvg(rows[0],bounds);assert(svg.includes('2022: -50.3%'));assert(svg.includes('2026 YTD through 19 Sep: +19.5%'));
 const yearXs=[...svg.matchAll(/class="bs-year" x="([0-9.]+)"/g)].map(m=>Number(m[1]));assert.equal(yearXs.length,8);assert(yearXs.every((x,i)=>i===0||x-yearXs[i-1]>4*24*.6),'mobile 24px year labels have distinct horizontal space');
 const extremeSvg=B.chartSvg(rows[0],{min:-200,max:1000,step:200}),leftAxis=[...extremeSvg.matchAll(/<text x="([0-9.]+)" y="[0-9.]+" text-anchor="end">([^<]+)<\/text>/g)];assert(leftAxis.length>1);assert(leftAxis.every(m=>Number(m[1])-m[2].length*22*.6>=0),'mobile percentage labels fit the reserved left axis margin');
 dispatch('input',{betaSearch:''},{value:'TEST31'});assert(host.innerHTML.includes('1–1 of 1 shares'));assert.equal((host.innerHTML.match(/class="bs-chart-card"/g)||[]).length,6,'search preserves comparison selection');
 dispatch('click',{betaRemove:'id0'});assert(host.innerHTML.includes('<b>5 / 6 selected</b>'));
 dispatch('click',{betaAction:'clear'});assert(host.innerHTML.includes('Choose shares to compare'));assert(host.innerHTML.includes('<b>0 / 6 selected</b>'));
 dispatch('click',{betaView:'cards'});assert.equal((host.innerHTML.match(/class="bs-card"/g)||[]).length,1);
 dispatch('input',{betaSearch:''},{value:'NVDA'});assert(host.innerHTML.includes('Fitch · Senior unsecured debt'));assert(host.innerHTML.includes('WD · withdrawn'));assert(host.innerHTML.includes('Rating dates were not supplied'));
 const returnsBefore=host.innerHTML.match(/<dl class="bs-card-returns">(.*?)<\/dl>/s)[1];
 quoteGeneration=2;documentListeners['market-prices-updated'][0]();assert(host.innerHTML.includes('1,000'));assert(host.innerHTML.includes('2026-11-14'));assert.equal(host.innerHTML.match(/<dl class="bs-card-returns">(.*?)<\/dl>/s)[1],returnsBefore,'quote refresh leaves historical returns intact');
 dispatch('input',{betaSearch:''},{value:'no-match'});assert(host.innerHTML.includes('No shares match these filters'));
 dispatch('click',{betaAction:'reset'});dispatch('change',{betaSector:''},{value:'Financials'});assert(host.innerHTML.includes('1–16 of 16 shares'));assert.equal((host.innerHTML.match(/class="bs-card"/g)||[]).length,16);
 dispatch('change',{betaSector:''},{value:''});dispatch('change',{betaSort:''},{value:'cap-asc'});assert(host.innerHTML.indexOf('Select NVIDIA Corp')<host.innerHTML.indexOf('Select Company 31'));assert(host.innerHTML.indexOf('Select Company 31')<host.innerHTML.indexOf('Select Company 01'),'ascending cap still leaves missing last');
 dispatch('click',{betaView:'table'});dispatch('click',{betaSortYear:'2025'});assert(host.innerHTML.includes('aria-sort="descending"'));assert(host.innerHTML.indexOf('Select NVIDIA Corp')<host.innerHTML.indexOf('Select Company 31'),'year sort uses annual returns globally');
 dispatch('click',{betaSortYear:'2025'});assert(host.innerHTML.includes('aria-sort="ascending"'));
 assert.equal(JSON.stringify(rows),original,'render, sorting, selection and quotes do not mutate source records');
 B.unmount();
 const failure=environment({load:async()=>{throw Error('Snapshot offline');},records:()=>[]});failure.ctx.BetaShares.mount(failure.host);await settle();assert(failure.host.innerHTML.includes('role="alert">Snapshot offline'));assert(failure.host.innerHTML.includes('Retry snapshot'));
 console.log('PASS Beta Shares global cap/year sorting, full filter pagination, six-share selection, chart/card/table interactions, semantic colours, missing returns, scoped credit, safe text and separate live quotes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
