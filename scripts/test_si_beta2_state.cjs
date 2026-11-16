/* Isolated controller regressions. No browser storage or real network requests. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),C=require('../site/si-beta2-core.js');
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
function harness(){
 const nodes=new Map(),timers=new Map(),refresh=deferred(),writes=[],revoked=[];let timerId=0;
 function element(){return {value:'',textContent:'',innerHTML:'',hidden:true,disabled:false,options:[],dataset:{},listeners:{},clicks:0,classList:{toggle(){},add(){}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},scrollIntoView(){},focus(){},remove(){},append(){},addEventListener(k,f){this.listeners[k]=f;},click(){this.clicks++;return this.listeners.click?.({preventDefault(){}});}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const form=get('si-form');form.elements=new Proxy({}, {get:(o,k)=>o[k]||(o[k]=element())});form.requestSubmit=()=>form.listeners.submit({preventDefault(){}});
 const p={...C.blank(),id:'saved',shares:[{symbol:'TEST',fixing:100,name:'Test',description:'Layout test'}],ko:100,ki:70,strike:90,step:0,months:11,coupon:8};
 const context={console,structuredClone,Blob,Uint8Array,crypto:{randomUUID:()=>`id-${++timerId}`},URL:{createObjectURL:()=>`blob:test-${++timerId}`,revokeObjectURL:u=>revoked.push(u)},setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>JSON.stringify({version:1,pages:[p],activeId:p.id,watch:[]}),setItem:(k,v)=>writes.push(JSON.parse(v))},document:{getElementById:get,querySelectorAll:()=>[],querySelector:()=>element(),head:element(),body:element(),createElement(tag){const e=element();if(tag==='canvas'){e.getContext=()=>({fillRect(){},drawImage(){}});e.toBlob=fn=>fn(new Blob(['test']));}return e;}},Image:class{set src(v){Promise.resolve().then(()=>this.onload());}},window:{SIBetaCore:C,addEventListener(){},MarketSI:{connect(fn){fn();},records:()=>[],refresh(){}},MarketPrices:{refresh:()=>refresh.promise,series:()=>Promise.reject(Error('No data')),instruments:()=>[],resolve:()=>null},PDFLib:{PDFDocument:{create:async()=>({setTitle(){},setProducer(){},embedPng:async()=>({}),addPage:()=>({drawImage(){}}),save:async()=>new Uint8Array([37,80,68,70])})}}}};
 vm.runInNewContext(fs.readFileSync('site/si-beta2.js','utf8'),context);
 return {get,form,p,refresh,writes,timers,revoked};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function run(){
 const h=harness();assert.equal(h.get('pdf-one').disabled,true,'Restored pages must wait for enrichment');assert.equal(h.get('pdf-all').disabled,true);
 await h.get('pdf-one').click();assert.equal(h.get('pdf-ready').hidden,true,'Programmatic export also guards pending data');
 h.refresh.resolve();await flush();await flush();assert.equal(h.get('pdf-one').disabled,false,'Missing data must not permanently block PDF');assert.match(h.get('data-check-text').textContent,/Price history unavailable/);
 h.form.elements.coupon.value='9';h.form.listeners.input();assert.equal(h.get('pending-edits').hidden,false);assert.equal(h.get('pdf-one').disabled,true);
 h.get('new-page').click();assert.equal(h.form.elements.coupon.value,'9','New page must preserve unapplied edits');h.get('backup-pages').click();assert.match(h.get('app-status').textContent,/Apply or discard/);
 h.get('apply-pending').click();await flush();assert.equal(h.get('pending-edits').hidden,true);assert.equal(h.writes.at(-1).pages[0].coupon,9);
 h.form.elements.coupon.value='10';h.form.listeners.change();h.get('discard-pending').click();assert.equal(h.form.elements.coupon.value,9);
 await h.get('pdf-one').click();assert.equal(h.get('pdf-ready').hidden,false);assert.match(h.get('download-pdf').href,/^blob:/);assert.equal(h.get('open-pdf').href,h.get('download-pdf').href);assert.equal(h.get('download-pdf').download,'SI-TEST.pdf');assert.equal(h.get('download-pdf').clicks,1);assert.match(h.get('pdf-ready-text').textContent,/1-page PDF ready/);
 h.form.listeners.input();assert.equal(h.get('pdf-ready').hidden,true);assert.equal(h.get('download-pdf').href,undefined);assert(h.revoked.length>0,'Edits invalidate the prior file');
 const slow=harness();[...slow.timers.values()].find(t=>t.ms===20000).fn();await flush();await flush();assert.equal(slow.get('pdf-one').disabled,false,'Initial feed timeout falls back to explicit missing data');
 console.log('PASS SI controller: restore readiness, bounded loading, pending edits, apply/discard, explicit PDF links and stale-file invalidation');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
