'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
async function historyRefreshChecks(){
 let fail=false,hold=false,release,gate,calls=[];
 const handlers={},slot={innerHTML:''};
 const window={document:{getElementById:()=>slot,addEventListener:(n,f)=>handlers[n]=f},fetch:async p=>{
  calls.push(p);if(fail)throw Error('offline');if(hold&&p.includes('ust-curves-history/'))await gate;
  return {ok:true,json:async()=>JSON.parse(read('site/'+p))};
 }};
 vm.runInNewContext(read('site/market-snapshot.js'),{window,URL,Intl,Date});
 const M=window.MarketSnapshot;
 await M.mount();fail=true;await M.refresh();fail=false;calls=[];
 await M.loadYears();
 a.ok(calls.some(p=>p.includes('/2021.json')),'failed refresh must retain the dataset needed for older-history loading');
 // Select Years after the refresh has already selected its recent-history files.
 handlers.click({target:{closest:q=>q==='[data-ms-group]'?{dataset:{msGroup:'days'}}:null}});
 gate=new Promise(r=>release=r);hold=true;calls=[];
 const pending=M.refresh();await new Promise(r=>setImmediate(r));
 a.ok(calls.some(p=>p.includes('ust-curves-history/')),'refresh reached its history request phase');
 handlers.click({target:{closest:q=>q==='[data-ms-group]'?{dataset:{msGroup:'years'}}:null}});
 hold=false;release();await pending;
 a.ok(calls.some(p=>p.includes('/2021.json')),'Years selected during refresh must load the older history');
 console.log('PASS failed-refresh history recovery and changing period during in-flight refresh');
}
async function main(){
 let failure='',held=null,release,calls=[];
 const mount={innerHTML:''},handlers={};
 const document={getElementById:()=>mount,addEventListener:(n,f)=>handlers[n]=f};
 const window={document,fetch:async p=>{
  calls.push(p);
  if(held)await held;
  if(failure==='network')throw Error('offline');
  return {ok:failure!=='http',json:async()=>{if(failure==='json')throw Error('bad JSON');if(failure==='shape')return {};return JSON.parse(read('site/'+p));}};
 }};
 vm.runInNewContext(read('site/market-snapshot.js'),{window,URL,Intl,Date});
 const M=window.MarketSnapshot;
 await M.mount();
 const original=mount.innerHTML;
 a.match(original,/data-ms-refresh/);a.match(original,/58 instruments/);
 for(const mode of ['network','http','json','shape']){
  failure=mode;calls=[];await M.refresh();
  a.match(mount.innerHTML,/Refresh failed; showing last successful saved data with its original dates/);
  // Everything after the status region remains the exact previously rendered data.
  a.equal(mount.innerHTML.slice(mount.innerHTML.indexOf('<div class="ms-curves">')),original.slice(original.indexOf('<div class="ms-curves">')));
  a.ok(calls.includes('data/watchlist/latest.json'));
 }
 failure='';await M.refresh();a.equal(mount.innerHTML,original,'retry clears error and cached rejected promises');
 held=new Promise(r=>release=r);calls=[];
 const inflight=M.refresh();await new Promise(r=>setImmediate(r));
 a.match(mount.innerHTML,/aria-disabled="true"/);const count=calls.length;
 await M.refresh();a.equal(calls.length,count,'double activation does not start a second request batch');
 release();held=null;await inflight;a.equal(mount.innerHTML,original);
 // Failure on first load must still expose a retry action.
 failure='network';const second={document,fetch:window.fetch};
 vm.runInNewContext(read('site/market-snapshot.js'),{window:second,URL,Intl,Date});
 await second.MarketSnapshot.mount();a.match(mount.innerHTML,/Saved market files unavailable/);a.match(mount.innerHTML,/data-ms-refresh/);
 failure='';await second.MarketSnapshot.refresh();a.match(mount.innerHTML,/58 instruments/);
 console.log('PASS snapshot network/HTTP/JSON retention, retry, first-load recovery and concurrent activation');

 // Real freshness mount/refresh path: explicit retry bypasses the five-minute throttle.
 const metadata=require('../site/search-metadata.js'),slot={innerHTML:'',hidden:false};
 const freshWindow={SearchMetadata:metadata,document:{getElementById:()=>slot}};
 const fetch=async p=>{if(failure)throw Error('offline');return {ok:true,json:async()=>JSON.parse(read('site/'+p))};};
 vm.runInNewContext(read('site/feed-freshness.js'),{window:freshWindow,document:freshWindow.document,fetch,Map,Promise,Date});
 await freshWindow.FeedFreshness.mount('overview');const good=slot.innerHTML;
 failure='network';await freshWindow.FeedFreshness.refresh();a.match(slot.innerHTML,/Refresh failed/);a.ok(!slot.innerHTML.includes('Publication verified'));
 failure='';await freshWindow.FeedFreshness.refresh();a.equal(slot.innerHTML,good);
 console.log('PASS freshness forced refresh retains dates, removes success badges and recovers immediately');
 await historyRefreshChecks();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
