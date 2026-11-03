const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../site');
const context={document:{addEventListener(){}},Date};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'policy-dashboard.js'),'utf8')+';globalThis.api=PolicyDesk;',context);const a=context.api;
const now=Date.parse('2026-11-10T00:00:00Z'),news={generated_at:'2026-11-09T12:00:00Z',items:[{title:'Fed cuts rates',published_at:'2026-11-08T12:00:00Z',url:'https://www.reuters.com/world/fed'}, {title:'Fed old',published_at:'2026-11-01T12:00:00Z',url:'https://www.reuters.com/old'}, {title:'Fed future',published_at:'2026-11-10T12:00:00Z',url:'https://www.reuters.com/future'},{title:'Fed redirect',published_at:'2026-11-08T12:00:00Z',url:'https://news.google.com/a'}]};
assert.equal(a.matchingRows(news,['banks','','',/Fed/],now).length,1);assert.equal(a.snapshotWindow(news,now).end,Date.parse(news.generated_at));
for(const stamp of [null,'bad','2026-11-11T00:00:00Z'])assert.equal(a.snapshotWindow({generated_at:stamp},now),null);
assert.equal(a.matchingRows({generated_at:'bad',items:news.items},['','','',/Fed/],now).length,0);
const old=a.snapshotWindow({generated_at:'2026-10-01T00:00:00Z'},now);assert.equal(old.end,Date.parse('2026-10-01T00:00:00Z'));
const feeds=JSON.parse(fs.readFileSync(path.join(root,'data/feeds-v3.json')));for(const id of ['treasury-history','fed-fx-history']){const x=feeds.connections.find(x=>x.id===id);assert.equal(x.state,'published_provider_snapshot');assert.equal(x.latest_observation_period,'2026-10-01');assert(x.status_url.includes('history-fed-status'));assert(x.note.includes('not a live feed'));}
for(const id of ['mas-sgs-history','wsj-ust-prices'])assert.equal(feeds.connections.find(x=>x.id===id).state,'prepared_not_connected');
// Exercise the actual settings rendering/open/close functions with a minimal node lifecycle.
const source=fs.readFileSync(path.join(root,'v4-display.js'),'utf8'),snippet=source.slice(source.indexOf(' function renderSettings(){'),source.indexOf(' function init(){'));
let attached=true,languageCalls=0,focused=false,withHeading=true;
const select={value:'zh-Hans',remove(){attached=false;},listeners:[()=>languageCalls++]};
const field=()=>({children:[],append(x){this.children.push(x);}});
const dialog={open:false,set innerHTML(v){this.html=v;},querySelector(s){return s==='.display-heading'&&withHeading?{after(node){attached=node.children.includes(select);}}:null;},prepend(node){attached=node.children.includes(select);},showModal(){this.open=true;},close(){this.open=false;}};
const trigger={getClientRects:()=>[1],focus(){focused=true;}};
const c={dialog,restoreFocus:null,content:()=>'<div class="display-heading"></div>',document:{getElementById:id=>id==='language'?(attached?select:null):id==='more'?null:trigger,createElement:field,createTextNode:s=>s}};vm.createContext(c);vm.runInContext(snippet+';globalThis.test={renderSettings,open,close};',c);
for(let i=0;i<3;i++){c.test.open(trigger);assert(attached);assert(dialog.open);assert.equal(select.value,'zh-Hans');select.listeners[0]();c.test.close();assert(!dialog.open);assert(focused);}
c.test.renderSettings();assert(attached);withHeading=false;c.test.renderSettings();assert(attached);assert.equal(languageCalls,3);
assert(source.includes("data-display-reset')){prefs={...defaults};apply(true);save();renderSettings();"));
assert(!source.includes("querySelector('.dialog-head')"));
console.log('PASS stored-cutoff rollover, stale/missing/future cutoff safeguards, Reuters filtering, Fed metadata distinction and settings node/listener retention across open/close/reset rendering and fallback');
