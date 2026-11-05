const fsCalls=require('node:fs'),vmCalls=require('node:vm'),assertCalls=require('node:assert/strict');
function callsContext(payload){
 const ctx={URL,Date,Number,console,setInterval:()=>{},localStorage:{getItem:()=>null,setItem(){}},document:{hidden:false,addEventListener(){},getElementById(){},querySelector(){},querySelectorAll:()=>[]},fetch:async p=>({ok:true,json:async()=>p==='data/watchlist/calls.json'?payload:JSON.parse(fsCalls.readFileSync('site/'+p,'utf8'))})};ctx.window=ctx;vmCalls.createContext(ctx);vmCalls.runInContext(fsCalls.readFileSync('site/watchlist-report-links.js','utf8'),ctx);vmCalls.runInContext(fsCalls.readFileSync('site/watchlist.js','utf8'),ctx);ctx.MarketWatchlist.connect(()=>{});return ctx;
}
(async()=>{
 const payload=JSON.parse(fsCalls.readFileSync('site/data/watchlist/calls.json','utf8'));
 const ctx=callsContext(payload);await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));
 const html=ctx.MarketWatchlist.callsView();
 for(const c of payload.calls.filter(x=>x.schema_version===2)){
  assertCalls(html.includes(c.call_type));assertCalls(html.includes('href="'+c.report.html_path+'"'));assertCalls(html.includes(c.ticker));
 }
 assertCalls(html.includes('Historical report:'));assertCalls(!html.includes('Call made:'));assertCalls(html.includes('Read Google research'));
 const empty=callsContext({schema_version:1,calls:[]});await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));assertCalls(empty.MarketWatchlist.callsView().includes('Personal calls: no public entries.'));
 const bad=JSON.parse(JSON.stringify(payload));bad.calls[0].report.html_path='javascript:alert(1)';bad.calls[0].summary='<img src=x onerror=1>';const safe=callsContext(bad);await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));const sh=safe.MarketWatchlist.callsView();assertCalls(!sh.includes('href="javascript:'));assertCalls(!sh.includes('<img'));assertCalls(sh.includes('&lt;img'));assertCalls(sh.includes('Full report link unavailable.'));
 console.log('PASS dated Calls reviews, ETF instruments, safe static report links, empty state and HTML escaping');
})().catch(e=>{console.error(e);process.exitCode=1;});
