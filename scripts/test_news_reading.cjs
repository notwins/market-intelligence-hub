const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync('site/'+f,'utf8');
global.MorningstarLinks=require('../site/morningstar-links.js');const h=require('../site/headline-explorer.js');
const ctx={time:()=> '4 Nov 2026 · SGT',stockLink:t=>t},a={id:'a',title:'US Fed cuts rates as Trump reviews tariffs',published_at:'2026-11-04',category:'Markets',url:'https://www.reuters.com/example'};
const saved={...a,summary:'The Fed announced a policy decision.',context:'The report describes a dated change. This is separate context.',summary_verified:true,summary_source_url:a.url};
let html=h.card(a,{...ctx,contextData:{items:[saved]}});
assert(html.indexOf('hx-headline')<html.indexOf('hx-summary'));assert(html.indexOf('hx-summary')<html.indexOf('hx-tags'));
assert(html.includes('Read summary &amp; context'));assert(html.includes(saved.context));assert.equal(html.split(saved.summary).length-1,1);assert(!html.includes('Teach Me'));
assert(h.card(a,ctx).includes('Summary not yet available'));assert(!h.card(a,ctx).includes('<details'));
for(const bad of [{...saved,id:'wrong'},{...saved,title:'different'},{...saved,published_at:'2026-11-03'},{...saved,summary_verified:false},{...saved,summary_source_url:'javascript:alert(1)'}])assert(!h.card(a,{...ctx,contextData:{items:[bad]}}).includes(saved.summary));
assert(!h.card(a,{...ctx,contextData:{items:[{...saved,context:'<img src=x onerror=alert(1)>'}]}}).includes('<img'));
const events={},focused=[];const d={addEventListener:(k,fn)=>events[k]=fn,querySelector:()=>({focus:()=>focused.push('focus'),scrollIntoView(){}})};
const sandbox={window:{document:d,MorningstarLinks:global.MorningstarLinks},document:d,URL,encodeURIComponent};vm.runInNewContext(read('headline-explorer.js'),sandbox);const ui=sandbox.window.HeadlineExplorer;let renders=0;ui.connect(()=>renders++);
function click(selector,dataset){events.click({target:{closest:q=>q===selector?{dataset}:null}});}
click('[data-hx-tag]',{hxTag:'country',hxValue:'US'});click('[data-hx-tag]',{hxTag:'bank',hxValue:'Fed'});
assert.equal(ui.filtered([a,{...a,title:'US economy grows'}]).length,1);assert(ui.activeControls().includes('Country / region: US'));assert(ui.activeControls().includes('Central bank: Fed'));
click('[data-hx-clear]',{hxClear:'bank'});assert(ui.activeControls().includes('Country / region: US'));assert(!ui.activeControls().includes('Central bank: Fed'));
click('[data-hx-tag]',{hxTag:'country',hxValue:'US'});assert.equal(ui.activeControls(),'');
click('[data-hx-tag]',{hxTag:'category',hxValue:'Markets'});assert.equal(ui.filtered([a,{...a,category:'Elections'}]).length,1);click('[data-hx-reset]',{});assert.equal(ui.activeControls(),'');assert.equal(renders,6);assert.equal(focused.length,6);
const data=JSON.parse(read('headline-context.json'.replace(/^/,'data/'))),news=JSON.parse(read('data/news.json'));
assert(data.items.length>=14);for(const item of data.items){assert(news.items.some(n=>n.id===item.id&&n.title===item.title&&n.published_at===item.published_at));assert.equal(item.summary_verified,true);assert(item.summary!==item.context);assert(item.summary!==item.title);assert(item.context.length>40);assert(new URL(item.summary_source_url).protocol==='https:');}
const page=read('v4.html'),overview=page.slice(page.indexOf('function overview()'),page.indexOf('function earningsView()'));
assert(overview.indexOf('briefing-lead')<overview.indexOf('MarketV3.welcome()'));assert.equal((page.match(/researchLearningCard\(\)/g)||[]).length,3);
assert(page.includes('id="headline-toolbar"'));assert(page.includes('syncHeadlineToolbar();'));assert(page.includes('data-v4-disclosure="newsFiltersOpen"'));assert(page.includes("S.newsFiltersOpen??!matchMedia('(max-width:760px)').matches"));
assert(read('v4.css').includes('--sticky-topbar-height'));assert(read('headline-explorer.css').includes('.hx-story .hx-headline a{font:inherit'));
console.log('PASS title-first hierarchy, meaningful/nonrepeating context, exact-ID/date/source safeguards, tag add/toggle/mixed/remove/reset, focus, summary provenance, persistent toolbar and preserved briefing/learning resources');
