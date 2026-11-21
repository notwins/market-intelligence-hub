/* Isolated controller regressions. No browser storage or real network requests. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../site/si-beta2-core.js');
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
function harness(references,settings={}){
 const nodes=new Map(),timers=new Map(),refresh=deferred(),writes=[],revoked=[],pdfPages=[];let timerId=0;
 function element(){return {value:'',textContent:'',innerHTML:'',hidden:true,disabled:false,options:[],dataset:{},listeners:{},clicks:0,classList:{toggle(){},add(){}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},scrollIntoView(){},focus(){},remove(){},append(){},addEventListener(k,f){this.listeners[k]=f;},click(){this.clicks++;return this.listeners.click?.({preventDefault(){}});}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const form=get('si-form');form.elements=new Proxy({}, {get:(o,k)=>o[k]||(o[k]=element())});form.requestSubmit=()=>form.listeners.submit({preventDefault(){}});
 const p={...C.blank(),id:'saved',shares:[{symbol:'TEST',fixing:100,name:'Test',description:'Layout test'}],ko:100,ki:70,strike:90,step:0,months:11,coupon:8};
 const context={console,structuredClone,Blob,Uint8Array,crypto:{randomUUID:()=>`id-${++timerId}`},URL:{createObjectURL:()=>`blob:test-${++timerId}`,revokeObjectURL:u=>revoked.push(u)},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:k=>k==='market-si-beta2-v1'?JSON.stringify({version:1,pages:[p],activeId:p.id,watch:[]}):settings[k]||null,setItem:(k,v)=>writes.push(k==='market-si-beta2-v1'?JSON.parse(v):{key:k,value:v})},document:{getElementById:get,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>element(),head:element(),body:element(),createElement(tag){const e=element();if(tag==='canvas'){e.getContext=()=>({fillRect(){},drawImage(){}});e.toBlob=fn=>fn(new Blob(['test']));}return e;}},Image:class{set src(v){Promise.resolve().then(()=>this.onload());}},window:{SIBetaCore:C,addEventListener(){},MarketSI:{connect(fn){fn();},records:()=>[],refresh(){}},MarketPrices:{refresh:()=>refresh.promise,series:()=>Promise.reject(Error('No data')),instruments:()=>[],resolve:()=>null},PDFLib:{PDFDocument:{create:async()=>({setTitle(){},setProducer(){},embedPng:async()=>({}),addPage:()=>{pdfPages.push({});return {drawImage(){}};},save:async()=>new Uint8Array([37,80,68,70])})}}}};
 if(references){context.window.document=context.document;context.window.MarketPrices.currentQuote=()=>null;context.window.MarketSI.records=()=>references;context.window.MarketSI.stepDown=()=>null;vm.runInNewContext(fs.readFileSync('site/si-quick-filter.js','utf8'),context);}
 context.URLSearchParams=URLSearchParams;
 context.window.SIEquityPages=require('../site/si-equity-pages.js');
 context.window.SIBetaCore={...C,loadReferences:async()=>({rows:references||[]})};
 vm.runInNewContext(fs.readFileSync('site/si-reference-table.js','utf8'),context);
 vm.runInNewContext(fs.readFileSync('site/si-beta2.js','utf8'),context);
 return {get,form,p,refresh,writes,timers,revoked,pdfPages};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function run(){
 const references=JSON.parse(fs.readFileSync('site/data/si-pricing-reference.json','utf8')).rows,original=JSON.stringify(references),q=harness(references),holder=q.get('library-quick-filter');
 await flush();
 const change=(id,value)=>holder.listeners.change({target:{id:'si-b2-q-'+id,value}}),count=()=>Number.parseInt(q.get('library-count').textContent);
 assert.equal(count(),246);assert.match(holder.innerHTML,/id="si-b2-q-share-1"/);assert.doesNotMatch(holder.innerHTML,/id="si-share-[1-4]"/,'Library IDs must not collide with the editor');
 const writes=q.writes.length,editorCurrency=q.form.elements.currency.value,editorCoupon=q.form.elements.coupon.value;
 change('share-1','NVDA');assert.equal(count(),114);change('share-2','TSM');assert.equal(count(),40);change('join-2','OR');assert.equal(count(),122);
 change('share-3','AMD');change('share-4','GOOGL');assert.equal(count(),references.filter(r=>r.shares.includes('NVDA')||(r.shares.includes('TSM')&&r.shares.includes('AMD')&&r.shares.includes('GOOGL'))).length,'All four shares follow the same AND/OR rules');
 const reset=()=>holder.listeners.click({target:{closest:selector=>selector==='[data-si-b2-q-reset]'?{}:null}});reset();assert.equal(count(),246);
 change('currency','USD');change('tenor','11');assert.equal(count(),references.filter(r=>r.currency==='USD'&&r.tenor_source_value===11).length);reset();
 change('coupon-min','8');change('coupon-max','8');assert.equal(count(),21,'Coupon p.a. defaults to records with a supplied annual basis');
 holder.listeners.change({target:{id:'si-b2-q-include-unconfirmed',checked:true}});assert.equal(count(),references.filter(r=>r.coupon_pct===8).length);
 change('coupon-min','9');assert.equal(count(),0);assert.match(q.get('si-b2-q-filter-error').innerHTML,/minimum.*maximum/i);reset();assert.equal(count(),246);
 assert.equal(q.writes.length,writes,'Filtering must not write to saved drafts or the watchlist');assert.equal(q.form.elements.currency.value,editorCurrency);assert.equal(q.form.elements.coupon.value,editorCoupon);assert.equal(q.get('pending-edits').hidden,true);assert.equal(JSON.stringify(references),original);
 console.log('PASS Beta 2 quick filter: isolated IDs, four-share AND/OR, currency, tenor, coupon bounds, basis controls, reset and unchanged saved terms');
 const h=harness();assert.equal(h.get('pdf-one').disabled,true,'Restored pages must wait for enrichment');assert.equal(h.get('pdf-all').disabled,true);
 await h.get('pdf-one').click();assert.equal(h.get('pdf-ready').hidden,true,'Programmatic export also guards pending data');
 h.refresh.resolve();await flush();await flush();assert.equal(h.get('pdf-one').disabled,false,'Missing data must not permanently block PDF');assert.match(h.get('data-check-text').textContent,/Price history unavailable/);
 h.form.elements.coupon.value='9';h.form.listeners.input();assert.equal(h.get('pending-edits').hidden,false);assert.equal(h.get('pdf-one').disabled,true);
 h.get('new-page').click();assert.equal(h.form.elements.coupon.value,'9','New page must preserve unapplied edits');h.get('backup-pages').click();assert.match(h.get('app-status').textContent,/Apply or discard/);
 h.get('apply-pending').click();await flush();assert.equal(h.get('pending-edits').hidden,true);assert.equal(h.writes.at(-1).pages[0].coupon,9);
 h.form.elements.coupon.value='10';h.form.listeners.change();h.get('discard-pending').click();assert.equal(h.form.elements.coupon.value,9);
 await h.get('pdf-one').click();assert.equal(h.get('pdf-ready').hidden,false);assert.match(h.get('download-pdf').href,/^blob:/);assert.equal(h.get('open-pdf').href,h.get('download-pdf').href);assert.equal(h.get('download-pdf').download,'SI-TEST.pdf');assert.equal(h.get('download-pdf').clicks,1);assert.match(h.get('pdf-ready-text').textContent,/1-page PDF ready/);
 h.get('logo-watermark').click();assert.equal(h.get('logo-watermark')['aria-pressed'],'false');assert.equal(h.get('pdf-ready').hidden,true,'A watermark change invalidates the previous PDF');assert.deepEqual(h.writes.at(-1),{key:'market-si-beta2-logo-watermark',value:'off'},'Store the watermark choice separately from saved terms');assert.equal(h.get('pdf-one').disabled,false,'The watermark toggle does not dirty the form');
 await h.get('pdf-one').click();
 const priorPages=h.pdfPages.length,draftWrites=h.writes.filter(w=>w.version===1).length;
 h.get('include-equity').checked=true;h.get('include-equity').listeners.change();
 assert.equal(h.get('pdf-ready').hidden,true);assert.match(h.get('pdf-all').textContent,/\(2\)/);
 assert.equal(h.writes.filter(w=>w.version===1).length,draftWrites,'The appendix option must not rewrite saved drafts');
 await h.get('pdf-one').click();assert.equal(h.pdfPages.length-priorPages,2,'One share adds exactly one physical PDF page');
 assert.match(h.get('pdf-ready-text').textContent,/2-page PDF ready/);
 h.get('chart-cone').checked=true;h.get('chart-display').listeners.change();
 assert.equal(h.get('pdf-ready').hidden,true);assert.match(h.get('preview').innerHTML,/not a forecast or barrier-hit probability/);
 assert.equal(h.get('pending-edits').hidden,true,'Chart choices must not dirty the SI terms');
 const remembered=harness(null,{'market-si-beta2-equity-pages':'on','market-si-beta2-chart':JSON.stringify({cone:true})});
 remembered.refresh.resolve();await flush();await flush();assert.equal(remembered.get('include-equity').checked,true);assert.equal(remembered.get('chart-cone').checked,true);
 h.form.listeners.input();assert.equal(h.get('pdf-ready').hidden,true);assert.equal(h.get('download-pdf').href,undefined);assert(h.revoked.length>0,'Edits invalidate the prior file');
 const slow=harness();[...slow.timers.values()].find(t=>t.ms===20000).fn();await flush();await flush();assert.equal(slow.get('pdf-one').disabled,false,'Initial feed timeout falls back to explicit missing data');
 console.log('PASS SI controller: restore readiness, bounded loading, pending edits, apply/discard, explicit PDF links and stale-file invalidation');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
