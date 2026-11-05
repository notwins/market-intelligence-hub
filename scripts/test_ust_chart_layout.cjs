const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../site/v3-core.js'),D=require('../site/bond-watchlist-data.js');
const read=f=>fs.readFileSync('site/'+f,'utf8');
const tenors=[1/12,1,5,10,20,30].map((years,i)=>({id:'t'+i,label:'t'+i,years}));
const lines=Array.from({length:9},(_,i)=>({date:'2020-01-'+String(i+1).padStart(2,'0'),number:i+1,values:[4,4.1,null,4.3,4.4,4.5],color:'red',dash:'',current:i===0}));
function environment(width,available,chartScale=1,large=false){
 const context={window:{innerWidth:width,BOND_WATCHLIST_DATA:D,addEventListener(){},MarketLayout:{chartWidth:options=>{assert.equal(options.fullWidth,true);return available;}}},document:{documentElement:{style:{getPropertyValue:()=>chartScale},dataset:{displayCharts:large?'large':'standard'}},addEventListener(){},querySelector:()=>null},URL,Date,Intl,console,MarketCore:C,USTDecisionEngine:{},USTDecisionImport:{},localStorage:{getItem:()=>null},location:{href:'https://example.com/v4.html'},matchMedia:()=>({matches:width<=760}),setTimeout(){}};
 vm.createContext(context);vm.runInContext(read('ust-curves.js'),context);vm.runInContext(read('bond-watchlist.js'),context);vm.runInContext(read('v4-tools.js').replace('return{routeSuffix,','return{_test:{scatter,getState:()=>X},routeSuffix,'),context);return context;
}
function box(svg){return svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);}
const rows=[{id:'a',maturity:'2030-01-01',couponPct:3,reportedYieldPct:4},{id:'b',maturity:'2050-01-01',couponPct:5,reportedYieldPct:5}];
for(const [width,available] of [[1024,680],[1180,838],[1440,1098],[1920,1578],[2560,2218]]){
 for(const large of [false,true]){
  const c=environment(width,available,1,large),u=c.window.USTCurves,b=c.window.BondWatchlist,t=c.window.MarketV3._test;t.getState().asof='2026-11-05';
  const daily=u.chart(lines.slice(0,1),tenors),pinned=b._test.chart(b._test.state('ust')),scatter=t.scatter(rows);
  for(const svg of [daily,pinned,scatter]){const [w,h]=box(svg);assert(w<=960);assert.equal(h,large?390:260);assert(!svg.includes('NaN'));}
  assert.equal((daily.match(/data-tenor-years=/g)||[]).length,5);assert.equal((pinned.match(/class="bw-dot"/g)||[]).length,29);assert.equal((scatter.match(/<circle/g)||[]).length,2);
 }
}
for(const width of [375,390,600]){const c=environment(width,width-64);assert.deepEqual(box(c.window.USTCurves.chart(lines.slice(0,1),tenors,true)),[400,335]);assert.deepEqual(box(c.window.BondWatchlist._test.chart(c.window.BondWatchlist._test.state('ust'))),[width-64,300]);}
for(const scale of [.5,1,2]){const c=environment(1920,1578,scale),svg=c.window.USTCurves.chart(lines,tenors),[w,h]=box(svg),ys=[...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)" text-anchor="middle" class="uc-end-number"/g)].map(m=>Number(m[1])).sort((a,b)=>a-b);assert.equal(ys.length,9);for(let i=1;i<ys.length;i++)assert(ys[i]-ys[i-1]>=22*scale-.001);assert(h>=260);assert(w<=960);assert.equal((svg.match(/data-tenor-years=/g)||[]).length,45);}
const css=read('ust-chart-layout.css'),html=read('v4.html');assert(css.includes('@media(min-width:761px)'));assert.equal((css.match(/max-width:960px/g)||[]).length,3);assert(css.includes('#ust-results>.chart-panel>.v3-chart'));assert(html.includes('ust-chart-layout.css?v=20261105.compact-ust1'));for(const f of ['ust-curves.js','bond-watchlist.js','v4-tools.js'])assert(html.includes(f+'?v=20261105.'+(f==='v4-tools.js'?'history1':'compact-ust1')));
console.log('PASS compact desktop UST plots at 1024–2560px, 960px width cap, 260/390px chart heights, unchanged mobile geometry/data, independent chart text, nine readable endpoint keys and cache refresh');
