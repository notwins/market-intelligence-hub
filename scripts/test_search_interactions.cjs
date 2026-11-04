/* DOM-contract test; not a substitute for visual browser QA. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element{
 constructor(value=''){this.value=value;this.innerHTML='';this.textContent='';this.disabled=false;this.listeners={};this.attrs={};}
 addEventListener(k,fn){this.listeners[k]=fn;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
}
const ids=['q','kind','scope','sort','join','tag-value','tag-options','add-tag','tag-help','clear','query-error','status','results','prev','next','limits','built','counts','search-form','company-hub','search-intro'];
const nodes=Object.fromEntries(ids.map(x=>[x,new Element()]));nodes.scope.value='all';nodes.join.value='AND';
const events={},docEvents={},location={href:'https://example.com/search.html?q=Google',search:'?q=Google'};
const entries=Array.from({length:93},(_,i)=>({id:String(i),kind:'Headline',title:(i%3===0?'Google Microsoft':i%3===1?'Alphabet Amazon':'Google')+' '+i,text:'Saved earnings text <script>bad()</script>',tags:['Earnings'],date:'2026-11-03',href:'https://example.com/story/'+i,location:{label:'V4 → Reuters coverage',href:'v4.html#headlines'},status:'Saved headline'}));
const context={BOSResources:{sources:[{kind:'equities',url:'https://publisher.example/equity.pdf',edition:'3 November 2026'}]},document:{getElementById:id=>nodes[id],addEventListener:(n,f)=>docEvents[n]=f},URL,URLSearchParams,location,history:{replaceState:(_a,_b,u)=>{location.href=u.href;location.search=u.search;}},fetch:async()=>({ok:true,json:async()=>({entries,counts:{Headline:93},limits:'Public only',built_at:'fixture'})}),setTimeout:fn=>{fn();return 1;},clearTimeout(){},addEventListener:(n,f)=>events[n]=f,console};context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('site/search-query.js','utf8'),context);vm.runInContext(fs.readFileSync('site/site-search.js','utf8'),context);
const click=(dataset,key)=>docEvents.click({target:{closest:s=>s==='[data-'+key+']'?{dataset}:null}});
(async()=>{await new Promise(setImmediate);
 assert(nodes.status.textContent.startsWith('93 matches'));assert(nodes['company-hub'].innerHTML.includes('Google / Alphabet'));assert(nodes['search-intro'].hidden);assert(nodes['company-hub'].innerHTML.includes('BOS equity research PDF'));assert(nodes['company-hub'].innerHTML.includes('External ↗'));assert.equal((nodes.results.innerHTML.match(/<article/g)||[]).length,40);assert(nodes.prev.disabled);assert(!nodes.next.disabled);
 assert(!nodes.results.innerHTML.includes('<script>'));assert(nodes.results.innerHTML.includes('&lt;script&gt;'));assert(nodes.results.innerHTML.includes('Located in:'));assert(nodes.results.innerHTML.includes('v4.html#headlines'));
 nodes.next.onclick();assert(nodes.status.textContent.includes('41–80'));nodes.next.onclick();assert(nodes.status.textContent.includes('81–93'));assert(nodes.next.disabled);nodes.prev.onclick();assert(nodes.status.textContent.includes('41–80'));
 nodes.q.value='Google AND (';nodes.q.listeners.input();assert(nodes['query-error'].textContent);assert.equal(nodes.results.innerHTML,'');assert(nodes.prev.disabled&&nodes.next.disabled);assert.equal(nodes.q.attrs['aria-invalid'],'true');
 nodes.q.value='Google OR MSFT';nodes.q.listeners.input();assert(!nodes.q.attrs['aria-invalid']);nodes.join.value='AND';click({tag:'AMZN'},'tag');assert.equal(nodes.q.value,'(Google OR MSFT) AND tag:"Amazon"');assert(nodes.status.textContent.startsWith('31 matches'));
 nodes.clear.onclick();assert.equal(nodes.q.value,'');assert.equal(nodes['search-intro'].hidden,false);assert(nodes.q.focused);assert(nodes.status.textContent.startsWith('93 matches'));
 click({query:'Google AND (MSFT OR AMZN)'},'query');assert(nodes.status.textContent.startsWith('62 matches'));
 nodes['tag-value'].value='Microsoft';nodes.join.value='OR';nodes['add-tag'].onclick();assert.equal(nodes['tag-value'].value,'');assert(nodes.q.value.includes('OR tag:"Microsoft"'));
 nodes['tag-value'].value='unknown-tag';nodes['add-tag'].onclick();assert(nodes['tag-help'].textContent.includes('Choose'));
 location.search='?q=tag%3AAmazon&scope=articles';events.popstate();assert.equal(nodes.q.value,'tag:Amazon');assert.equal(nodes.scope.value,'articles');assert(nodes.status.textContent.startsWith('31 matches'));
 nodes.q.value='NOT Google';let prevented=false;nodes['search-form'].listeners.submit({preventDefault(){prevented=true;}});assert(prevented);assert(nodes.status.textContent.startsWith('0 matches'));assert(nodes.results.innerHTML.includes('Private reports'));
 console.log('PASS DOM-contract interactions: URL restore, 93-result pagination, malformed query recovery, repeated tag clicks, clear, examples, picker validation, Back/Forward restore, submit, source/location links and XSS escaping');
})().catch(e=>{console.error(e);process.exitCode=1;});
