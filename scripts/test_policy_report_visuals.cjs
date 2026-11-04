const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const listeners={};let markup='',focused=false;
const holder={set outerHTML(v){markup=v;}};
const context={window:{},Date,URL,document:{addEventListener:(type,fn)=>listeners[type]=fn,querySelector:()=>holder,getElementById:()=>({focus(){focused=true;}})}};
vm.createContext(context);vm.runInContext(read('v2-data.js'),context);context.D=context.window.MI_V2_DATA;
vm.runInContext(read('policy-report-visuals.js')+';globalThis.charts=PolicyReportVisuals;',context);
const c=context.charts,reports=context.D.reports;let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('all chart snapshots match their existing public report values',()=>{
 const expected={
  '2026-11-03':[84,65,241,52,52.1,43.3,8.8],
  '2026-11-02':[83,62,241,52,51.8,43.3,8.5],
  '2026-11-01':[83,63,241,52,51.5,43.1,8.4],
  '2026-10-31':[82,62,239,52,51.4,43.2,8.2]
 };
 for(const [date,values] of Object.entries(expected)){const id='election-'+date,r=reports.find(x=>x.id===id),s=c.snapshots[id];assert(r);assert.deepEqual(Array.from([s.house,s.senate,s.houseSeats,s.senateSeats,s.dem,s.rep,s.lead]),values);for(const value of values)assert.match(r.full_text,new RegExp('\\b'+String(value).replace('.','\\.')+'\\b'));assert.equal(Math.round((s.dem-s.rep)*10)/10,s.lead);assert(s.forecast.includes('2026'));assert(s.fieldwork.includes('2026'));}
});
test('chart units, dates, limits and primary-source links remain visible',()=>{const r=reports.find(x=>x.id==='election-2026-11-03'),html=c.reader(r);for(const text of ['84%','65%','52.1%','43.3%','D +8.8','pre-election','not live','0%','100%','9 Oct–1 Nov 2026','Projected Democratic','percentage-point','votes.decisiondeskhq.com','realclearpolling.com'])assert(html.includes(text),text);assert(!html.includes('chart.js'));assert(!html.includes('<iframe'));});
test('policy and election cards/readers never emit ChatGPT links',()=>{for(const r of reports.filter(x=>x.channel==='election')){assert(!/https?:\/\/chatgpt\.com|Original chat|styled chat/.test(c.card(r)+c.reader(r)));}assert.equal(c.source('https://chatgpt.com/c/private','private'),'');assert.equal(c.source('javascript:alert(1)','bad'),'');});
test('latest Treasury extract uses zero-based billion scale and distinct cash assumptions',()=>{const r=reports.find(x=>x.id==='election-2026-11-04'),html=c.reader(r);for(const text of ['618bn','800bn','0</span>','1,000','US$850bn','US$1tn','2 Nov 2026','08:06 SGT','estimates, not actual'])assert(html.includes(text),text);assert.equal((html.match(/width:61.8%/g)||[]).length,1);assert.equal((html.match(/width:80%/g)||[]).length,1);});
test('unavailable and unknown editions do not invent charts or zero values',()=>{const r=reports.find(x=>x.id==='election-2026-10-30');assert.equal(c.charts(r),'');assert(c.reader(r).includes('unavailable'));assert(!c.reader(r).includes('policy-bar'));assert.equal(c.charts({id:'election-2026-12-01'}),'');});
test('inline chart selection defaults latest historical election, updates and preserves keyboard focus',()=>{let html=c.electionSection(reports);assert(html.includes('value="election-2026-11-03" selected'));assert(html.includes('policy-chart-grid'));listeners.change({target:{id:'policy-election-edition',value:'election-2026-10-31'}});assert(markup.includes('value="election-2026-10-31" selected'));assert(markup.includes('82%'));assert(markup.includes('51.4%'));assert(focused);assert(c.electionSection(reports).includes('value="election-2026-10-31" selected'));});
test('source text and labels escape HTML and block untrusted URL schemes',()=>{assert(c.card({date:'2026-11-03',title:'<script>x</script>',summary:'<img>',status:'Verified extract',id:'x'}).includes('&lt;script&gt;'));assert(c.body({full_text:'1. Test\n\n<script>alert(1)</script>'}).includes('&lt;script&gt;'));});
test('both V3 and V4 load the charts and override only election-channel reports',()=>{for(const name of ['v3.html','v4.html']){const html=read(name);assert(html.includes('policy-report-visuals.css'));assert(html.includes('policy-report-visuals.js'));assert(html.indexOf('policy-report-visuals.js')<html.indexOf('policy-dashboard.js'));assert(html.includes("if(r.channel==='election')return PolicyReportVisuals.card(r)"));assert(html.includes("innerHTML=PolicyReportVisuals.reader(r)"));for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);}});
console.log(`${n} policy/report chart checks passed.`);
