const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let scroll=0;const listeners={},frame={style:{},contentWindow:{},dataset:{},addEventListener(){}};
const ctx={window:{scrollBy:(x,y)=>scroll+=y,addEventListener:(n,f)=>listeners[n]=f},setTimeout:()=>1,clearTimeout:()=>{},document:{querySelector:()=>null,getElementById:id=>id==='beta2-frame'?frame:null}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('site/beta2-shares.js','utf8'),ctx);
const B=ctx.window.Beta2Shares;assert(B.view().includes('standalone-beta2-share-events-2026-11-15-r4/index.html'));assert(B.view().includes('title="Event studies'));B.mount();assert.equal(frame.dataset.bound,'1');
for(const origin of ['https://evil.example','null'])listeners.message({origin,source:frame.contentWindow,data:{type:'beta2-study-height',height:4000}});assert.equal(frame.style.height,undefined);
listeners.message({origin:'https://notwins.github.io',source:{},data:{type:'beta2-study-height',height:4000}});assert.equal(frame.style.height,undefined);
listeners.message({origin:'https://notwins.github.io',source:frame.contentWindow,data:{type:'beta2-study-height',height:4000}});assert.equal(frame.style.height,'4008px');
listeners.message({origin:'https://notwins.github.io',source:frame.contentWindow,data:{type:'beta2-study-height',height:Infinity}});assert.equal(frame.style.height,'4008px');
for(const f of ['site/v4-tools.js','site/v4.html'])assert(fs.readFileSync(f,'utf8').includes('beta2-shares'));
assert(B.view().includes('beta2-jump'));assert(B.view().includes('beta2-retry'));assert(!B.view().includes('<h1>'));assert.equal(B.jump('untrusted-id'),false);
console.log('PASS Beta 2 independent article route, accessible frame, fallback link, origin/source checks and bounded resizing');

for(const delta of [Infinity,60001,NaN])listeners.message({origin:'https://notwins.github.io',source:frame.contentWindow,data:{type:'beta2-study-scroll-adjust',delta}});assert.equal(scroll,0);listeners.message({origin:'https://notwins.github.io',source:frame.contentWindow,data:{type:'beta2-study-scroll-adjust',delta:200}});assert.equal(scroll,200);

// A mobile header can gain height after the first scroll. Align after layout.
const callbacks=[];let y=0,header=50;
const target={isConnected:true,parentElement:null,setAttribute(){},focus(){},getBoundingClientRect:()=>({top:1200})};
const liveFrame={isConnected:true,contentWindow:{scrollY:0},contentDocument:{getElementById:()=>target},getBoundingClientRect:()=>({top:100-y})};
const bar={getBoundingClientRect:()=>({height:100,bottom:header+100})},topbar={getBoundingClientRect:()=>({height:header,bottom:header})};
ctx.document.getElementById=()=>liveFrame;ctx.document.querySelector=s=>s==='.topbar'?topbar:bar;
ctx.window.scrollY=0;ctx.window.scrollTo=({top})=>{y=top;ctx.window.scrollY=y};ctx.window.scrollBy=(x,dy)=>{y+=dy;ctx.window.scrollY=y};ctx.window.requestAnimationFrame=f=>callbacks.push(f);
assert.equal(B.jump('event-4'),true);header=200;while(callbacks.length)callbacks.shift()();assert.equal(y,976);assert.equal(100-y+1200,header+100+24);
console.log('PASS event jump realigns below a changing mobile header');
